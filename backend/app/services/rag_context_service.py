"""
Builds a natural-language summary of a user's financial situation for use as
LLM context (RAG). Reads directly from the DB — no persistence, no caching.
"""
import calendar
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import Expense, Budget, Income, Goal, User
from app.services.analytics_service import get_isolation_forest_anomalies


def _month_bounds(now: datetime):
    cur_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if cur_start.month == 12:
        next_start = cur_start.replace(year=cur_start.year + 1, month=1)
    else:
        next_start = cur_start.replace(month=cur_start.month + 1)
    if cur_start.month == 1:
        prev_start = cur_start.replace(year=cur_start.year - 1, month=12)
    else:
        prev_start = cur_start.replace(month=cur_start.month - 1)
    prev_end = cur_start
    return cur_start, next_start, prev_start, prev_end


def _effective_date(exp: Expense):
    # Prefer the user-entered transaction date; fall back to row insert time
    # only for legacy rows created before the `date` column existed.
    return exp.date if exp.date is not None else exp.created_at


def _format_inr(amount: float) -> str:
    n = int(round(amount))
    sign = "-" if n < 0 else ""
    n = abs(n)
    s = str(n)
    if len(s) <= 3:
        grouped = s
    else:
        last3 = s[-3:]
        rest = s[:-3]
        parts = []
        while len(rest) > 2:
            parts.insert(0, rest[-2:])
            rest = rest[:-2]
        if rest:
            parts.insert(0, rest)
        grouped = ",".join(parts) + "," + last3
    return f"{sign}₹{grouped}"


def _title(category: str) -> str:
    v = (category or "uncategorized").strip()
    parts = [p for p in v.replace("_", " ").replace("-", " ").split(" ") if p]
    return " ".join(p[:1].upper() + p[1:].lower() for p in parts) or "Uncategorized"


def _safe_to_spend_today(total_income: float, total_expenses: float, total_budget: float, now: datetime) -> float:
    # Mirrors frontend/src/components/dashboard/HeroBanner.jsx: reserve = budgets,
    # else 30% of income; split what's left over the days remaining in the month.
    days_in_month = calendar.monthrange(now.year, now.month)[1]
    days_remaining = days_in_month - now.day + 1
    reserved = total_budget if total_budget > 0 else total_income * 0.3
    available = max(total_income - reserved - total_expenses, 0.0)
    return round(available / days_remaining) if days_remaining > 0 else 0.0


def build_user_context(user_id: int, db: Session) -> str:
    try:
        user = db.query(User).filter(User.id == user_id).first()
        first_name = "there"
        if user and user.name and user.name.strip():
            first_name = user.name.strip().split()[0].title()

        all_expenses = db.query(Expense).filter(Expense.user_id == user_id).all()
        any_income = db.query(Income.id).filter(Income.user_id == user_id).first()
        any_goals = db.query(Goal.id).filter(Goal.user_id == user_id).first()

        if not all_expenses and not any_income and not any_goals:
            return (
                f"{first_name} has just started tracking finances on FinPulse and has no "
                "expense, income, or goal history yet. There is nothing to compare against, "
                "so encourage them to log a few transactions and set a budget to unlock "
                "personalized insights."
            )

        now = datetime.utcnow()
        cur_start, next_start, prev_start, prev_end = _month_bounds(now)
        month_key = cur_start.strftime("%Y-%m")
        prev_month_key = prev_start.strftime("%Y-%m")
        month_label = cur_start.strftime("%B %Y")
        prev_month_label = prev_start.strftime("%B %Y")

        this_month_expenses = [e for e in all_expenses if _effective_date(e) and cur_start <= _effective_date(e) < next_start]
        last_month_expenses = [e for e in all_expenses if _effective_date(e) and prev_start <= _effective_date(e) < prev_end]

        total_expense = sum(float(e.amount) for e in this_month_expenses)
        last_month_expense_total = sum(float(e.amount) for e in last_month_expenses)

        total_income = float(
            db.query(func.coalesce(func.sum(Income.amount), 0))
            .filter(Income.user_id == user_id, Income.month == month_key)
            .scalar() or 0
        )
        last_month_income = float(
            db.query(func.coalesce(func.sum(Income.amount), 0))
            .filter(Income.user_id == user_id, Income.month == prev_month_key)
            .scalar() or 0
        )

        savings = total_income - total_expense
        savings_rate = (savings / total_income * 100) if total_income > 0 else 0.0
        last_month_savings = last_month_income - last_month_expense_total

        cat_totals: dict[str, float] = {}
        for e in this_month_expenses:
            cat = (e.category or "uncategorized").strip().lower()
            cat_totals[cat] = cat_totals.get(cat, 0.0) + float(e.amount)
        top_categories = sorted(cat_totals.items(), key=lambda kv: kv[1], reverse=True)[:5]

        budget_rows = db.query(Budget).filter(Budget.user_id == user_id, Budget.month == month_key).all()
        total_budget = sum(float(b.limit if b.limit is not None else b.amount) for b in budget_rows)
        budget_lines = []
        for b in budget_rows:
            limit_amt = float(b.limit if b.limit is not None else b.amount)
            spent = cat_totals.get((b.category or "").strip().lower(), 0.0)
            status = "over" if spent > limit_amt else "under"
            budget_lines.append((_title(b.category), limit_amt, spent, status))

        goals = db.query(Goal).filter(Goal.user_id == user_id).all()
        active_goals = [g for g in goals if float(g.saved_amount or 0) < float(g.target_amount or 0)]

        try:
            anomaly_result = get_isolation_forest_anomalies(db, user_id)
            anomalies = anomaly_result.get("anomalies", []) or []
        except Exception:
            anomalies = []
        recent_anomalies = sorted(anomalies, key=lambda a: a.get("date", ""), reverse=True)[:5]

        safe_to_spend = _safe_to_spend_today(total_income, total_expense, total_budget, now)

        paragraphs: list[str] = []

        overview = (
            f"This month ({month_label}), {first_name} earned {_format_inr(total_income)} and has spent "
            f"{_format_inr(total_expense)} so far. That leaves {_format_inr(savings)} in savings, "
            f"a savings rate of {savings_rate:.1f}%. Based on remaining income after budgets (or 30% "
            f"reserved if no budgets are set), it's safe to spend about {_format_inr(safe_to_spend)} per "
            "day for the rest of the month."
        )
        paragraphs.append(overview)

        if top_categories:
            cat_text = ", ".join(f"{_title(c)} ({_format_inr(v)})" for c, v in top_categories)
            paragraphs.append(f"Top spending categories this month are: {cat_text}.")
        else:
            paragraphs.append("No expenses have been logged yet this month.")

        if budget_lines:
            b_text = "; ".join(
                f"{cat} — spent {_format_inr(spent)} of a {_format_inr(limit)} limit ({status} budget)"
                for cat, limit, spent, status in budget_lines
            )
            paragraphs.append(f"Budget status by category: {b_text}.")
        else:
            paragraphs.append("No budgets are set for this month.")

        if active_goals:
            g_text = "; ".join(
                f"'{g.name}' — {_format_inr(float(g.saved_amount or 0))} saved of a "
                f"{_format_inr(float(g.target_amount or 0))} target "
                f"({(float(g.saved_amount or 0) / float(g.target_amount)) * 100:.0f}% complete)"
                for g in active_goals
                if float(g.target_amount or 0) > 0
            )
            if g_text:
                paragraphs.append(f"Active savings goals: {g_text}.")
        else:
            paragraphs.append("There are no active savings goals right now.")

        if recent_anomalies:
            a_text = " ".join(
                f"On {a.get('date')}, {a.get('reason', 'an unusual expense was flagged')}"
                for a in recent_anomalies
            )
            paragraphs.append(f"Recent unusual spending flagged by anomaly detection: {a_text}")

        comparison = (
            f"Last month ({prev_month_label}), {first_name} earned {_format_inr(last_month_income)}, spent "
            f"{_format_inr(last_month_expense_total)}, and saved {_format_inr(last_month_savings)}."
        )
        paragraphs.append(comparison)

        return "\n\n".join(paragraphs)
    except Exception:
        return "This user has just started tracking, no financial history yet."
