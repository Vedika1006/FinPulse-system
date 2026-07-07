"""
Turns due Recurring items into real Expense rows.

Safe to call repeatedly (from the daily scheduler, or lazily from a GET
route) — a cycle is only ever processed once, since next_due_date is
advanced past "today" before the loop for that item ends.
"""
import difflib
from datetime import date, datetime, timedelta
from typing import Optional

from dateutil.relativedelta import relativedelta
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models

DUPLICATE_DATE_WINDOW_DAYS = 5
DUPLICATE_AMOUNT_TOLERANCE = 0.10  # ±10%
DUPLICATE_DESC_MIN_RATIO = 0.6


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


def _find_matching_expense(db: Session, item: "models.Recurring", due: date):
    """
    Looks for an expense that already covers this recurring cycle — e.g.
    from a CSV import or a manual entry — so process_due_recurring doesn't
    silently double a total that's already correct.

    Matches on: same user, same category, amount within ±10%, transaction
    date within ±5 days of the cycle's due date, AND a fuzzy/substring
    description match against the recurring item's merchant name. All of
    these must hold — amount+date proximity alone is not enough (a
    same-day, same-amount expense from a completely different merchant
    must NOT be treated as a duplicate).
    """
    window_start = datetime.combine(due - timedelta(days=DUPLICATE_DATE_WINDOW_DAYS), datetime.min.time())
    window_end = datetime.combine(due + timedelta(days=DUPLICATE_DATE_WINDOW_DAYS), datetime.max.time())
    amount = float(item.amount)
    amount_low = amount * (1 - DUPLICATE_AMOUNT_TOLERANCE)
    amount_high = amount * (1 + DUPLICATE_AMOUNT_TOLERANCE)
    effective_date = func.coalesce(models.Expense.date, models.Expense.created_at)

    candidates = (
        db.query(models.Expense)
        .filter(
            models.Expense.user_id == item.user_id,
            func.lower(models.Expense.category) == func.lower(item.category or ""),
            models.Expense.amount >= amount_low,
            models.Expense.amount <= amount_high,
            effective_date >= window_start,
            effective_date <= window_end,
        )
        .all()
    )
    if not candidates:
        return None

    item_desc = (item.description or "").strip().lower()
    if not item_desc:
        return candidates[0]

    for exp in candidates:
        exp_desc = (exp.description or "").strip().lower()
        if not exp_desc:
            continue
        if item_desc in exp_desc or exp_desc in item_desc:
            return exp
        if difflib.SequenceMatcher(None, item_desc, exp_desc).ratio() >= DUPLICATE_DESC_MIN_RATIO:
            return exp

    return None


def process_due_recurring(db: Session, user_id: Optional[int] = None) -> int:
    """
    Create an Expense for every cycle a recurring item has missed (not just
    the most recent one), advancing next_due_date through each cycle. If a
    matching expense already exists for a cycle (CSV import, manual entry),
    that cycle is skipped — next_due_date still advances, just without a
    duplicate Expense row.
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
            existing = _find_matching_expense(db, item, due)
            if existing is None:
                db.add(
                    models.Expense(
                        amount=float(item.amount),
                        category=item.category,
                        description=item.description,
                        note="Auto-tracked",
                        date=datetime.combine(due, datetime.min.time()),
                        user_id=item.user_id,
                    )
                )
                created_count += 1
            # Cycle is accounted for either way — advance past it so it's
            # never re-evaluated, whether we created it or found it already existed.
            item.next_due_date = _advance(due, item.frequency)

    db.commit()

    return created_count
