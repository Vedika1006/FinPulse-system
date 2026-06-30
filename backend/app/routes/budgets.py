from collections import defaultdict
from datetime import date, datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app import models, schemas
from app.database import get_db
from app.core.security import get_current_user
from app.core.exceptions import BadRequestException, NotFoundException

router = APIRouter(
    prefix="/budgets",
    tags=["Budgets"]
)


# ✅ CREATE BUDGET
@router.post("/", response_model=schemas.BudgetResponse)
def create_budget(
    budget: schemas.BudgetCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    normalized_category = (budget.category or "").strip().lower()
    if not normalized_category:
        normalized_category = "uncategorized"
    new_budget = models.Budget(
        category=normalized_category,
        amount=budget.amount,
        limit=budget.amount,
        month=budget.month,
        user_id=user_id
    )

    db.add(new_budget)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise BadRequestException("Budget already exists for this category and month")

    db.refresh(new_budget)
    return new_budget


# ✅ GET ALL BUDGETS
@router.get("/", response_model=list[schemas.BudgetResponse])
def get_budgets(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    return db.query(models.Budget).filter(
        models.Budget.user_id == user_id
    ).all()


# ✅ AI BUDGET SUGGESTIONS — must be defined before /{budget_id} routes
@router.get("/suggestions", response_model=list[schemas.BudgetSuggestionResponse])
def get_budget_suggestions(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    """
    Analyse last 4 complete calendar months of expenses (using Expense.date)
    and return per-category budget suggestions.  Categories with fewer than 2
    transactions are excluded.
    """
    today = date.today()
    first_of_month = datetime(today.year, today.month, 1)

    y, m = today.year, today.month - 4
    while m <= 0:
        m += 12
        y -= 1
    cutoff = datetime(y, m, 1)

    expenses = (
        db.query(models.Expense)
        .filter(
            models.Expense.user_id == user_id,
            models.Expense.date >= cutoff,
            models.Expense.date < first_of_month,
        )
        .all()
    )

    cat_month_totals: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    cat_tx_count: dict[str, int] = defaultdict(int)
    seen_months: set[str] = set()

    for e in expenses:
        if e.date is None:
            continue
        mk = e.date.strftime("%Y-%m")
        seen_months.add(mk)
        cat = (e.category or "other").strip().lower()
        cat_month_totals[cat][mk] += e.amount
        cat_tx_count[cat] += 1

    months_analyzed = max(len(seen_months), 1)

    current_month = today.strftime("%Y-%m")
    existing = (
        db.query(models.Budget)
        .filter(
            models.Budget.user_id == user_id,
            models.Budget.month == current_month,
        )
        .all()
    )
    existing_map = {b.category.lower(): b.amount for b in existing}

    suggestions = []
    for cat, month_data in cat_month_totals.items():
        if cat_tx_count[cat] < 2:
            continue
        avg = sum(month_data.values()) / months_analyzed
        suggested = (
            round(avg / 500) * 500 if avg >= 5000 else round(avg / 100) * 100
        )
        suggested = max(100.0, float(suggested))
        suggestions.append(
            schemas.BudgetSuggestionResponse(
                category=cat,
                avg_monthly_spend=round(avg, 2),
                suggested_budget=suggested,
                months_analyzed=months_analyzed,
                existing_budget=existing_map.get(cat),
            )
        )

    suggestions.sort(key=lambda s: s.avg_monthly_spend, reverse=True)
    return suggestions


# ✅ UPDATE BUDGET
@router.put("/{budget_id}", response_model=schemas.BudgetResponse)
def update_budget(
    budget_id: int,
    budget_update: schemas.BudgetUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    budget = db.query(models.Budget).filter(
        models.Budget.id == budget_id,
        models.Budget.user_id == user_id
    ).first()

    if not budget:
        raise NotFoundException("Budget not found")

    budget.amount = budget_update.amount
    budget.limit = budget_update.amount

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise BadRequestException("Update violates budget constraints")

    db.refresh(budget)
    return budget


# ✅ DELETE BUDGET (ADDED — missing earlier)
@router.delete("/{budget_id}")
def delete_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    budget = db.query(models.Budget).filter(
        models.Budget.id == budget_id,
        models.Budget.user_id == user_id
    ).first()

    if not budget:
        raise NotFoundException("Budget not found")

    db.delete(budget)
    db.commit()

    return {"message": "Budget deleted successfully"}


# ✅ BUDGET VS ACTUAL
@router.get("/vs-actual/{month}/")
def budget_vs_actual(
    month: str,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    try:
        start_date = datetime.strptime(month, "%Y-%m")
    except ValueError:
        raise BadRequestException("Month must be in YYYY-MM format")

    if start_date.month == 12:
        end_date = datetime(start_date.year + 1, 1, 1)
    else:
        end_date = datetime(start_date.year, start_date.month + 1, 1)

    budgets = db.query(models.Budget).filter(
        models.Budget.user_id == user_id,
        models.Budget.month == month
    ).all()

    if not budgets:
        return {
            "month": month,
            "total_budget": 0,
            "total_spent": 0,
            "total_remaining": 0,
            "status": "No Budget Defined",
            "categories": []
        }

    expense_totals = db.query(
        func.lower(models.Expense.category),
        func.sum(models.Expense.amount),
    ).filter(
        models.Expense.user_id == user_id,
        models.Expense.created_at >= start_date,
        models.Expense.created_at < end_date
    ).group_by(func.lower(models.Expense.category)).all()

    expense_dict = {cat: total for cat, total in expense_totals}

    categories_data = []
    total_budget = 0
    total_spent = 0

    for budget in budgets:
        total_budget += budget.amount

        spent = expense_dict.get((budget.category or "").lower(), 0)
        total_spent += spent

        categories_data.append({
            "category": budget.category,
            "budget": budget.amount,
            "actual_spent": float(spent),
            "remaining": budget.amount - float(spent),
            "status": "Over Budget" if spent > budget.amount else "Within Budget"
        })

    return {
        "month": month,
        "total_budget": total_budget,
        "total_spent": float(total_spent),
        "total_remaining": float(total_budget - total_spent),
        "status": "Over Budget" if total_spent > total_budget else "Within Budget",
        "categories": categories_data
    }