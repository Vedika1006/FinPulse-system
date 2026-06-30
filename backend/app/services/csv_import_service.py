"""
CSV import service — parses ICICI, HDFC, and generic bank CSVs.
"""

import io
from datetime import datetime
from typing import Any

import pandas as pd

from app.services.categorization_service import categorize_merchant


# ── Shared helpers ────────────────────────────────────────────────────────────

def _find_col(df: pd.DataFrame, candidates: list[str]) -> str | None:
    """Return the first column whose lowercase name contains any candidate string."""
    col_map = {c.lower().strip(): c for c in df.columns}
    for candidate in candidates:
        for lower_name, original_name in col_map.items():
            if candidate in lower_name:
                return original_name
    return None


def _find_header_row(df_raw: pd.DataFrame, keywords: list[str]) -> int:
    """
    Scan first 20 rows for the row containing any of the keywords.
    Returns the 0-based integer row index (for use as pandas header=N).
    """
    for i, row in df_raw.head(20).iterrows():
        row_text = " ".join(str(v) for v in row.values).lower()
        if any(kw.lower() in row_text for kw in keywords):
            return int(i)
    return 0


def _clean_amount(val: Any) -> float:
    """Strip commas/whitespace and convert to float; return 0.0 on failure."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return 0.0
    s = str(val).replace(",", "").strip()
    if s in ("", "-", "nan", "NaN"):
        return 0.0
    try:
        return float(s)
    except (ValueError, TypeError):
        return 0.0


def _parse_date(val: Any) -> str:
    """Try common Indian bank date formats; return ISO YYYY-MM-DD or raw string."""
    raw = str(val).strip()
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d %b %Y", "%d-%b-%Y",
                "%d/%m/%y", "%d-%b-%y", "%Y/%m/%d"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return raw


def _rows_to_transactions(df: pd.DataFrame, date_col: str, desc_col: str,
                           debit_col: str | None, credit_col: str | None,
                           amount_col: str | None) -> list[dict]:
    """
    Convert a normalised DataFrame into the standard transaction list.
    Handles both split debit/credit columns and single signed-amount column.
    """
    transactions = []

    for _, row in df.iterrows():
        date = _parse_date(row.get(date_col, ""))
        description = str(row.get(desc_col, "")).strip()

        if not description or description.lower() in ("nan", "none", ""):
            continue
        if not date or date.lower() in ("nan", "none", ""):
            continue

        if amount_col and debit_col is None and credit_col is None:
            # Single amount column with +/- sign convention
            raw = str(row.get(amount_col, "")).replace(",", "").strip()
            try:
                amount_val = float(raw)
            except (ValueError, TypeError):
                continue
            if amount_val < 0:
                transactions.append({"date": date, "description": description,
                                     "amount": abs(amount_val), "type": "debit"})
            elif amount_val > 0:
                transactions.append({"date": date, "description": description,
                                     "amount": amount_val, "type": "credit"})
        else:
            debit = _clean_amount(row.get(debit_col)) if debit_col else 0.0
            credit = _clean_amount(row.get(credit_col)) if credit_col else 0.0
            if debit > 0:
                transactions.append({"date": date, "description": description,
                                     "amount": debit, "type": "debit"})
            if credit > 0:
                transactions.append({"date": date, "description": description,
                                     "amount": credit, "type": "credit"})

    return transactions


# ── Bank-specific parsers ─────────────────────────────────────────────────────

def parse_icici_csv(file_bytes: bytes) -> list[dict]:
    """
    ICICI bank statement CSV.
    Typical columns: Transaction Date, Transaction Remarks,
                     Withdrawal Amount, Deposit Amount, Balance
    """
    raw = pd.read_csv(io.BytesIO(file_bytes), header=None, dtype=str,
                      on_bad_lines="skip")
    header_row = _find_header_row(raw, ["transaction date", "withdrawal", "deposit",
                                         "remarks"])
    df = pd.read_csv(io.BytesIO(file_bytes), header=header_row, dtype=str,
                     on_bad_lines="skip")
    df.columns = [str(c).strip() for c in df.columns]

    date_col = _find_col(df, ["transaction date", "txn date", "date"])
    desc_col = _find_col(df, ["transaction remarks", "remarks", "description",
                               "particulars", "narration"])
    debit_col = _find_col(df, ["withdrawal amount", "withdrawal amt", "withdrawal",
                                "debit amount", "debit"])
    credit_col = _find_col(df, ["deposit amount", "deposit amt", "deposit",
                                 "credit amount", "credit"])

    if date_col is None or desc_col is None:
        raise ValueError(
            "Could not detect transaction columns in ICICI CSV. "
            "Please download the full CSV statement (Accounts → Download Account Statement → CSV)."
        )

    return _rows_to_transactions(df, date_col, desc_col, debit_col, credit_col, None)


def parse_hdfc_csv(file_bytes: bytes) -> list[dict]:
    """
    HDFC bank statement CSV.
    Typical columns: Date, Narration, Chq./Ref.No., Value Dt,
                     Withdrawal Amt., Deposit Amt., Closing Balance
    """
    raw = pd.read_csv(io.BytesIO(file_bytes), header=None, dtype=str,
                      on_bad_lines="skip")
    header_row = _find_header_row(raw, ["narration", "withdrawal", "deposit", "date"])
    df = pd.read_csv(io.BytesIO(file_bytes), header=header_row, dtype=str,
                     on_bad_lines="skip")
    df.columns = [str(c).strip() for c in df.columns]

    date_col = _find_col(df, ["date", "transaction date", "value dt"])
    desc_col = _find_col(df, ["narration", "description", "particulars", "remarks"])
    debit_col = _find_col(df, ["withdrawal amt", "withdrawal amount", "withdrawal",
                                "debit amount", "debit"])
    credit_col = _find_col(df, ["deposit amt", "deposit amount", "deposit",
                                 "credit amount", "credit"])

    if date_col is None or desc_col is None:
        raise ValueError(
            "Could not detect transaction columns in HDFC CSV. "
            "Please download the statement as CSV from the HDFC mobile app "
            "(Accounts → Statement → Download → CSV)."
        )

    return _rows_to_transactions(df, date_col, desc_col, debit_col, credit_col, None)


def parse_generic_csv(file_bytes: bytes) -> list[dict]:
    """
    Generic parser for any bank CSV. Auto-detects columns from common header patterns.
    """
    raw = pd.read_csv(io.BytesIO(file_bytes), header=None, dtype=str,
                      on_bad_lines="skip")
    header_row = _find_header_row(
        raw,
        ["date", "narration", "description", "particulars", "amount",
         "withdrawal", "debit", "credit", "remarks"]
    )
    df = pd.read_csv(io.BytesIO(file_bytes), header=header_row, dtype=str,
                     on_bad_lines="skip")
    df.columns = [str(c).strip() for c in df.columns]

    date_col = _find_col(df, ["date", "transaction date", "txn date", "value date"])
    desc_col = _find_col(df, ["narration", "description", "particulars", "remarks",
                               "transaction details", "details"])
    debit_col = _find_col(df, ["withdrawal", "debit", "dr", "debit amount",
                                "withdrawal amount", "dr amount"])
    credit_col = _find_col(df, ["deposit", "credit", "cr", "credit amount",
                                 "deposit amount", "cr amount"])
    amount_col = _find_col(df, ["amount", "transaction amount", "txn amount"])

    if date_col is None or desc_col is None:
        raise ValueError(
            "Could not detect transaction columns. Please check your file format. "
            "The file must include columns for date, description/narration, "
            "and amount (or separate debit/credit columns)."
        )

    # Prefer split debit/credit over single amount column
    if debit_col is None and credit_col is None and amount_col is None:
        raise ValueError(
            "Could not detect amount columns. Please check your file format."
        )

    use_amount_col = amount_col if (debit_col is None and credit_col is None) else None
    return _rows_to_transactions(df, date_col, desc_col, debit_col, credit_col,
                                 use_amount_col)


# ── Duplicate detection ───────────────────────────────────────────────────────

def detect_duplicates(parsed_transactions: list[dict],
                       existing_expenses: list) -> list[dict]:
    """
    Annotates each dict in parsed_transactions with:
      is_duplicate: bool
      duplicate_confidence: float  (0.0 – 1.0)

    Compares against existing_expenses (SQLAlchemy Expense ORM objects).
    """
    for txn in parsed_transactions:
        try:
            txn_date = datetime.strptime(str(txn["date"]), "%Y-%m-%d").date()
        except (ValueError, TypeError, KeyError):
            txn["is_duplicate"] = False
            txn["duplicate_confidence"] = 0.0
            continue

        txn_amount = float(txn.get("amount", 0))
        txn_desc = str(txn.get("description", "")).lower().strip()

        best_confidence = 0.0

        for exp in existing_expenses:
            # Resolve existing date
            existing_date = None
            if exp.date:
                existing_date = exp.date.date() if hasattr(exp.date, "date") else exp.date
            elif exp.created_at:
                existing_date = exp.created_at.date() if hasattr(exp.created_at, "date") else exp.created_at

            if existing_date is None:
                continue

            existing_amount = float(exp.amount or 0)
            existing_desc = str(exp.description or "").lower().strip()

            # Amount must match within ₹1
            if abs(existing_amount - txn_amount) > 1.0:
                continue

            date_diff = abs((txn_date - existing_date).days)
            if date_diff == 0:
                confidence = 0.95
            elif date_diff <= 2:
                confidence = 0.70
            else:
                continue

            # Description similarity boosts confidence
            if txn_desc and existing_desc:
                if txn_desc in existing_desc or existing_desc in txn_desc:
                    confidence = min(confidence + 0.04, 1.0)
                else:
                    # Simple character overlap ratio on the shorter substring
                    shorter = min(len(txn_desc), len(existing_desc))
                    if shorter > 0:
                        overlap = sum(
                            1 for a, b in zip(txn_desc[:shorter], existing_desc[:shorter])
                            if a == b
                        )
                        if overlap / shorter >= 0.6:
                            confidence = min(confidence + 0.03, 1.0)

            best_confidence = max(best_confidence, confidence)

        txn["is_duplicate"] = best_confidence >= 0.70
        txn["duplicate_confidence"] = round(best_confidence, 3)

    return parsed_transactions


# ── AI categorization ─────────────────────────────────────────────────────────

def categorize_parsed_transactions(parsed_transactions: list[dict]) -> list[dict]:
    """
    Calls categorize_merchant() (FAISS + Groq fallback) for each transaction.
    Attaches suggested_category and category_confidence to each dict.
    """
    for txn in parsed_transactions:
        description = str(txn.get("description", ""))
        try:
            result = categorize_merchant(description, description)
            txn["suggested_category"] = result.get("category", "Other")
            txn["category_confidence"] = round(float(result.get("confidence", 0.0)), 3)
        except Exception:
            txn["suggested_category"] = "Other"
            txn["category_confidence"] = 0.0
    return parsed_transactions
