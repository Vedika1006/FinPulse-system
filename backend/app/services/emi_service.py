"""
Reducing-balance EMI/amortization math for the Debt tracker.

Standard EMI formula: EMI = P * r * (1+r)^n / ((1+r)^n - 1), where r is the
monthly interest rate. 0% loans (common for consumer no-cost EMIs in India)
skip interest entirely and just divide principal by tenure.
"""
from datetime import date
from typing import Optional

from dateutil.relativedelta import relativedelta


def calculate_emi(principal: float, annual_rate: float, tenure_months: int) -> float:
    principal = float(principal)
    annual_rate = float(annual_rate)
    if tenure_months <= 0:
        return 0.0
    if annual_rate <= 0:
        return round(principal / tenure_months, 2)

    r = annual_rate / 12 / 100
    factor = (1 + r) ** tenure_months
    emi = principal * r * factor / (factor - 1)
    return round(emi, 2)


def _add_months(d: date, n: int) -> date:
    # relativedelta clamps to the target month's last valid day (e.g. Jan 31
    # + 1 month = Feb 28), matching how real EMI due-dates roll over.
    return d + relativedelta(months=n)


def _elapsed_months(start_date: date, tenure_months: int, today: date) -> int:
    # Count scheduled due-dates (month 1's due date is start_date itself,
    # month k's is _add_months(start_date, k-1)) that have already passed —
    # tied directly to the same day-clamping _add_months uses for the
    # schedule itself, so a month-end start_date can't disagree with it.
    # Strict "<": a due-date that falls exactly on today is the current/next
    # payment (not yet paid), matching the UI's "current month" highlight.
    elapsed = 0
    while elapsed < tenure_months and _add_months(start_date, elapsed) < today:
        elapsed += 1
    return elapsed


def calculate_amortization(
    principal: float,
    annual_rate: float,
    tenure_months: int,
    emi_amount: Optional[float],
    start_date: date,
    extra_payments: float = 0.0,
    today: Optional[date] = None,
) -> dict:
    """
    Builds the full month-by-month schedule. Months up to (but not
    including) "today" are marked paid=True using the loan's original
    terms; extra_payments (a lump-sum prepayment made so far) is applied
    against the balance right after those paid months, shortening the
    remaining tenure at the same EMI (the last remaining EMI absorbs any
    rounding remainder so the loan closes exactly at zero).
    """
    principal = float(principal)
    annual_rate = float(annual_rate)
    extra_payments = float(extra_payments or 0)
    emi = float(emi_amount) if emi_amount else calculate_emi(principal, annual_rate, tenure_months)
    r = (annual_rate / 12 / 100) if annual_rate > 0 else 0.0
    today = today or date.today()

    elapsed = _elapsed_months(start_date, tenure_months, today)

    schedule: list[dict] = []
    cumulative_interest = 0.0
    stalled = False  # EMI can't even cover interest — never converges

    def step(month_no: int, outstanding: float, paid: bool) -> float:
        nonlocal cumulative_interest
        interest_component = round(outstanding * r, 2) if r > 0 else 0.0
        this_emi = emi
        principal_component = round(this_emi - interest_component, 2)
        if principal_component >= outstanding:
            principal_component = round(outstanding, 2)
            this_emi = round(principal_component + interest_component, 2)
        new_outstanding = round(max(outstanding - principal_component, 0.0), 2)
        cumulative_interest += interest_component
        month_date = _add_months(start_date, month_no - 1)
        schedule.append(
            {
                "month": month_no,
                "date": month_date.strftime("%Y-%m"),
                "emi": this_emi,
                "principal_component": principal_component,
                "interest_component": interest_component,
                "outstanding_balance": new_outstanding,
                "cumulative_interest": round(cumulative_interest, 2),
                "paid": paid,
            }
        )
        return new_outstanding

    outstanding = principal
    for m in range(1, elapsed + 1):
        if outstanding <= 0:
            break
        outstanding = step(m, outstanding, paid=True)
    elapsed = len(schedule)  # reflect months actually recorded, not the target

    interest_paid_so_far = round(cumulative_interest, 2)

    if extra_payments > 0:
        outstanding = round(max(outstanding - extra_payments, 0.0), 2)

    current_outstanding_balance = outstanding

    month_no = elapsed + 1
    max_iterations = tenure_months + 600  # guard against pathological inputs
    while outstanding > 0.01 and month_no <= max_iterations:
        interest_component = round(outstanding * r, 2) if r > 0 else 0.0
        if emi <= interest_component:
            # EMI doesn't even cover this month's interest — the balance
            # would grow forever. Stop here rather than simulate negative
            # amortization out to max_iterations.
            stalled = True
            break
        outstanding = step(month_no, outstanding, paid=False)
        month_no += 1

    total_interest = round(cumulative_interest, 2)

    return {
        "schedule": schedule,
        "elapsed_months": elapsed,
        "revised_tenure_months": len(schedule),
        "current_outstanding_balance": current_outstanding_balance,
        "interest_paid_so_far": interest_paid_so_far,
        "interest_remaining": round(total_interest - interest_paid_so_far, 2),
        "total_interest": total_interest,
        "emi_amount": emi,
        "stalled": stalled,
    }
