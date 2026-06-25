from datetime import date, timedelta, datetime
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


def _expense_day(exp: Expense) -> date:
    if exp.date is not None:
        d = exp.date
        return d.date() if isinstance(d, datetime) else d
    if exp.created_at is not None:
        return exp.created_at.date()
    return date.today()


def get_prophet_forecast(db: Session, user_id: int) -> dict:
    """
    Train Facebook Prophet on the user's daily expense totals.
    Returns 7-day and 30-day forecasts with 80% confidence intervals.
    Falls back to rule-based average if user has < 14 days of data
    or if Prophet is not installed / throws an error.
    """
    expenses = db.query(Expense).filter(Expense.user_id == user_id).all()

    if not expenses:
        return {"method": "no_data", "forecast_7": [], "forecast_30": [], "history": []}

    daily_totals: dict[date, float] = {}
    for exp in expenses:
        d = _expense_day(exp)
        daily_totals[d] = daily_totals.get(d, 0.0) + float(exp.amount)

    history_payload = [
        {"ds": k.strftime("%Y-%m-%d"), "y": round(v, 2)}
        for k, v in sorted(daily_totals.items())
    ]

    if len(daily_totals) < 14:
        return _rule_based_fallback(daily_totals, history_payload)

    try:
        import pandas as pd
        from prophet import Prophet

        df = pd.DataFrame([
            {"ds": pd.Timestamp(k), "y": v}
            for k, v in sorted(daily_totals.items())
        ])

        m = Prophet(
            daily_seasonality=False,
            weekly_seasonality=True,
            yearly_seasonality=len(daily_totals) >= 365,
            interval_width=0.80,
            changepoint_prior_scale=0.05,
        )
        m.fit(df)

        future = m.make_future_dataframe(periods=30, freq="D")
        forecast = m.predict(future)

        today_ts = pd.Timestamp(date.today())
        future_rows = forecast[forecast["ds"] > today_ts][
            ["ds", "yhat", "yhat_lower", "yhat_upper"]
        ].copy()

        future_rows["yhat"] = future_rows["yhat"].clip(lower=0)
        future_rows["yhat_lower"] = future_rows["yhat_lower"].clip(lower=0)
        future_rows["yhat_upper"] = future_rows["yhat_upper"].clip(lower=0)

        records = [
            {
                "ds": row["ds"].strftime("%Y-%m-%d"),
                "yhat": round(float(row["yhat"]), 2),
                "yhat_lower": round(float(row["yhat_lower"]), 2),
                "yhat_upper": round(float(row["yhat_upper"]), 2),
            }
            for _, row in future_rows.iterrows()
        ]

        return {
            "method": "prophet",
            "forecast_7": records[:7],
            "forecast_30": records[:30],
            "history": history_payload,
        }

    except Exception as e:
        print(f"[Prophet] Falling back to rule-based: {e}")
        return _rule_based_fallback(daily_totals, history_payload)


def _rule_based_fallback(daily_totals: dict, history_payload: list) -> dict:
    """
    Simple fallback: use the 7-day rolling average as a flat forecast line
    with ±30% confidence bands.
    """
    if not daily_totals:
        return {"method": "no_data", "forecast_7": [], "forecast_30": [], "history": []}

    recent_values = [v for _, v in sorted(daily_totals.items())]
    avg_daily = sum(recent_values[-7:]) / min(7, len(recent_values))

    today = date.today()
    forecast_7, forecast_30 = [], []

    for i in range(1, 31):
        day = today + timedelta(days=i)
        entry = {
            "ds": day.strftime("%Y-%m-%d"),
            "yhat": round(avg_daily, 2),
            "yhat_lower": round(avg_daily * 0.70, 2),
            "yhat_upper": round(avg_daily * 1.30, 2),
        }
        forecast_30.append(entry)
        if i <= 7:
            forecast_7.append(entry)

    return {
        "method": "rule_based",
        "forecast_7": forecast_7,
        "forecast_30": forecast_30,
        "history": history_payload,
    }