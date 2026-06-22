from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Expense


def get_category_spending(db: Session, user_id: int):
    result = (
        db.query(
            Expense.category,
            func.sum(Expense.amount).label("total")
        )
        .filter(Expense.user_id == user_id)
        .group_by(Expense.category)
        .all()
    )

    return [{"category": r[0], "total": float(r[1])} for r in result]


def get_total_spending(db: Session, user_id: int):
    total = (
        db.query(func.sum(Expense.amount))
        .filter(Expense.user_id == user_id)
        .scalar()
    )

    return total or 0


def get_top_category(db: Session, user_id: int):
    result = (
        db.query(
            Expense.category,
            func.sum(Expense.amount).label("total")
        )
        .filter(Expense.user_id == user_id)
        .group_by(Expense.category)
        .order_by(func.sum(Expense.amount).desc())
        .first()
    )

    if not result:
        return None

    return {"category": result[0], "total": float(result[1])}