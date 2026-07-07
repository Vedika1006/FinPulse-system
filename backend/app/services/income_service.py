"""
Auto-fills recurring income for the current month — the salaried-user
safety net described in the recurring-income feature.

Design: a user marks one Income row as is_recurring=True to establish it as
the ongoing "default" (e.g. a monthly salary). Auto-created rows are always
saved with is_recurring=False, so editing one month's auto-filled amount
never cascades into future months — the most recently (re-)flagged row
always remains the template a future month falls back to.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app import models


def _advance_month(month: str) -> str:
    d = datetime.strptime(month, "%Y-%m")
    if d.month == 12:
        return f"{d.year + 1}-01"
    return f"{d.year}-{d.month + 1:02d}"


def process_recurring_income(
    db: Session,
    user_id: Optional[int] = None,
    month: Optional[str] = None,
) -> int:
    """
    For each user with a recurring income rule, auto-creates every missing
    Income record between that rule and the target month (inclusive) from
    the most recent is_recurring=True row. Safe to call repeatedly — the
    unique (user_id, month) constraint plus an explicit existence check
    before each insert make this idempotent.

    Returns the number of Income rows created.
    """
    target_month = month or datetime.utcnow().strftime("%Y-%m")

    query = db.query(models.Income).filter(models.Income.is_recurring == True)  # noqa: E712
    if user_id is not None:
        query = query.filter(models.Income.user_id == user_id)

    # Most-recent recurring row per user is that user's active template.
    candidates = query.order_by(models.Income.user_id, models.Income.month.desc()).all()

    seen_users: set[int] = set()
    created_count = 0
    for template in candidates:
        if template.user_id in seen_users:
            continue
        seen_users.add(template.user_id)

        cursor = _advance_month(template.month)
        while cursor <= target_month:
            existing = (
                db.query(models.Income)
                .filter(models.Income.user_id == template.user_id, models.Income.month == cursor)
                .first()
            )
            if not existing:
                db.add(
                    models.Income(
                        user_id=template.user_id,
                        month=cursor,
                        amount=template.amount,
                        is_recurring=False,
                        recurring_frequency=None,
                        auto_filled=True,
                    )
                )
                created_count += 1
            cursor = _advance_month(cursor)

    if created_count:
        db.commit()

    return created_count
