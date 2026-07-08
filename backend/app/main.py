from fastapi import FastAPI, HTTPException
from sqlalchemy.exc import SQLAlchemyError
import threading
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler

from app.database import engine, Base, SessionLocal
from app import models
from app.routes import auth, expenses, budgets, analytics, ai, income, goals, receipts, imports, auto_save_rules, recurring, emi, tax
from app.services.categorization_service import _load as warm_faiss
from app.services.recurring_service import process_due_recurring

from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text


from app.core.exception_handler import (
    http_exception_handler,
    sqlalchemy_exception_handler,
    global_exception_handler
)


def _run_process_due_recurring() -> None:
    db = SessionLocal()
    try:
        count = process_due_recurring(db)
        if count:
            print(f"[Recurring] Auto-created {count} expense(s) from due recurring items")
    except Exception as exc:
        print(f"[Recurring] process_due_recurring failed: {exc}")
    finally:
        db.close()


scheduler = BackgroundScheduler(timezone="Asia/Kolkata")
scheduler.add_job(
    _run_process_due_recurring,
    "cron",
    hour=0,
    minute=30,
    id="process_due_recurring",
    replace_existing=True,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    def _warm():
        try:
            warm_faiss()
        except Exception as exc:
            print(f"[FAISS] Warm-up failed (Groq fallback still works): {exc}")
            return
        # Separate try/except so a console-encoding issue with this print
        # (e.g. non-UTF-8 Windows terminals) can never be mistaken for a
        # FAISS loading failure.
        try:
            print("[FAISS] Warm-up complete (OK)")
        except Exception:
            pass

    threading.Thread(target=_warm, daemon=True).start()
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(lifespan=lifespan)

# ✅ Register handlers FIRST (best practice)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(SQLAlchemyError, sqlalchemy_exception_handler)
app.add_exception_handler(Exception, global_exception_handler)

# CORS before routes: Bearer auth uses headers, not cookies — avoid allow_origins=["*"] with
# allow_credentials=True (browsers block that). Regex covers any local dev port (Vite, etc.).
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origins=["https://fin-pulse-system.vercel.app"],
)

# ✅ Then DB setup
Base.metadata.create_all(bind=engine)

# Lightweight migrations (no Alembic) — keep startup safe.
def _ensure_schema() -> None:
    try:
        with engine.begin() as conn:
            # Add users.name if missing (SQLite/Postgres safe-ish; ignore failures)
            try:
                # SQLite: pragma_table_info, Postgres: information_schema
                if str(engine.url).startswith("sqlite"):
                    cols = [r[1] for r in conn.execute(text("PRAGMA table_info(users)")).fetchall()]
                    if "name" not in cols:
                        conn.execute(text("ALTER TABLE users ADD COLUMN name VARCHAR"))
                else:
                    exists = conn.execute(
                        text(
                            "SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='name' LIMIT 1"
                        )
                    ).first()
                    if not exists:
                        conn.execute(text("ALTER TABLE users ADD COLUMN name VARCHAR"))
            except Exception:
                pass

            # Goals: add saved_amount if missing
            try:
                if str(engine.url).startswith("sqlite"):
                    goal_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(goals)")).fetchall()]
                    if "saved_amount" not in goal_cols:
                        conn.execute(text("ALTER TABLE goals ADD COLUMN saved_amount FLOAT DEFAULT 0.0"))
                else:
                    exists_saved = conn.execute(
                        text("SELECT 1 FROM information_schema.columns WHERE table_name='goals' AND column_name='saved_amount' LIMIT 1")
                    ).first()
                    if not exists_saved:
                        conn.execute(text("ALTER TABLE goals ADD COLUMN saved_amount FLOAT DEFAULT 0.0"))
            except Exception:
                pass

            # Expenses: add note/date columns, normalize categories (safe no-op on failure)
            try:
                if str(engine.url).startswith("sqlite"):
                    exp_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(expenses)")).fetchall()]
                    if "note" not in exp_cols:
                        conn.execute(text("ALTER TABLE expenses ADD COLUMN note VARCHAR"))
                    if "date" not in exp_cols:
                        conn.execute(text("ALTER TABLE expenses ADD COLUMN date DATETIME"))
                    # Normalize categories and ensure non-empty
                    conn.execute(text("UPDATE expenses SET category = lower(trim(category)) WHERE category IS NOT NULL"))
                    conn.execute(text("UPDATE expenses SET category = 'uncategorized' WHERE category IS NULL OR trim(category) = ''"))
                else:
                    exists_note = conn.execute(
                        text("SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='note' LIMIT 1")
                    ).first()
                    if not exists_note:
                        conn.execute(text("ALTER TABLE expenses ADD COLUMN note VARCHAR"))
                    exists_date = conn.execute(
                        text("SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='date' LIMIT 1")
                    ).first()
                    if not exists_date:
                        conn.execute(text("ALTER TABLE expenses ADD COLUMN date TIMESTAMP"))
                    conn.execute(text("UPDATE expenses SET category = lower(trim(category)) WHERE category IS NOT NULL"))
                    conn.execute(text("UPDATE expenses SET category = 'uncategorized' WHERE category IS NULL OR btrim(category) = ''"))
            except Exception:
                pass

            # Budgets: add limit column, normalize categories, backfill limit from amount
            try:
                if str(engine.url).startswith("sqlite"):
                    bud_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(budgets)")).fetchall()]
                    # Use limit_amount to avoid SQLite keyword conflicts ("limit")
                    if "limit_amount" not in bud_cols:
                        conn.execute(text("ALTER TABLE budgets ADD COLUMN limit_amount FLOAT"))
                    conn.execute(text("UPDATE budgets SET category = lower(trim(category)) WHERE category IS NOT NULL"))
                    conn.execute(text("UPDATE budgets SET category = 'uncategorized' WHERE category IS NULL OR trim(category) = ''"))
                    conn.execute(text("UPDATE budgets SET limit_amount = amount WHERE limit_amount IS NULL"))
                else:
                    exists_limit = conn.execute(
                        text("SELECT 1 FROM information_schema.columns WHERE table_name='budgets' AND column_name='limit_amount' LIMIT 1")
                    ).first()
                    if not exists_limit:
                        conn.execute(text("ALTER TABLE budgets ADD COLUMN limit_amount DOUBLE PRECISION"))
                    conn.execute(text("UPDATE budgets SET category = lower(trim(category)) WHERE category IS NOT NULL"))
                    conn.execute(text("UPDATE budgets SET category = 'uncategorized' WHERE category IS NULL OR btrim(category) = ''"))
                    conn.execute(text("UPDATE budgets SET limit_amount = amount WHERE limit_amount IS NULL"))
            except Exception:
                pass

            # Budgets: add rollover_enabled column
            try:
                if str(engine.url).startswith("sqlite"):
                    bud_cols2 = [r[1] for r in conn.execute(text("PRAGMA table_info(budgets)")).fetchall()]
                    if "rollover_enabled" not in bud_cols2:
                        conn.execute(text("ALTER TABLE budgets ADD COLUMN rollover_enabled BOOLEAN DEFAULT 0 NOT NULL"))
                else:
                    exists_ro = conn.execute(
                        text("SELECT 1 FROM information_schema.columns WHERE table_name='budgets' AND column_name='rollover_enabled' LIMIT 1")
                    ).first()
                    if not exists_ro:
                        conn.execute(text("ALTER TABLE budgets ADD COLUMN rollover_enabled BOOLEAN DEFAULT FALSE NOT NULL"))
            except Exception:
                pass

            # Recurring: add is_paused column
            try:
                if str(engine.url).startswith("sqlite"):
                    rec_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(recurring)")).fetchall()]
                    if "is_paused" not in rec_cols:
                        conn.execute(text("ALTER TABLE recurring ADD COLUMN is_paused BOOLEAN DEFAULT 0 NOT NULL"))
                else:
                    exists_paused = conn.execute(
                        text("SELECT 1 FROM information_schema.columns WHERE table_name='recurring' AND column_name='is_paused' LIMIT 1")
                    ).first()
                    if not exists_paused:
                        conn.execute(text("ALTER TABLE recurring ADD COLUMN is_paused BOOLEAN DEFAULT FALSE NOT NULL"))
            except Exception:
                pass

            # Income: add is_recurring / recurring_frequency columns
            try:
                if str(engine.url).startswith("sqlite"):
                    inc_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(income)")).fetchall()]
                    if "is_recurring" not in inc_cols:
                        conn.execute(text("ALTER TABLE income ADD COLUMN is_recurring BOOLEAN DEFAULT 0 NOT NULL"))
                    if "recurring_frequency" not in inc_cols:
                        conn.execute(text("ALTER TABLE income ADD COLUMN recurring_frequency VARCHAR"))
                else:
                    exists_recurring = conn.execute(
                        text("SELECT 1 FROM information_schema.columns WHERE table_name='income' AND column_name='is_recurring' LIMIT 1")
                    ).first()
                    if not exists_recurring:
                        conn.execute(text("ALTER TABLE income ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE NOT NULL"))
                    exists_freq = conn.execute(
                        text("SELECT 1 FROM information_schema.columns WHERE table_name='income' AND column_name='recurring_frequency' LIMIT 1")
                    ).first()
                    if not exists_freq:
                        conn.execute(text("ALTER TABLE income ADD COLUMN recurring_frequency VARCHAR"))
            except Exception:
                pass

            # Income: add auto_filled column (was this row created by process_recurring_income?)
            try:
                if str(engine.url).startswith("sqlite"):
                    inc_cols2 = [r[1] for r in conn.execute(text("PRAGMA table_info(income)")).fetchall()]
                    if "auto_filled" not in inc_cols2:
                        conn.execute(text("ALTER TABLE income ADD COLUMN auto_filled BOOLEAN DEFAULT 0 NOT NULL"))
                else:
                    exists_auto_filled = conn.execute(
                        text("SELECT 1 FROM information_schema.columns WHERE table_name='income' AND column_name='auto_filled' LIMIT 1")
                    ).first()
                    if not exists_auto_filled:
                        conn.execute(text("ALTER TABLE income ADD COLUMN auto_filled BOOLEAN DEFAULT FALSE NOT NULL"))
            except Exception:
                pass

            # Income: add description / date columns (manual "Your Income" entry form)
            try:
                if str(engine.url).startswith("sqlite"):
                    inc_cols3 = [r[1] for r in conn.execute(text("PRAGMA table_info(income)")).fetchall()]
                    if "description" not in inc_cols3:
                        conn.execute(text("ALTER TABLE income ADD COLUMN description VARCHAR"))
                    if "date" not in inc_cols3:
                        conn.execute(text("ALTER TABLE income ADD COLUMN date DATETIME"))
                else:
                    exists_desc = conn.execute(
                        text("SELECT 1 FROM information_schema.columns WHERE table_name='income' AND column_name='description' LIMIT 1")
                    ).first()
                    if not exists_desc:
                        conn.execute(text("ALTER TABLE income ADD COLUMN description VARCHAR"))
                    exists_date = conn.execute(
                        text("SELECT 1 FROM information_schema.columns WHERE table_name='income' AND column_name='date' LIMIT 1")
                    ).first()
                    if not exists_date:
                        conn.execute(text("ALTER TABLE income ADD COLUMN date TIMESTAMP"))
            except Exception:
                pass
    except Exception:
        pass


_ensure_schema()

# ✅ Then routes
app.include_router(auth.router)
app.include_router(expenses.router)
app.include_router(budgets.router)
app.include_router(analytics.router)
app.include_router(ai.router)
app.include_router(income.router)
app.include_router(goals.router)
app.include_router(receipts.router)
app.include_router(imports.router)
app.include_router(auto_save_rules.router)
app.include_router(recurring.router)
app.include_router(emi.router)
app.include_router(tax.router)


@app.get("/")
def root():
    return {"message": "Expense AI Backend Running"}