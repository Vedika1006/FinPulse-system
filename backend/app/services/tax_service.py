"""
Section 80C/80CCD(1B)/80D aggregation and old-vs-new tax regime calculation.

Slab figures are for FY 2026-27 (verified via web search — Budget 2026 kept
FY 2025-26's slabs unchanged for FY 2026-27):
- New regime (default): 0-4L nil, 4-8L 5%, 8-12L 10%, 12-16L 15%, 16-20L 20%,
  20-24L 25%, above 24L 30%; standard deduction ₹75,000; Section 87A rebate
  zeroes out tax for taxable income up to ₹12L.
- Old regime (unchanged for several years): 0-2.5L nil, 2.5-5L 5%, 5-10L 20%,
  above 10L 30%; standard deduction ₹50,000; Section 87A rebate zeroes out
  tax for taxable income up to ₹5L.
Both add a 4% health & education cess on the computed tax.
"""
from datetime import date
from typing import Optional

SECTION_80C_LIMIT = 150000.0
SECTION_80CCD_LIMIT = 50000.0
SECTION_80D_SELF_LIMIT = 25000.0
SECTION_80D_PARENTS_LIMIT = 50000.0

INSTRUMENTS_80C = {
    "PPF", "ELSS", "NSC", "LIC", "EPF", "VPF", "FD_5yr", "SCSS", "SSY",
    "Home_Loan_Principal", "Tuition_Fees",
}
INSTRUMENTS_80CCD = {"NPS_80CCD"}
INSTRUMENTS_80D_SELF = {"Health_Insurance_Self_80D"}
INSTRUMENTS_80D_PARENTS = {"Health_Insurance_Parents_80D"}
ALL_INSTRUMENT_TYPES = INSTRUMENTS_80C | INSTRUMENTS_80CCD | INSTRUMENTS_80D_SELF | INSTRUMENTS_80D_PARENTS

CESS_RATE = 0.04

OLD_REGIME_STANDARD_DEDUCTION = 50000.0
OLD_REGIME_87A_THRESHOLD = 500000.0
OLD_REGIME_SLABS = [
    (0.0, 250000.0, 0.0),
    (250000.0, 500000.0, 0.05),
    (500000.0, 1000000.0, 0.20),
    (1000000.0, float("inf"), 0.30),
]

NEW_REGIME_STANDARD_DEDUCTION = 75000.0
NEW_REGIME_87A_THRESHOLD = 1200000.0
NEW_REGIME_SLABS = [
    (0.0, 400000.0, 0.0),
    (400000.0, 800000.0, 0.05),
    (800000.0, 1200000.0, 0.10),
    (1200000.0, 1600000.0, 0.15),
    (1600000.0, 2000000.0, 0.20),
    (2000000.0, 2400000.0, 0.25),
    (2400000.0, float("inf"), 0.30),
]


# ── Financial year helpers (April 1 – March 31) ───────────────────────────────

def get_financial_year(d: date) -> str:
    start_year = d.year if d.month >= 4 else d.year - 1
    return f"{start_year}-{(start_year + 1) % 100:02d}"


def get_current_financial_year() -> str:
    return get_financial_year(date.today())


def fy_bounds(fy: str) -> tuple[date, date]:
    start_year = int(fy.split("-")[0])
    return date(start_year, 4, 1), date(start_year + 1, 3, 31)


def months_remaining_in_fy(fy: str, today: Optional[date] = None) -> int:
    today = today or date.today()
    start, end = fy_bounds(fy)
    if today < start:
        return 12
    if today > end:
        return 0
    return (end.year - today.year) * 12 + (end.month - today.month) + 1


# ── Section aggregation ────────────────────────────────────────────────────────

def calculate_80c_total(investments: list) -> dict:
    total_invested = sum(float(inv.amount) for inv in investments if inv.instrument_type in INSTRUMENTS_80C)
    eligible = min(total_invested, SECTION_80C_LIMIT)
    remaining = max(SECTION_80C_LIMIT - total_invested, 0.0)
    pct = (eligible / SECTION_80C_LIMIT * 100) if SECTION_80C_LIMIT else 0.0
    return {
        "total_invested": round(total_invested, 2),
        "eligible_amount": round(eligible, 2),
        "remaining_limit": round(remaining, 2),
        "percentage_utilized": round(pct, 1),
        "limit": SECTION_80C_LIMIT,
    }


def calculate_80ccd_total(investments: list) -> dict:
    total_invested = sum(float(inv.amount) for inv in investments if inv.instrument_type in INSTRUMENTS_80CCD)
    eligible = min(total_invested, SECTION_80CCD_LIMIT)
    remaining = max(SECTION_80CCD_LIMIT - total_invested, 0.0)
    pct = (eligible / SECTION_80CCD_LIMIT * 100) if SECTION_80CCD_LIMIT else 0.0
    return {
        "total_invested": round(total_invested, 2),
        "eligible_amount": round(eligible, 2),
        "remaining_limit": round(remaining, 2),
        "percentage_utilized": round(pct, 1),
        "limit": SECTION_80CCD_LIMIT,
    }


def calculate_80d_total(investments: list) -> dict:
    self_total = sum(float(inv.amount) for inv in investments if inv.instrument_type in INSTRUMENTS_80D_SELF)
    parents_total = sum(float(inv.amount) for inv in investments if inv.instrument_type in INSTRUMENTS_80D_PARENTS)
    self_eligible = min(self_total, SECTION_80D_SELF_LIMIT)
    parents_eligible = min(parents_total, SECTION_80D_PARENTS_LIMIT)
    return {
        "self_invested": round(self_total, 2),
        "self_eligible": round(self_eligible, 2),
        "self_limit": SECTION_80D_SELF_LIMIT,
        "parents_invested": round(parents_total, 2),
        "parents_eligible": round(parents_eligible, 2),
        "parents_limit": SECTION_80D_PARENTS_LIMIT,
        "combined_eligible": round(self_eligible + parents_eligible, 2),
    }


# ── Tax calculation ────────────────────────────────────────────────────────────

def _slab_tax(taxable_income: float, slabs: list[tuple[float, float, float]]) -> float:
    tax = 0.0
    for lower, upper, rate in slabs:
        if taxable_income <= lower:
            break
        amount_in_slab = min(taxable_income, upper) - lower
        if amount_in_slab > 0:
            tax += amount_in_slab * rate
    return tax


def _rebate_87a_tax(taxable_income: float, threshold: float, slabs: list[tuple[float, float, float]]) -> float:
    """
    Section 87A zeroes out tax entirely up to `threshold`, but without
    marginal relief, earning ₹1 over the threshold would jump straight to
    full slab tax (e.g. ~₹13,000 on ₹1 of extra income at the old regime's
    ₹5L cliff). Real law caps tax at (taxable_income - threshold) just
    above the cliff so there's no discontinuity — apply that here too.
    """
    if taxable_income <= threshold:
        return 0.0
    gross_tax = _slab_tax(taxable_income, slabs)
    return min(gross_tax, taxable_income - threshold)


def calculate_old_regime_tax(
    annual_income: float,
    deductions_80c: float = 0.0,
    deductions_80ccd: float = 0.0,
    deductions_80d: float = 0.0,
) -> dict:
    annual_income = float(annual_income)
    taxable_income = max(
        annual_income - OLD_REGIME_STANDARD_DEDUCTION - deductions_80c - deductions_80ccd - deductions_80d,
        0.0,
    )

    gross_tax = _rebate_87a_tax(taxable_income, OLD_REGIME_87A_THRESHOLD, OLD_REGIME_SLABS)
    cess = gross_tax * CESS_RATE
    total_tax = gross_tax + cess
    effective_rate = (total_tax / annual_income * 100) if annual_income > 0 else 0.0

    return {
        "regime": "old",
        "taxable_income": round(taxable_income, 2),
        "gross_tax": round(gross_tax, 2),
        "cess": round(cess, 2),
        "total_tax": round(total_tax, 2),
        "effective_tax_rate": round(effective_rate, 2),
        "standard_deduction": OLD_REGIME_STANDARD_DEDUCTION,
    }


def calculate_new_regime_tax(annual_income: float) -> dict:
    annual_income = float(annual_income)
    taxable_income = max(annual_income - NEW_REGIME_STANDARD_DEDUCTION, 0.0)

    gross_tax = _rebate_87a_tax(taxable_income, NEW_REGIME_87A_THRESHOLD, NEW_REGIME_SLABS)
    cess = gross_tax * CESS_RATE
    total_tax = gross_tax + cess
    effective_rate = (total_tax / annual_income * 100) if annual_income > 0 else 0.0

    return {
        "regime": "new",
        "taxable_income": round(taxable_income, 2),
        "gross_tax": round(gross_tax, 2),
        "cess": round(cess, 2),
        "total_tax": round(total_tax, 2),
        "effective_tax_rate": round(effective_rate, 2),
        "standard_deduction": NEW_REGIME_STANDARD_DEDUCTION,
    }


def compare_regimes(annual_income: float, investments: list) -> dict:
    c80c = calculate_80c_total(investments)
    c80ccd = calculate_80ccd_total(investments)
    c80d = calculate_80d_total(investments)

    old = calculate_old_regime_tax(
        annual_income,
        deductions_80c=c80c["eligible_amount"],
        deductions_80ccd=c80ccd["eligible_amount"],
        deductions_80d=c80d["combined_eligible"],
    )
    new = calculate_new_regime_tax(annual_income)

    diff = round(old["total_tax"] - new["total_tax"], 2)  # positive => old costs more => new is cheaper
    total_deductions = c80c["eligible_amount"] + c80ccd["eligible_amount"] + c80d["combined_eligible"]

    if diff > 0.005:
        better = "new"
        savings = diff
        if total_deductions > 0:
            recommendation = (
                f"The New Regime saves you ₹{savings:,.0f} more — your ₹{total_deductions:,.0f} of 80C/80CCD/80D "
                "deductions aren't enough to outweigh the Old Regime's narrower 0% slab and lower standard deduction."
            )
        else:
            recommendation = (
                f"The New Regime saves you ₹{savings:,.0f} more, since you haven't recorded any 80C/80CCD/80D "
                "deductions to make the Old Regime worthwhile."
            )
    elif diff < -0.005:
        better = "old"
        savings = abs(diff)
        recommendation = (
            f"The Old Regime saves you ₹{savings:,.0f} more because your ₹{total_deductions:,.0f} of 80C/80CCD/80D "
            "investments reduce your taxable income significantly."
        )
    else:
        better = "either"
        savings = 0.0
        recommendation = "Both regimes result in the same tax liability at your current income and deductions."

    return {
        "old_regime": old,
        "new_regime": new,
        "difference": round(abs(diff), 2),
        "better_regime": better,
        "recommendation": recommendation,
    }
