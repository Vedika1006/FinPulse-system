from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.core.security import get_current_user
from app.core.exceptions import BadRequestException, NotFoundException
from app import models, schemas
from app.services.income_service import process_recurring_income

router = APIRouter(prefix="/income", tags=["Income"])


@router.post("/", response_model=schemas.IncomeWithAutoSavesResponse)
def upsert_income(
    payload: schemas.IncomeCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    row = (
        db.query(models.Income)
        .filter(models.Income.user_id == user_id, models.Income.month == payload.month)
        .first()
    )
    is_new = row is None
    if row is None:
        row = models.Income(
            user_id=user_id,
            month=payload.month,
            amount=float(payload.amount),
            is_recurring=payload.is_recurring,
            recurring_frequency=payload.recurring_frequency if payload.is_recurring else None,
        )
        db.add(row)
    else:
        row.amount = float(payload.amount)
        row.is_recurring = payload.is_recurring
        row.recurring_frequency = payload.recurring_frequency if payload.is_recurring else None
        # This is a deliberate user edit — it's no longer just an unconfirmed auto-fill.
        row.auto_filled = False

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise BadRequestException("Could not save income for this month") from None

    db.refresh(row)

    # Apply auto-save rules only when income is first created for a month
    auto_saves: list[dict] = []
    if is_new:
        rules = (
            db.query(models.AutoSaveRule)
            .filter(models.AutoSaveRule.user_id == user_id)
            .all()
        )
        for rule in rules:
            goal = db.query(models.Goal).filter(
                models.Goal.id == rule.goal_id,
                models.Goal.user_id == user_id,
            ).first()
            if not goal:
                continue
            if rule.type == "fixed":
                save_amount = round(rule.value, 2)
            else:  # percent
                save_amount = round((rule.value / 100.0) * float(payload.amount), 2)
            if save_amount <= 0:
                continue
            goal.saved_amount = round((goal.saved_amount or 0.0) + save_amount, 2)
            auto_saves.append({"goal_name": goal.name, "amount": save_amount})

        if auto_saves:
            db.commit()

    return {
        "id": row.id,
        "month": row.month,
        "amount": row.amount,
        "is_recurring": row.is_recurring,
        "recurring_frequency": row.recurring_frequency,
        "auto_filled": row.auto_filled,
        "auto_saves": auto_saves,
    }


@router.get("/", response_model=list[schemas.IncomeResponse])
def list_income(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    return (
        db.query(models.Income)
        .filter(models.Income.user_id == user_id)
        .order_by(models.Income.month.desc())
        .all()
    )


@router.get("/{month}/", response_model=schemas.IncomeResponse)
def get_income_for_month(
    month: str,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    # Safety net: auto-fill this month's income from a recurring rule before
    # looking it up, same lazy pattern as process_due_recurring for expenses.
    process_recurring_income(db, user_id=user_id, month=month)

    row = (
        db.query(models.Income)
        .filter(models.Income.user_id == user_id, models.Income.month == month)
        .first()
    )
    if not row:
        raise NotFoundException("Income not found for this month")
    return row
