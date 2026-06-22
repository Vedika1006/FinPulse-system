from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Expense
from app.schemas import ExpenseCreate, ExpenseResponse
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.security import get_current_user

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