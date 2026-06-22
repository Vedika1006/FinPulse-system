from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.core.security import get_current_user
from app.core.exceptions import BadRequestException, NotFoundException
from app import models, schemas

router = APIRouter(prefix="/income", tags=["Income"])


@router.post("/", response_model=schemas.IncomeResponse)
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
    if row is None:
        row = models.Income(user_id=user_id, month=payload.month, amount=float(payload.amount))
        db.add(row)
    else:
        row.amount = float(payload.amount)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise BadRequestException("Could not save income for this month") from None

    db.refresh(row)
    return row


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
    row = (
        db.query(models.Income)
        .filter(models.Income.user_id == user_id, models.Income.month == month)
        .first()
    )
    if not row:
        raise NotFoundException("Income not found for this month")
    return row

