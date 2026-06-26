from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import datetime
from typing import Optional

from app.schemas import HealthScoreResponse, InsightResponse
from app.database import get_db
from app.models import Expense, Budget, Income
from app.core.security import get_current_user
from app.core.exceptions import BadRequestException
from app.services.ai_service import generate_financial_insight
from app.services.memory_service import get_or_refresh_user_memory
from app.services.analytics_service import get_prophet_forecast, get_isolation_forest_anomalies

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"]
)


def _parse_month(month: str) -> datetime:
    try:
        return datetime.strptime(month, "%Y-%m")
    except ValueError:
        raise BadRequestException("Month must be in YYYY-MM format")


def _compute_health_score(db: Session, user_id: int, month: str) -> dict:
    month_date = _parse_month(month)

    start_date = month_date.replace(day=1)

    if month_date.month == 12:
        end_date = month_date.replace(year=month_date.year + 1, month=1, day=1)
    else:
        end_date = month_date.replace(month=month_date.month + 1, day=1)

    total_expense = (
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(
            Expense.user_id == user_id,
            Expense.created_at >= start_date,
            Expense.created_at < end_date
        )
        .scalar()
    )

    total_budget = (
        db.query(func.coalesce(func.sum(func.coalesce(Budget.limit, Budget.amount)), 0))
        .filter(
            Budget.user_id == user_id,
            Budget.month == month
        )
        .scalar()
    )

    # Real income system (no fake/default income). If user hasn't added income for this month, treat income as 0.
    monthly_income = (
        db.query(func.coalesce(func.sum(Income.amount), 0))
        .filter(Income.user_id == user_id, Income.month == month)
        .scalar()
    ) or 0
    MONTHLY_INCOME = float(monthly_income)

    savings = MONTHLY_INCOME - float(total_expense or 0)
    savings_rate = (savings / MONTHLY_INCOME) * 100 if MONTHLY_INCOME > 0 else 0

    # If income isn't provided, we can't compute a meaningful savings rate; keep score neutral and explain.
    if MONTHLY_INCOME <= 0:
        savings_score = 60
    elif savings_rate >= 30:
        savings_score = 100
    elif savings_rate >= 20:
        savings_score = 80
    elif savings_rate >= 10:
        savings_score = 60
    elif savings_rate >= 5:
        savings_score = 40
    elif savings_rate > 0:
        savings_score = 20
    else:
        savings_score = 0

    if total_budget == 0:
        budget_score = 70
    elif total_expense <= total_budget:
        budget_score = 100
    else:
        overspend_percentage = ((total_expense - total_budget) / total_budget) * 100

        if overspend_percentage <= 10:
            budget_score = 80
        elif overspend_percentage <= 20:
            budget_score = 60
        else:
            budget_score = 40

    if month_date.month == 1:
        prev_month_date = month_date.replace(year=month_date.year - 1, month=12)
    else:
        prev_month_date = month_date.replace(month=month_date.month - 1)

    prev_start_date = prev_month_date.replace(day=1)

    if prev_month_date.month == 12:
        prev_end_date = prev_month_date.replace(year=prev_month_date.year + 1, month=1, day=1)
    else:
        prev_end_date = prev_month_date.replace(month=prev_month_date.month + 1, day=1)

    prev_total_expense = (
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(
            Expense.user_id == user_id,
            Expense.created_at >= prev_start_date,
            Expense.created_at < prev_end_date
        )
        .scalar()
    )

    if prev_total_expense == 0:
        stability_score = 75
    else:
        diff = abs(total_expense - prev_total_expense) / prev_total_expense * 100

        if diff < 10:
            stability_score = 100
        elif diff < 20:
            stability_score = 80
        elif diff < 30:
            stability_score = 60
        else:
            stability_score = 40

    health_score = (
        0.4 * savings_score +
        0.4 * budget_score +
        0.2 * stability_score
    )

    # Explainable health score (Phase 1: Trust System)
    total_expense_f = float(total_expense or 0)
    total_budget_f = float(total_budget or 0)
    prev_total_expense_f = float(prev_total_expense or 0)
    monthly_income_f = float(MONTHLY_INCOME or 0)
    savings_f = float(savings or 0)

    reasons: list[str] = []
    if MONTHLY_INCOME <= 0:
        reasons.append("No income added yet — add your monthly income to get accurate savings rate and score.")
    if total_budget_f > 0:
        delta = total_expense_f - total_budget_f
        delta_pct = (delta / total_budget_f) * 100
        if delta <= 0:
            reasons.append(
                f"Spending ₹{total_expense_f:.0f} is ₹{abs(delta):.0f} ({abs(delta_pct):.1f}%) under your ₹{total_budget_f:.0f} budget."
            )
        else:
            reasons.append(
                f"Spending ₹{total_expense_f:.0f} is ₹{delta:.0f} ({delta_pct:.1f}%) over your ₹{total_budget_f:.0f} budget."
            )
    else:
        reasons.append(f"No budget set — score assumes a baseline budget adherence of {budget_score}/100.")

    if monthly_income_f > 0:
        reasons.append(
            f"Savings rate is {float(savings_rate):.1f}% (₹{savings_f:.0f} saved out of ₹{monthly_income_f:.0f})."
        )

    if prev_total_expense_f > 0:
        mom_pct = ((total_expense_f - prev_total_expense_f) / prev_total_expense_f) * 100
        reasons.append(
            f"Month-over-month spending changed {mom_pct:+.1f}% (₹{prev_total_expense_f:.0f} → ₹{total_expense_f:.0f})."
        )

    insights = generate_financial_insight(
        total_expense,
        total_budget,
        savings_rate,
        top_category=None
    )

    # Update light user memory in the background of analytics calls (Phase 3).
    try:
        get_or_refresh_user_memory(db, user_id, month=month)
    except Exception:
        # Memory must never break core analytics.
        pass

    return {
        "month": month,
        "health_score": round(health_score, 2),
        "score": round(health_score, 2),
        "breakdown": {
            "spending_control": float(stability_score),
            "budget_adherence": float(budget_score),
            "savings_rate": float(savings_score),
        },
        "reasons": reasons[:4],
        "savings_rate": round(savings_rate, 2),
        "savings_score": savings_score,
        "budget_score": budget_score,
        "stability_score": stability_score,
        "insights": insights
    }


@router.get("/memory/", response_model=dict)
def get_user_memory(
    month: Optional[str] = Query(None, description="YYYY-MM (optional)"),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    """
    Light AI memory for personalization (Phase 3).
    """
    m = month or datetime.utcnow().strftime("%Y-%m")
    row = get_or_refresh_user_memory(db, user_id, month=m)
    return {
        "frequent_category": row.frequent_category,
        "habit": row.habit,
        "meta": row.meta or {},
        "updated_at": row.updated_at,
    }


@router.get(
    "/health-score/",
    response_model=HealthScoreResponse,
    summary="Financial health score (optional ?month=YYYY-MM, defaults to current month UTC)",
)
def get_health_score_root(
    month: Optional[str] = Query(None, description="YYYY-MM"),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    m = month or datetime.utcnow().strftime("%Y-%m")
    return _compute_health_score(db, user_id, m)


@router.get(
    "/health-score/{month}/",
    response_model=HealthScoreResponse,
    summary="Financial health score for a given month",
)
def get_health_score(
    month: str,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    return _compute_health_score(db, user_id, month)


def _top_category_in_range(
    db: Session, user_id: int, start_date: datetime, end_date: datetime
):
    row = (
        db.query(func.lower(Expense.category), func.sum(Expense.amount))
        .filter(
            Expense.user_id == user_id,
            Expense.created_at >= start_date,
            Expense.created_at < end_date,
        )
        .group_by(func.lower(Expense.category))
        .order_by(func.sum(Expense.amount).desc())
        .first()
    )
    if not row:
        return None
    return {"category": row[0], "total": float(row[1])}


@router.get("/insight/", response_model=InsightResponse)
def get_insight(
    month: Optional[str] = Query(None, description="YYYY-MM"),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    m = month or datetime.utcnow().strftime("%Y-%m")
    month_date = _parse_month(m)
    start_date = month_date.replace(day=1)
    if month_date.month == 12:
        end_date = month_date.replace(year=month_date.year + 1, month=1, day=1)
    else:
        end_date = month_date.replace(month=month_date.month + 1, day=1)

    total_expense = (
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(
            Expense.user_id == user_id,
            Expense.created_at >= start_date,
            Expense.created_at < end_date,
        )
        .scalar()
    ) or 0

    total_budget = (
        db.query(func.coalesce(func.sum(func.coalesce(Budget.limit, Budget.amount)), 0))
        .filter(Budget.user_id == user_id, Budget.month == m)
        .scalar()
    ) or 0

    monthly_income = (
        db.query(func.coalesce(func.sum(Income.amount), 0))
        .filter(Income.user_id == user_id, Income.month == m)
        .scalar()
    ) or 0
    MONTHLY_INCOME = float(monthly_income)
    savings = MONTHLY_INCOME - float(total_expense)
    savings_rate = (savings / MONTHLY_INCOME) * 100 if MONTHLY_INCOME > 0 else 0

    top = _top_category_in_range(db, user_id, start_date, end_date)

    insights = generate_financial_insight(
        float(total_expense),
        float(total_budget),
        savings_rate,
        top_category=top,
    )

    return {"month": m, "insights": insights}


@router.get("/monthly-trend/")
def monthly_trend(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    result = (
        db.query(
            extract("month", Expense.created_at).label("month"),
            func.sum(Expense.amount).label("total")
        )
        .filter(Expense.user_id == user_id)
        .group_by("month")
        .order_by("month")
        .all()
    )

    return [{"month": int(r[0]), "total": float(r[1])} for r in result]


@router.get("/category-comparison/")
def category_comparison(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    result = (
        db.query(
            func.lower(Expense.category).label("category"),
            func.sum(Expense.amount).label("total")
        )
        .filter(Expense.user_id == user_id)
        .group_by(func.lower(Expense.category))
        .order_by(func.sum(Expense.amount).desc())
        .all()
    )

    return [{"category": r[0], "total": float(r[1])} for r in result]

@router.get("/forecast")
def forecast(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    """
    Returns Prophet (or rule-based fallback) spending forecast.
    Response shape:
    {
      method: "prophet" | "rule_based" | "no_data",
      forecast_7:  [{ ds, yhat, yhat_lower, yhat_upper }, ...],
      forecast_30: [{ ds, yhat, yhat_lower, yhat_upper }, ...],
      history:     [{ ds, y }, ...]
    }
    """
    return get_prophet_forecast(db, user_id)

@router.get("/behavior")
def get_behavior_fingerprint(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    now = datetime.utcnow()
    month_str = now.strftime("%Y-%m")
    
    income_val = db.query(func.coalesce(func.sum(Income.amount), 0)).filter(
        Income.user_id == user_id,
        Income.month == month_str
    ).scalar()
    total_income = float(income_val or 0.0)

    history = db.query(
        extract('year', Expense.created_at).label('year'),
        extract('month', Expense.created_at).label('month'),
        func.sum(Expense.amount).label('total')
    ).filter(
        Expense.user_id == user_id
    ).group_by('year', 'month').order_by('year', 'month').all()
    
    recent_3 = history[-3:] if history else []
    
    current_expense = 0.0
    if recent_3 and int(recent_3[-1].year) == now.year and int(recent_3[-1].month) == now.month:
        current_expense = float(recent_3[-1].total)
        
    top_cat = db.query(
        Expense.category,
        func.sum(Expense.amount).label('total')
    ).filter(
        Expense.user_id == user_id,
        extract('year', Expense.created_at) == now.year,
        extract('month', Expense.created_at) == now.month
    ).group_by(Expense.category).order_by(func.sum(Expense.amount).desc()).first()
    
    top_category = top_cat[0] if top_cat else "None"
    
    savings_rate = 0.0
    if total_income > 0:
        savings_rate = (total_income - current_expense) / total_income
        
    behavior_type = "Balanced"
    insight = "You are maintaining a balanced financial profile without extreme spikes."
    
    is_lifestyle_creep = False
    if len(recent_3) == 3:
        if float(recent_3[0].total) < float(recent_3[1].total) < float(recent_3[2].total):
            is_lifestyle_creep = True
            
    is_impulse = False
    if len(recent_3) >= 2:
        for i in range(1, len(recent_3)):
            prev = float(recent_3[i-1].total)
            curr = float(recent_3[i].total)
            if prev > 0 and (curr - prev) / prev > 0.5:
                is_impulse = True
                break

    if is_impulse:
        behavior_type = "Impulse Spender"
        insight = "We're seeing sudden spikes in your spending. Watch out for impulse purchases!"
    elif is_lifestyle_creep:
        behavior_type = "Lifestyle Creep"
        insight = "Your expenses are increasing every month. Make sure your income keeps up."
    elif savings_rate > 0.25:
        behavior_type = "Saver"
        insight = "Great job! You are saving a significant portion of your income."
        
    return {
        "type": behavior_type,
        "savings_rate": savings_rate,
        "top_category": top_category,
        "insight": insight
    }

"""@router.get("/anomalies")
def get_expense_anomalies(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user)
):
    import math
    from collections import defaultdict
    now = datetime.utcnow()
    
    expenses = db.query(Expense).filter(Expense.user_id == user_id).all()
    if not expenses:
        return {"anomalies": []}
        
    category_data = defaultdict(list)
    current_month_expenses = []
    
    for exp in expenses:
        category = exp.category.lower()
        amount = float(exp.amount)
        if exp.created_at.year == now.year and exp.created_at.month == now.month:
            current_month_expenses.append(exp)
        else:
            category_data[category].append(amount)
            
    anomalies = []
    
    for exp in current_month_expenses:
        cat = exp.category.lower()
        amount = float(exp.amount)
        hist = category_data.get(cat, [])
        
        if len(hist) < 2:
            if len(hist) == 1:
                mean = hist[0]
                if mean > 0 and amount > mean * 1.5:
                    ratio = amount / mean
                    severity = "high" if ratio > 3 else "medium" if ratio > 2 else "low"
                    anomalies.append({
                        "amount": amount,
                        "category": exp.category,
                        "date": exp.created_at.strftime("%Y-%m-%d"),
                        "reason": f"You spent {ratio:.1f}x more than your previous record.",
                        "severity": severity
                    })
            continue
            
        mean = sum(hist) / len(hist)
        variance = sum((x - mean) ** 2 for x in hist) / len(hist)
        std_dev = math.sqrt(variance)
        
        if std_dev == 0:
            if mean > 0 and amount > mean * 1.5:
                ratio = amount / mean
                severity = "high" if ratio > 3 else "medium" if ratio > 2 else "low"
                anomalies.append({
                    "amount": amount,
                    "category": exp.category,
                    "date": exp.created_at.strftime("%Y-%m-%d"),
                    "reason": f"You spent {ratio:.1f}x your usual amount.",
                    "severity": severity
                })
            continue
            
        z_score = (amount - mean) / std_dev
        
        if z_score > 2:
            severity = "high" if z_score > 3 else "medium"
            anomalies.append({
                "amount": amount,
                "category": exp.category,
                "date": exp.created_at.strftime("%Y-%m-%d"),
                "reason": f"This is unusually high. Typical spend is around ₹{mean:.0f}.",
                "severity": severity
            })

    severity_order = {"high": 1, "medium": 2, "low": 3}
    anomalies.sort(key=lambda x: severity_order.get(x["severity"], 4))
            
    return {"anomalies": anomalies}
"""
@router.get("/anomalies")
def get_expense_anomalies(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    """
    Returns statistically anomalous expenses using Isolation Forest (sklearn).
    Each anomaly includes expense_id so the frontend can badge individual rows.
    Falls back gracefully if data is insufficient or sklearn is unavailable.
    """
    return get_isolation_forest_anomalies(db, user_id)