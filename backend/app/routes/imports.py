"""
CSV import endpoints.

POST /import/csv/preview  — parse + annotate without saving to DB
POST /import/csv/confirm  — bulk insert approved transactions
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models import Expense, Income, UserMemory
from app.schemas import ImportConfirmRequest, ImportConfirmResponse, ImportPreviewResponse
from app.services.csv_import_service import (
    categorize_parsed_transactions,
    detect_duplicates,
    parse_generic_csv,
    parse_hdfc_csv,
    parse_icici_csv,
)

router = APIRouter(prefix="/import", tags=["Import"])


@router.post("/csv/preview", response_model=ImportPreviewResponse)
async def preview_csv_import(
    file: UploadFile = File(...),
    bank: str = Form(...),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    """
    Parse uploaded CSV, run duplicate detection and AI categorization.
    Returns a preview — nothing is written to the database.
    """
    file_bytes = await file.read()
    bank_key = (bank or "other").strip().lower()

    try:
        if bank_key == "icici":
            parsed = parse_icici_csv(file_bytes)
        elif bank_key == "hdfc":
            parsed = parse_hdfc_csv(file_bytes)
        else:
            parsed = parse_generic_csv(file_bytes)
    except ValueError as exc:
        return JSONResponse(status_code=400, content={"detail": str(exc)})
    except Exception as exc:
        return JSONResponse(
            status_code=400,
            content={"detail": f"Could not parse the uploaded file: {exc}"},
        )

    if not parsed:
        return JSONResponse(
            status_code=400,
            content={
                "detail": "No transactions found in the uploaded file. "
                          "Please check that you downloaded the full CSV statement."
            },
        )

    # Split debits (expenses) vs credits (potential income)
    debits = [t for t in parsed if t.get("type") == "debit"]
    credits = [t for t in parsed if t.get("type") == "credit"]

    # Fetch last 90 days of this user's expenses for duplicate comparison
    cutoff = datetime.utcnow() - timedelta(days=90)
    existing = (
        db.query(Expense)
        .filter(Expense.user_id == user_id, Expense.created_at >= cutoff)
        .all()
    )

    debits = detect_duplicates(debits, existing)
    debits = categorize_parsed_transactions(debits)

    duplicate_count = sum(1 for t in debits if t.get("is_duplicate"))

    return {
        "total_found": len(debits),
        "duplicate_count": duplicate_count,
        "transactions": debits,
        "income_entries": credits,
    }


@router.post("/csv/confirm", response_model=ImportConfirmResponse)
def confirm_csv_import(
    payload: ImportConfirmRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user),
):
    """
    Bulk insert approved transactions into the expenses table.
    """
    print(
        f"[CSV Import Confirm] user_id={user_id} "
        f"transactions={len(payload.transactions)} "
        f"income_entries={len(payload.income_entries)} "
        f"skip_duplicates={payload.skip_duplicates}"
    )
    if payload.income_entries:
        print(f"[CSV Import Confirm] First income entry: {payload.income_entries[0]}")

    imported = 0
    skipped = 0

    for txn in payload.transactions:
        if payload.skip_duplicates and txn.get("is_duplicate"):
            skipped += 1
            continue

        try:
            amount = float(txn.get("amount", 0))
            if amount <= 0:
                skipped += 1
                continue

            # Parse date — try ISO first then common Indian formats
            date_val = None
            raw_date = txn.get("date")
            if raw_date:
                for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d-%b-%Y", "%d/%m/%y"):
                    try:
                        date_val = datetime.strptime(str(raw_date), fmt)
                        break
                    except ValueError:
                        continue

            category = (
                txn.get("category") or txn.get("suggested_category") or "other"
            ).strip().lower()
            if not category:
                category = "other"

            new_expense = Expense(
                amount=amount,
                category=category,
                description=str(txn.get("description", "")).strip(),
                date=date_val,
                user_id=user_id,
            )
            db.add(new_expense)
            imported += 1

        except Exception:
            skipped += 1
            continue

    db.commit()

    # ── Income entries: group credits by month and upsert Income records ──────
    income_imported = 0
    income_by_month: dict[str, float] = {}

    for entry in payload.income_entries:
        raw_date = entry.get("date", "")
        amount = 0.0
        month_key = ""
        try:
            amount = float(entry.get("amount", 0))
            if amount <= 0:
                continue
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d-%b-%Y", "%d/%m/%y"):
                try:
                    d = datetime.strptime(str(raw_date), fmt)
                    month_key = d.strftime("%Y-%m")
                    break
                except ValueError:
                    continue
            if not month_key:
                continue
            income_by_month[month_key] = income_by_month.get(month_key, 0.0) + amount
        except Exception:
            continue

    for month_key, total in income_by_month.items():
        existing = (
            db.query(Income)
            .filter(Income.user_id == user_id, Income.month == month_key)
            .first()
        )
        if existing is None:
            db.add(Income(user_id=user_id, month=month_key, amount=round(total, 2)))
            income_imported += 1

    if income_by_month:
        db.commit()

    # Invalidate the 24-hour UserMemory cache so the next analytics load
    # recomputes month_total_expense and month_overspend with the new data.
    try:
        mem_row = db.query(UserMemory).filter(UserMemory.user_id == user_id).first()
        if mem_row:
            mem_row.updated_at = datetime.utcnow() - timedelta(hours=25)
            db.commit()
    except Exception:
        pass

    return {"imported_count": imported, "skipped_count": skipped, "income_imported": income_imported}
