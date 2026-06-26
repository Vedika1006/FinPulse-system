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

def get_isolation_forest_anomalies(db: Session, user_id: int) -> dict:
    """
    Isolation Forest anomaly detection on all user expenses.
    Features: [amount, category_label_encoded].
    Returns flagged expenses with expense_id so the frontend can badge rows directly.
    Falls back gracefully if sklearn is absent or data is insufficient (< 10 expenses).
    """
    expenses = db.query(Expense).filter(Expense.user_id == user_id).all()

    if len(expenses) < 10:
        return {
            "anomalies": [],
            "method": "insufficient_data",
            "message": (
                f"Need at least 10 expenses for anomaly detection "
                f"(you have {len(expenses)})."
            ),
            "total_expenses_analyzed": len(expenses),
        }

    try:
        import numpy as np
        from sklearn.ensemble import IsolationForest
        from sklearn.preprocessing import LabelEncoder
        from collections import defaultdict

        amounts = np.array([float(exp.amount) for exp in expenses])
        categories = [exp.category.lower() for exp in expenses]

        le = LabelEncoder()
        cat_encoded = le.fit_transform(categories).astype(float)

        X = np.column_stack([amounts, cat_encoded])

        # Contamination: how many we expect to be anomalies.
        # Clamp between 5–15 % so we're not too noisy on small datasets.
        contamination = float(min(0.15, max(0.05, 8.0 / len(expenses))))

        clf = IsolationForest(
            n_estimators=100,
            contamination=contamination,
            random_state=42,
        )
        clf.fit(X)

        preds = clf.predict(X)           # -1 = anomaly, 1 = normal
        scores = clf.decision_function(X)  # more negative = more anomalous

        # Per-category mean for human-readable reason strings
        cat_amounts: dict = defaultdict(list)
        for exp in expenses:
            cat_amounts[exp.category.lower()].append(float(exp.amount))

        cat_stats = {
            cat: sum(vals) / len(vals)
            for cat, vals in cat_amounts.items()
        }

        anomalies = []
        for i, exp in enumerate(expenses):
            if preds[i] != -1:
                continue

            score = float(scores[i])
            cat = exp.category.lower()
            mean = cat_stats.get(cat, float(exp.amount))
            ratio = float(exp.amount) / mean if mean > 0 else 1.0

            # Severity thresholds on decision_function output.
            # decision_function < 0 means anomaly; the more negative, the worse.
            if score < -0.15:
                severity = "high"
            elif score < -0.05:
                severity = "medium"
            else:
                severity = "low"

            if ratio >= 2.0:
                reason = (
                    f"₹{exp.amount:.0f} is {ratio:.1f}x your usual "
                    f"₹{mean:.0f} in {exp.category}."
                )
            elif ratio <= 0.3:
                reason = (
                    f"₹{exp.amount:.0f} is unusually low for {exp.category} "
                    f"(typical: ₹{mean:.0f})."
                )
            else:
                reason = (
                    f"Unusual pattern in {exp.category} — "
                    f"atypical amount or frequency for your history."
                )

            expense_date = _expense_day(exp)

            anomalies.append({
                "expense_id": exp.id,
                "amount": float(exp.amount),
                "category": exp.category,
                "date": expense_date.strftime("%Y-%m-%d"),
                "reason": reason,
                "severity": severity,
                "anomaly_score": round(score, 4),
            })

        severity_order = {"high": 0, "medium": 1, "low": 2}
        anomalies.sort(
            key=lambda x: (severity_order.get(x["severity"], 3), x["anomaly_score"])
        )

        return {
            "anomalies": anomalies,
            "method": "isolation_forest",
            "total_expenses_analyzed": len(expenses),
        }

    except Exception as e:
        print(f"[IsolationForest] Error: {e}")
        return {
            "anomalies": [],
            "method": "error",
            "message": str(e),
            "total_expenses_analyzed": len(expenses),
        }