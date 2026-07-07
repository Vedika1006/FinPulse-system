"""
Turns due Recurring items into real Expense rows.

Safe to call repeatedly (from the daily scheduler, or lazily from a GET
route) — a cycle is only ever processed once, since next_due_date is
advanced past "today" before the loop for that item ends.
"""
from datetime import date, datetime, timedelta
from typing import Optional

from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session

from app import models


def _advance(current: date, frequency: str) -> date:
    freq = (frequency or "").strip().lower()
    if freq == "weekly":
        return current + timedelta(days=7)
    if freq == "quarterly":
        return current + relativedelta(months=3)
    if freq == "yearly":
        return current + relativedelta(years=1)
    # "monthly" and any unrecognized value fall back to monthly, so a bad
    # frequency value can never spin the while-loop below forever.
    return current + relativedelta(months=1)


def process_due_recurring(db: Session, user_id: Optional[int] = None) -> int:
    """
    Create an Expense for every cycle a recurring item has missed (not just
    the most recent one), advancing next_due_date through each cycle.
    Returns the number of expenses auto-created.
    """
    query = db.query(models.Recurring).filter(
        models.Recurring.is_active == True,  # noqa: E712
        models.Recurring.is_paused == False,  # noqa: E712
    )
    if user_id is not None:
        query = query.filter(models.Recurring.user_id == user_id)

    today = date.today()
    created_count = 0

    for item in query.all():
        while item.next_due_date is not None and item.next_due_date <= today:
            due = item.next_due_date
            db.add(
                models.Expense(
                    amount=float(item.amount),
                    category=item.category,
                    description=item.description,
                    date=datetime.combine(due, datetime.min.time()),
                    user_id=item.user_id,
                )
            )
            item.next_due_date = _advance(due, item.frequency)
            created_count += 1

    if created_count:
        db.commit()

    return created_count
