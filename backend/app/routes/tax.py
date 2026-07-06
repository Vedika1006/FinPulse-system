import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app import models, schemas
from app.services.tax_service import (
    get_current_financial_year,
    get_financial_year,
    months_remaining_in_fy,
    calculate_80c_total,
    calculate_80ccd_total,
    calculate_80d_total,
    calculate_old_regime_tax,
    compare_regimes,
    INSTRUMENTS_80C,
    INSTRUMENTS_80CCD,
    INSTRUMENTS_80D_SELF,
    INSTRUMENTS_80D_PARENTS,
)

router = APIRouter(prefix="/tax", tags=["Tax"])

_FY_PATTERN = re.compile(r"^\d{4}-\d{2}$")


def _resolve_fy(fy: Optional[str]) -> str:
    fy = fy or get_current_financial_year()
    if not _FY_PATTERN.match(fy):
        raise HTTPException(status_code=422, detail="fy must be in 'YYYY-YY' format, e.g. '2026-27'")
    return fy


def _get_investments(db: Session, user_id: int, fy: str):
    return (
        db.query(models.TaxInvestment)
        .filter(models.TaxInvestment.user_id == user_id, models.TaxInvestment.financial_year == fy)
        .order_by(models.TaxInvestment.date.desc())
        .all()
    )


@router.get("/investments", response_model=schemas.TaxInvestmentsGrouped)
def list_investments(
    fy: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    fy = _resolve_fy(fy)
    investments = _get_investments(db, user_id, fy)

    return {
        "financial_year": fy,
        "section_80c": [i for i in investments if i.instrument_type in INSTRUMENTS_80C],
        "section_80ccd": [i for i in investments if i.instrument_type in INSTRUMENTS_80CCD],
        "section_80d": [
            i for i in investments if i.instrument_type in (INSTRUMENTS_80D_SELF | INSTRUMENTS_80D_PARENTS)
        ],
    }


@router.post("/investments", response_model=schemas.TaxInvestmentResponse)
def create_investment(
    payload: schemas.TaxInvestmentCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    investment = models.TaxInvestment(
        user_id=user_id,
        instrument_type=payload.instrument_type,
        name=payload.name,
        amount=payload.amount,
        frequency=payload.frequency,
        date=payload.date,
        financial_year=get_financial_year(payload.date),
        is_recurring=payload.frequency != "one_time",
    )
    db.add(investment)
    db.commit()
    db.refresh(investment)
    return investment


@router.put("/investments/{investment_id}", response_model=schemas.TaxInvestmentResponse)
def update_investment(
    investment_id: int,
    payload: schemas.TaxInvestmentUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    investment = (
        db.query(models.TaxInvestment)
        .filter(models.TaxInvestment.id == investment_id, models.TaxInvestment.user_id == user_id)
        .first()
    )
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(investment, field, value)

    if "date" in updates:
        investment.financial_year = get_financial_year(investment.date)
    if "frequency" in updates:
        investment.is_recurring = investment.frequency != "one_time"

    db.commit()
    db.refresh(investment)
    return investment


@router.delete("/investments/{investment_id}")
def delete_investment(
    investment_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    investment = (
        db.query(models.TaxInvestment)
        .filter(models.TaxInvestment.id == investment_id, models.TaxInvestment.user_id == user_id)
        .first()
    )
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")

    db.delete(investment)
    db.commit()
    return {"message": "Investment deleted"}


@router.get("/summary", response_model=schemas.TaxSummaryResponse)
def get_summary(
    fy: Optional[str] = Query(None),
    annual_income: Optional[float] = Query(None, ge=0),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    fy = _resolve_fy(fy)
    investments = _get_investments(db, user_id, fy)

    c80c = calculate_80c_total(investments)
    c80ccd = calculate_80ccd_total(investments)
    c80d = calculate_80d_total(investments)

    months_remaining = months_remaining_in_fy(fy)
    investment_needed = (c80c["remaining_limit"] / months_remaining) if months_remaining > 0 else 0.0

    old_regime_tax = None
    tax_saved = None
    if annual_income is not None:
        # Waterfall decomposition: start from zero deductions and add one
        # section at a time, attributing each step's tax drop to that
        # section. Unlike isolating each deduction independently, this
        # telescopes exactly to the true total saved (tax progressivity
        # means isolated marginal amounts don't otherwise sum correctly).
        tax_none = calculate_old_regime_tax(annual_income, 0, 0, 0)["total_tax"]
        tax_after_80c = calculate_old_regime_tax(annual_income, c80c["eligible_amount"], 0, 0)["total_tax"]
        tax_after_80c_80ccd = calculate_old_regime_tax(
            annual_income, c80c["eligible_amount"], c80ccd["eligible_amount"], 0
        )["total_tax"]
        old_regime_tax = calculate_old_regime_tax(
            annual_income, c80c["eligible_amount"], c80ccd["eligible_amount"], c80d["combined_eligible"]
        )

        saved_80c = round(tax_none - tax_after_80c, 2)
        saved_80ccd = round(tax_after_80c - tax_after_80c_80ccd, 2)
        saved_80d = round(tax_after_80c_80ccd - old_regime_tax["total_tax"], 2)

        tax_saved = {
            "section_80c": saved_80c,
            "section_80ccd": saved_80ccd,
            "section_80d": saved_80d,
            "total": round(tax_none - old_regime_tax["total_tax"], 2),
        }

    return {
        "financial_year": fy,
        "section_80c": c80c,
        "section_80ccd": c80ccd,
        "section_80d": c80d,
        "old_regime_tax": old_regime_tax,
        "tax_saved": tax_saved,
        "months_remaining_in_fy": months_remaining,
        "investment_needed_per_month_80c": round(investment_needed, 2),
    }


@router.get("/compare", response_model=schemas.RegimeCompareResponse)
def get_compare(
    annual_income: float = Query(..., ge=0),
    fy: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    fy = _resolve_fy(fy)
    investments = _get_investments(db, user_id, fy)
    return compare_regimes(annual_income, investments)
