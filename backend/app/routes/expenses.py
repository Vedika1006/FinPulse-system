from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Expense
from app.schemas import ExpenseCreate, ExpenseResponse
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.security import get_current_user
from app.services.categorization_service import categorize_merchant

router = APIRouter(prefix="/expenses", tags=["Expenses"])


# ✅ CREATE EXPENSE
@router.post("/", response_model=ExpenseResponse)
def create_expense(
    expense: ExpenseCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    if expense.amount <= 0:
        raise BadRequestException("Amount must be greater than 0")

    normalized_category = (expense.category or "").strip().lower()
    if not normalized_category:
        # Keep system consistent even if client sends blank.
        normalized_category = "uncategorized"

    # If user sent "other" or left it uncategorized, let FAISS decide
    if normalized_category in ("other", "uncategorized"):
        result = categorize_merchant(
            expense.description or "",
            expense.description or "",
        )
        normalized_category = result["category"].lower()

    new_expense = Expense(
        amount=expense.amount,
        category=normalized_category,
        description=expense.description,
        note=(expense.note or None),
        date=expense.date,
        user_id=user_id
    )

    db.add(new_expense)
    db.commit()
    db.refresh(new_expense)

    return new_expense

@router.post("/categorize")
def suggest_category(
    payload: dict,
    current_user=Depends(get_current_user),
):
    """
    Quick endpoint the frontend calls while the user is typing.
    Body: { "merchant": "Swiggy", "description": "dinner" }
    Returns: { "category": "Food", "confidence": 0.95, "method": "faiss" }
    """
    merchant = payload.get("merchant", "")
    description = payload.get("description", "")
    return categorize_merchant(merchant, description)


@router.post("/recategorize")
def recategorize_expenses(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    """
    One-time re-categorization utility: re-runs the current FAISS/Groq/
    keyword categorization pipeline over every expense this user has, and
    updates the category only when the new result differs AND is high
    confidence (>= 0.8) — a low-confidence re-guess shouldn't silently
    overwrite a category the user (or an earlier import) already set.
    Idempotent: once categories converge, later runs update nothing.
    """
    expenses = db.query(Expense).filter(Expense.user_id == user_id).all()
    updated_count = 0

    for exp in expenses:
        text = exp.description or ""
        if not text.strip():
            continue
        result = categorize_merchant(text, text)
        new_category = str(result.get("category", "")).strip().lower()
        confidence = float(result.get("confidence", 0.0) or 0.0)
        current_category = (exp.category or "").strip().lower()
        if new_category and confidence >= 0.8 and new_category != current_category:
            exp.category = new_category
            updated_count += 1

    if updated_count:
        db.commit()

    return {"recategorized_count": updated_count, "total_checked": len(expenses)}

# ✅ GET ALL EXPENSES
@router.get("/", response_model=list[ExpenseResponse])
def get_expenses(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    return db.query(Expense).filter(Expense.user_id == user_id).all()


# ✅ 🔥 FIXED — RECENT MUST COME BEFORE dynamic route
@router.get("/recent", response_model=list[ExpenseResponse])
def get_recent_expenses(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    return (
        db.query(Expense)
        .filter(Expense.user_id == user_id)
        .order_by(Expense.created_at.desc())
        .limit(5)
        .all()
    )


# ✅ GET SINGLE EXPENSE
@router.get("/{expense_id}", response_model=ExpenseResponse)
def get_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.user_id == user_id
    ).first()

    if not expense:
        raise NotFoundException("Expense not found")

    return expense


# ✅ UPDATE EXPENSE
@router.put("/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: int,
    updated: ExpenseCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.user_id == user_id
    ).first()

    if not expense:
        raise NotFoundException("Expense not found")

    if updated.amount <= 0:
        raise BadRequestException("Amount must be greater than 0")

    expense.amount = updated.amount
    normalized_category = (updated.category or "").strip().lower()
    expense.category = normalized_category or "uncategorized"
    expense.description = updated.description
    expense.note = (updated.note or None)
    expense.date = updated.date or expense.date

    db.commit()
    db.refresh(expense)

    return expense


# ✅ DELETE EXPENSE
@router.delete("/{expense_id}")
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.user_id == user_id
    ).first()

    if not expense:
        raise NotFoundException("Expense not found")

    db.delete(expense)
    db.commit()

    return {"message": "Expense deleted successfully"}


