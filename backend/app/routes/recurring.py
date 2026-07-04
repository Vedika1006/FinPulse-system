from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app import models, schemas
from app.services.recurring_service import process_due_recurring

router = APIRouter(prefix="/recurring", tags=["Recurring"])


@router.get("", response_model=list[schemas.RecurringResponse])
def list_recurring(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    # Safety net: catch up on anything the daily scheduler missed
    # (server restart, deployment, etc.) before returning results.
    process_due_recurring(db, user_id=user_id)

    return (
        db.query(models.Recurring)
        .filter(models.Recurring.user_id == user_id, models.Recurring.is_active == True)  # noqa: E712
        .order_by(models.Recurring.next_due_date.asc())
        .all()
    )


@router.get("/upcoming", response_model=list[schemas.RecurringResponse])
def upcoming_recurring(
    days: int = 7,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    process_due_recurring(db, user_id=user_id)

    cutoff = date.today() + timedelta(days=days)
    return (
        db.query(models.Recurring)
        .filter(
            models.Recurring.user_id == user_id,
            models.Recurring.is_active == True,  # noqa: E712
            models.Recurring.next_due_date <= cutoff,
        )
        .order_by(models.Recurring.next_due_date.asc())
        .all()
    )


@router.post("", response_model=schemas.RecurringResponse)
def create_recurring(
    payload: schemas.RecurringCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    # Guard against duplicate tracking of the same subscription (e.g. the
    # client-side "already tracked" check missing a match after a price
    # change) — reuse the existing active row instead of creating another.
    existing = (
        db.query(models.Recurring)
        .filter(
            models.Recurring.user_id == user_id,
            models.Recurring.is_active == True,  # noqa: E712
            func.lower(models.Recurring.description) == payload.description.strip().lower(),
        )
        .first()
    )
    if existing:
        return existing

    item = models.Recurring(
        user_id=user_id,
        description=payload.description,
        amount=payload.amount,
        category=payload.category,
        frequency=payload.frequency,
        next_due_date=payload.next_due_date,
        is_active=True,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/{recurring_id}", response_model=schemas.RecurringResponse)
def update_recurring(
    recurring_id: int,
    payload: schemas.RecurringUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    item = (
        db.query(models.Recurring)
        .filter(models.Recurring.id == recurring_id, models.Recurring.user_id == user_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Recurring item not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/{recurring_id}")
def delete_recurring(
    recurring_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    item = (
        db.query(models.Recurring)
        .filter(models.Recurring.id == recurring_id, models.Recurring.user_id == user_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Recurring item not found")

    item.is_active = False
    db.commit()
    return {"message": "Recurring item cancelled"}
