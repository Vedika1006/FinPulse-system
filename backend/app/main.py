from fastapi import FastAPI, HTTPException
from sqlalchemy.exc import SQLAlchemyError
import threading
from contextlib import asynccontextmanager

from app.database import engine, Base
from app import models
from app.routes import auth, expenses, budgets, analytics, ai, income, goals, receipts
from app.services.categorization_service import _load as warm_faiss

from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text


from app.core.exception_handler import (
    http_exception_handler,
    sqlalchemy_exception_handler,
    global_exception_handler
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    def _warm():
        try:
            warm_faiss()
            print("[FAISS] Warm-up complete ✓")
        except Exception as exc:
            print(f"[FAISS] Warm-up failed (Groq fallback still works): {exc}")

    threading.Thread(target=_warm, daemon=True).start()
    yield


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


@app.get("/")
def root():
    return {"message": "Expense AI Backend Running"}