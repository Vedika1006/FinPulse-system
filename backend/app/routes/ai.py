import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime

from app.core.security import get_current_user
from app.schemas import AIChatRequest, AIChatResponse, AIExpenseParseRequest, AIExpenseParseResponse
from app.services.ai_service import generate_chat_reply, parse_expense_from_text
from app.database import get_db
from app.services.memory_service import get_or_refresh_user_memory
from app import models
from app.models import Expense, Budget, Income

router = APIRouter(prefix="/ai", tags=["AI"])
logger = logging.getLogger("uvicorn.error")


def _parse_month_or_now(value: str | None) -> str:
    if value and isinstance(value, str):
        v = value.strip()
        if v:
            return v
    return datetime.utcnow().strftime("%Y-%m")


def _month_range(month: str) -> tuple[datetime, datetime]:
    start = datetime.strptime(month, "%Y-%m").replace(day=1)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1, day=1)
    else:
        end = start.replace(month=start.month + 1, day=1)
    return start, end


@router.post("/chat", response_model=AIChatResponse)
def ai_chat(
    payload: AIChatRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    memory = None
    try:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        row = get_or_refresh_user_memory(db, user_id)
        memory = {
            "name": (user.name if user else None),
            "frequent_category": row.frequent_category,
            "habit": row.habit,
            "meta": row.meta or {},
        }
    except Exception:
        memory = None

    # Enrich chat with a trusted backend snapshot so the model can't invent numbers.
    data = payload.data if isinstance(payload.data, dict) else {}
    month = _parse_month_or_now(data.get("month") if isinstance(data, dict) else None)
    try:
        start, end = _month_range(month)

        effective_date = func.coalesce(Expense.date, Expense.created_at)

        total_expense = (
            db.query(func.coalesce(func.sum(Expense.amount), 0))
            .filter(Expense.user_id == user_id, effective_date >= start, effective_date < end)
            .scalar()
        ) or 0

        breakdown_rows = (
            db.query(func.lower(Expense.category), func.coalesce(func.sum(Expense.amount), 0))
            .filter(Expense.user_id == user_id, effective_date >= start, effective_date < end)
            .group_by(func.lower(Expense.category))
            .all()
        )
        category_breakdown = {str(c or "uncategorized"): float(v or 0) for c, v in breakdown_rows if float(v or 0) > 0}

        budget_rows = (
            db.query(func.lower(Budget.category), func.coalesce(func.sum(func.coalesce(Budget.limit, Budget.amount)), 0))
            .filter(Budget.user_id == user_id, Budget.month == month)
            .group_by(func.lower(Budget.category))
            .all()
        )
        budgets = {str(c or "uncategorized"): float(v or 0) for c, v in budget_rows if float(v or 0) > 0}

        income_total = (
            db.query(func.coalesce(func.sum(Income.amount), 0))
            .filter(Income.user_id == user_id, Income.month == month)
            .scalar()
        ) or 0

        # Optional: attach computed health score (re-use existing logic)
        try:
            from app.routes.analytics import _compute_health_score  # local import avoids circular at module import time

            health = _compute_health_score(db, user_id, month)
        except Exception:
            health = None

        enriched = {
            **data,
            "month": month,
            "income": float(income_total or 0),
            "total_expense": float(total_expense or 0),
            "category_breakdown": category_breakdown,
            "budget_data": budgets,
            "health": health,
        }
    except Exception:
        enriched = data

    # RAG: attach the user's real financial context + relevant Indian finance
    # knowledge. Either can fail independently without breaking the chat —
    # generate_chat_reply falls back to its original (non-RAG) prompt when
    # rag_context is empty.
    rag_context = None
    try:
        from app.services.rag_context_service import build_user_context

        rag_context = build_user_context(user_id, db)
    except Exception:
        rag_context = None

    knowledge_chunks = None
    try:
        from app.services.rag_knowledge_base import retrieve_relevant_knowledge

        knowledge_chunks = retrieve_relevant_knowledge(payload.message)
    except Exception:
        knowledge_chunks = None

    return {
        "reply": generate_chat_reply(
            payload.message,
            context=payload.context,
            data=enriched,
            memory=memory,
            rag_context=rag_context,
            knowledge_chunks=knowledge_chunks,
            history=payload.history,
        )
    }


from fastapi import HTTPException

@router.post("/parse-expense", response_model=AIExpenseParseResponse)
def parse_expense(
    payload: AIExpenseParseRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    try:
        result = parse_expense_from_text(payload.text)
        return result
    except Exception as e:
        logger.error(f"AI error: {e}")
        raise HTTPException(
            status_code=400,
            detail="Could not understand that expense. Try a simpler format like '500 food lunch'.",
        )
