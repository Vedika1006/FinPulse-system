"""
CSV import service — parses ICICI, HDFC, and generic bank CSVs.

Root cause of previous bug:
  pd.read_csv(..., header=None, on_bad_lines="skip") infers column count from
  row 0.  When the file starts with preamble lines that have fewer fields than
  the real header row, pandas treats the actual header as a "bad line" and
  silently drops it.  All three parsers now avoid pandas entirely during header
  detection: we scan the raw decoded text line-by-line to find the real header,
  then hand pandas only the clean tabular section.
"""

import io
from datetime import datetime
from typing import Any

import pandas as pd

from app.services.categorization_service import categorize_merchant


# ── Shared helpers ────────────────────────────────────────────────────────────

# Keywords that a real CSV header row will contain at least 2 of.
_HEADER_KEYWORDS = {
    "date", "transaction", "withdrawal", "deposit", "amount",
    "narration", "remarks", "particulars", "balance", "credit", "debit",
    "value", "description",
}


def _find_header_line(lines: list[str], min_matches: int = 2,
                      max_scan: int = 30) -> int:
    """
    Scan raw text lines (not a DataFrame) for the real CSV header row.

    A line qualifies when:
      - It contains at least one comma (it is actually comma-separated)
      - Its lowercase text contains at least `min_matches` of _HEADER_KEYWORDS

    Returns the 0-based line index, or -1 if not found.
    """
    for i, line in enumerate(lines[:max_scan]):
        if "," not in line:
            continue
        lower = line.lower()
        matches = sum(1 for kw in _HEADER_KEYWORDS if kw in lower)
        if matches >= min_matches:
            return i
    return -1


def _find_col(df: pd.DataFrame, candidates: list[str]) -> str | None:
    """Return the first column whose lowercase name contains any candidate string."""
    col_map = {c.lower().strip(): c for c in df.columns}
    for candidate in candidates:
        for lower_name, original_name in col_map.items():
            if candidate in lower_name:
                return original_name
    return None


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
    Handles both split debit/credit columns and a single signed-amount column.
    Blank cells in Withdrawal/Deposit columns are treated as 0 (not errors).
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
            # Split debit / credit columns — blank cell → 0.0, not an error
            debit = _clean_amount(row.get(debit_col)) if debit_col else 0.0
            credit = _clean_amount(row.get(credit_col)) if credit_col else 0.0
            if debit > 0:
                transactions.append({"date": date, "description": description,
                                     "amount": debit, "type": "debit"})
            if credit > 0:
                transactions.append({"date": date, "description": description,
                                     "amount": credit, "type": "credit"})

    return transactions


def _decode_and_split(file_bytes: bytes) -> list[str]:
    """
    Decode file bytes to text and split into lines.
    Uses 'utf-8-sig' to handle BOM characters some banks include.
    """
    text = file_bytes.decode("utf-8-sig", errors="ignore")
    return text.splitlines()


# ── Bank-specific parsers ─────────────────────────────────────────────────────

def parse_icici_csv(file_bytes: bytes) -> list[dict]:
    """
    ICICI bank statement CSV.

    Real files have several preamble lines before the table, e.g.:
        ICICI Bank Limited
        Statement of Account
        Account Number: XXXXXXXX1234
        ...
        Transaction Date,Value Date,Transaction Remarks,Withdrawal Amount (INR),Deposit Amount (INR),Balance (INR)
        01/05/2026,01/05/2026,SALARY CREDIT MAY-NEFT,,85000.00,85000.00

    We find the real header by scanning raw lines, not by asking pandas.
    """
    lines = _decode_and_split(file_bytes)
    header_idx = _find_header_line(lines, min_matches=2)

    if header_idx == -1:
        print("[CSV Import] ICICI header detection failed. First 10 lines received:")
        for i, line in enumerate(lines[:10]):
            print(f"  [{i}]: {repr(line)}")
        raise ValueError(
            "Could not detect transaction columns in ICICI CSV. "
            "Please download the full CSV statement: "
            "Accounts → Download Account Statement → CSV format."
        )

    # Give pandas only the clean tabular portion (header + data rows)
    csv_content = "\n".join(lines[header_idx:])
    df = pd.read_csv(io.StringIO(csv_content), dtype=str, on_bad_lines="skip")
    df.columns = [str(c).strip() for c in df.columns]

    date_col  = _find_col(df, ["transaction date", "txn date", "date"])
    desc_col  = _find_col(df, ["transaction remarks", "remarks", "narration",
                                "description", "particulars"])
    debit_col = _find_col(df, ["withdrawal amount", "withdrawal amt", "withdrawal",
                                "debit amount", "debit"])
    credit_col = _find_col(df, ["deposit amount", "deposit amt", "deposit",
                                 "credit amount", "credit"])

    if date_col is None or desc_col is None:
        print("[CSV Import] ICICI column mapping failed. Columns found:", list(df.columns))
        raise ValueError(
            "Could not detect transaction columns in ICICI CSV. "
            "Please download the full CSV statement: "
            "Accounts → Download Account Statement → CSV format."
        )

    return _rows_to_transactions(df, date_col, desc_col, debit_col, credit_col, None)


def parse_hdfc_csv(file_bytes: bytes) -> list[dict]:
    """
    HDFC bank statement CSV.

    Typical real-file preamble before the table:
        HDFC Bank
        Account Statement
        Account No: XXXXXXXXXXXX
        ...
        Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
    """
    lines = _decode_and_split(file_bytes)
    header_idx = _find_header_line(lines, min_matches=2)

    if header_idx == -1:
        print("[CSV Import] HDFC header detection failed. First 10 lines received:")
        for i, line in enumerate(lines[:10]):
            print(f"  [{i}]: {repr(line)}")
        raise ValueError(
            "Could not detect transaction columns in HDFC CSV. "
            "Please download the statement as CSV from the HDFC mobile app: "
            "Accounts → Statement → Download → CSV."
        )

    csv_content = "\n".join(lines[header_idx:])
    df = pd.read_csv(io.StringIO(csv_content), dtype=str, on_bad_lines="skip")
    df.columns = [str(c).strip() for c in df.columns]

    date_col  = _find_col(df, ["date", "transaction date", "value dt"])
    desc_col  = _find_col(df, ["narration", "description", "particulars", "remarks"])
    debit_col = _find_col(df, ["withdrawal amt", "withdrawal amount", "withdrawal",
                                "debit amount", "debit"])
    credit_col = _find_col(df, ["deposit amt", "deposit amount", "deposit",
                                 "credit amount", "credit"])

    if date_col is None or desc_col is None:
        print("[CSV Import] HDFC column mapping failed. Columns found:", list(df.columns))
        raise ValueError(
            "Could not detect transaction columns in HDFC CSV. "
            "Please download the statement as CSV from the HDFC mobile app: "
            "Accounts → Statement → Download → CSV."
        )

    return _rows_to_transactions(df, date_col, desc_col, debit_col, credit_col, None)


def parse_generic_csv(file_bytes: bytes) -> list[dict]:
    """
    Generic parser for any bank CSV. Auto-detects columns from common header patterns.
    """
    lines = _decode_and_split(file_bytes)
    header_idx = _find_header_line(lines, min_matches=1)  # more permissive for unknowns

    if header_idx == -1:
        print("[CSV Import] Generic header detection failed. First 10 lines received:")
        for i, line in enumerate(lines[:10]):
            print(f"  [{i}]: {repr(line)}")
        raise ValueError(
            "Could not detect transaction columns. Please check your file format. "
            "The file must include columns for date, description/narration, "
            "and amount (or separate debit/credit columns)."
        )

    csv_content = "\n".join(lines[header_idx:])
    df = pd.read_csv(io.StringIO(csv_content), dtype=str, on_bad_lines="skip")
    df.columns = [str(c).strip() for c in df.columns]

    date_col   = _find_col(df, ["date", "transaction date", "txn date", "value date"])
    desc_col   = _find_col(df, ["narration", "description", "particulars", "remarks",
                                 "transaction details", "details"])
    debit_col  = _find_col(df, ["withdrawal", "debit", "dr", "debit amount",
                                 "withdrawal amount", "dr amount"])
    credit_col = _find_col(df, ["deposit", "credit", "cr", "credit amount",
                                 "deposit amount", "cr amount"])
    amount_col = _find_col(df, ["amount", "transaction amount", "txn amount"])

    if date_col is None or desc_col is None:
        print("[CSV Import] Generic column mapping failed. Columns found:", list(df.columns))
        raise ValueError(
            "Could not detect transaction columns. Please check your file format. "
            "The file must include columns for date, description/narration, "
            "and amount (or separate debit/credit columns)."
        )

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
            existing_date = None
            if exp.date:
                existing_date = exp.date.date() if hasattr(exp.date, "date") else exp.date
            elif exp.created_at:
                existing_date = (exp.created_at.date()
                                 if hasattr(exp.created_at, "date") else exp.created_at)

            if existing_date is None:
                continue

            existing_amount = float(exp.amount or 0)
            existing_desc = str(exp.description or "").lower().strip()

            if abs(existing_amount - txn_amount) > 1.0:
                continue

            date_diff = abs((txn_date - existing_date).days)
            if date_diff == 0:
                confidence = 0.95
            elif date_diff <= 2:
                confidence = 0.70
            else:
                continue

            if txn_desc and existing_desc:
                if txn_desc in existing_desc or existing_desc in txn_desc:
                    confidence = min(confidence + 0.04, 1.0)
                else:
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
