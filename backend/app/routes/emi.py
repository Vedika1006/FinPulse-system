from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app import models, schemas
from app.services.emi_service import calculate_emi, calculate_amortization

router = APIRouter(prefix="/emi", tags=["EMI"])


def _amortize(debt: models.Debt) -> dict:
    return calculate_amortization(
        principal=debt.principal,
        annual_rate=debt.interest_rate,
        tenure_months=debt.tenure_months,
        emi_amount=debt.emi_amount,
        start_date=debt.start_date,
        extra_payments=debt.extra_payments,
    )


def _list_item(debt: models.Debt, result: dict | None = None) -> dict:
    result = result if result is not None else _amortize(debt)
    schedule = result["schedule"]
    elapsed = result["elapsed_months"]
    next_due_date = schedule[elapsed]["date"] if elapsed < len(schedule) else None

    return {
        **schemas.DebtResponse.model_validate(debt).model_dump(),
        "current_outstanding_balance": result["current_outstanding_balance"],
        "interest_remaining": result["interest_remaining"],
        "elapsed_months": result["elapsed_months"],
        "revised_tenure_months": result["revised_tenure_months"],
        "next_due_date": next_due_date,
    }


@router.get("", response_model=list[schemas.DebtListItemResponse])
def list_debts(db: Session = Depends(get_db), user_id: int = Depends(get_current_user)):
    debts = (
        db.query(models.Debt)
        .filter(models.Debt.user_id == user_id)
        .order_by(models.Debt.is_active.desc(), models.Debt.created_at.desc())
        .all()
    )
    return [_list_item(d) for d in debts]


@router.get("/summary", response_model=schemas.DebtSummaryResponse)
def get_summary(db: Session = Depends(get_db), user_id: int = Depends(get_current_user)):
    debts = (
        db.query(models.Debt)
        .filter(models.Debt.user_id == user_id, models.Debt.is_active == True)  # noqa: E712
        .all()
    )

    total_monthly_emi = 0.0
    total_outstanding = 0.0
    total_interest_remaining = 0.0
    debt_free_date = None

    for d in debts:
        result = _amortize(d)
        total_monthly_emi += float(d.emi_amount)
        total_outstanding += result["current_outstanding_balance"]
        total_interest_remaining += result["interest_remaining"]
        if result["schedule"]:
            last_month = result["schedule"][-1]["date"]
            if debt_free_date is None or last_month > debt_free_date:
                debt_free_date = last_month

    return {
        "total_monthly_emi": round(total_monthly_emi, 2),
        "total_outstanding": round(total_outstanding, 2),
        "total_interest_remaining": round(total_interest_remaining, 2),
        "active_loans": len(debts),
        "debt_free_date": debt_free_date,
    }


@router.get("/{debt_id}", response_model=schemas.DebtDetailResponse)
def get_debt(debt_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user)):
    debt = db.query(models.Debt).filter(models.Debt.id == debt_id, models.Debt.user_id == user_id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")

    result = _amortize(debt)
    return {
        **_list_item(debt, result=result),
        "schedule": result["schedule"],
        "interest_paid_so_far": result["interest_paid_so_far"],
        "total_interest": result["total_interest"],
    }


@router.post("", response_model=schemas.DebtListItemResponse)
def create_debt(
    payload: schemas.DebtCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    emi_amount = payload.emi_amount or calculate_emi(payload.principal, payload.interest_rate, payload.tenure_months)

    debt = models.Debt(
        user_id=user_id,
        name=payload.name,
        loan_type=payload.loan_type,
        principal=payload.principal,
        interest_rate=payload.interest_rate,
        tenure_months=payload.tenure_months,
        emi_amount=emi_amount,
        start_date=payload.start_date,
        extra_payments=0,
        is_active=True,
    )
    db.add(debt)
    db.commit()
    db.refresh(debt)
    return _list_item(debt)


@router.put("/{debt_id}", response_model=schemas.DebtListItemResponse)
def update_debt(
    debt_id: int,
    payload: schemas.DebtUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    debt = db.query(models.Debt).filter(models.Debt.id == debt_id, models.Debt.user_id == user_id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")

    updates = payload.model_dump(exclude_unset=True)
    extra_payment = updates.pop("add_extra_payment", None)

    new_emi = updates.get("emi_amount")
    if new_emi is not None and float(debt.interest_rate) > 0:
        monthly_interest = float(debt.principal) * (float(debt.interest_rate) / 12 / 100)
        if new_emi <= monthly_interest:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"EMI amount must be greater than the monthly interest (₹{monthly_interest:.2f}) "
                    "or the loan will never be paid off."
                ),
            )

    for field, value in updates.items():
        setattr(debt, field, value)

    if extra_payment:
        debt.extra_payments = round(float(debt.extra_payments or 0) + float(extra_payment), 2)

    db.commit()
    db.refresh(debt)
    return _list_item(debt)


@router.delete("/{debt_id}")
def delete_debt(debt_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user)):
    debt = db.query(models.Debt).filter(models.Debt.id == debt_id, models.Debt.user_id == user_id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")

    debt.is_active = False
    db.commit()
    return {"message": "Loan marked as closed"}
