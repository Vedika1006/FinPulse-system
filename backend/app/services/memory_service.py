from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Budget, Expense, UserMemory


def _current_month_utc() -> str:
    return datetime.utcnow().strftime("%Y-%m")


def compute_user_memory(db: Session, user_id: int, month: Optional[str] = None) -> dict[str, Any]:
    """
    Compute simple, explainable behavioral patterns.
    - frequent_category: highest total spend over last 30 days
    - habit: overspending vs within budget (based on current month totals)
    - meta: small numeric signals
    """
    now = datetime.utcnow()
    since = now - timedelta(days=30)
    m = month or _current_month_utc()

    top = (
        db.query(Expense.category, func.sum(Expense.amount).label("total"))
        .filter(Expense.user_id == user_id, Expense.created_at >= since)
        .group_by(Expense.category)
        .order_by(func.sum(Expense.amount).desc())
        .first()
    )

    frequent_category = top[0] if top else None
    top_total = float(top[1]) if top else 0.0

    total_30 = (
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(Expense.user_id == user_id, Expense.created_at >= since)
        .scalar()
    ) or 0
    total_30_f = float(total_30)

    total_expense_month = (
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(Expense.user_id == user_id, Expense.created_at >= datetime.strptime(m, "%Y-%m").replace(day=1))
        .scalar()
    ) or 0
    total_expense_month_f = float(total_expense_month)

    total_budget_month = (
        db.query(func.coalesce(func.sum(Budget.amount), 0))
        .filter(Budget.user_id == user_id, Budget.month == m)
        .scalar()
    ) or 0
    total_budget_month_f = float(total_budget_month)

    habit = "steady"
    if total_budget_month_f > 0 and total_expense_month_f > total_budget_month_f:
        habit = "overspending"
    elif total_budget_month_f > 0 and total_expense_month_f <= total_budget_month_f:
        habit = "budgeting well"

    top_share_pct = (top_total / total_30_f * 100) if total_30_f > 0 else 0.0

    return {
        "frequent_category": frequent_category,
        "habit": habit,
        "meta": {
            "window_days": 30,
            "top_category_total": round(top_total, 2),
            "top_category_share_pct": round(top_share_pct, 1),
            "month": m,
            "month_total_expense": round(total_expense_month_f, 2),
            "month_total_budget": round(total_budget_month_f, 2),
            "month_overspend": round(max(0.0, total_expense_month_f - total_budget_month_f), 2),
        },
    }


def upsert_user_memory(db: Session, user_id: int, computed: dict[str, Any]) -> UserMemory:
    row = db.query(UserMemory).filter(UserMemory.user_id == user_id).first()
    if row is None:
        row = UserMemory(user_id=user_id)
        db.add(row)

    row.frequent_category = computed.get("frequent_category")
    row.habit = computed.get("habit")
    row.meta = computed.get("meta")
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return row


def get_or_refresh_user_memory(db: Session, user_id: int, month: Optional[str] = None) -> UserMemory:
    row = db.query(UserMemory).filter(UserMemory.user_id == user_id).first()
    # Refresh if older than 24h (keeps it "light" and cheap)
    if row and row.updated_at and (datetime.utcnow() - row.updated_at) < timedelta(hours=24):
        return row

    computed = compute_user_memory(db, user_id, month=month)
    return upsert_user_memory(db, user_id, computed)

