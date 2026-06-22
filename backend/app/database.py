import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

_BACKEND_DIR = Path(__file__).resolve().parents[1]


def _build_database_url() -> str:
    """
    Priority:
    1) USE_SQLITE=1 / true / yes → SQLite file under backend/
    2) DATABASE_URL set → Postgres (postgresql+psycopg) or other URL as given
    3) Neither → SQLite by default so local dev works without Postgres or credentials

    Postgres URLs using postgresql:// are rewritten to postgresql+psycopg:// (psycopg v3).
    """
    force_sqlite = os.getenv("USE_SQLITE", "").strip().lower() in ("1", "true", "yes")
    env_url = os.getenv("DATABASE_URL", "").strip()

    if force_sqlite or not env_url:
        db_path = _BACKEND_DIR / "expense_ai.db"
        return f"sqlite:///{db_path.as_posix()}"

    url = env_url
    if url.startswith("postgresql://") and not url.startswith("postgresql+psycopg"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)

    return url


DATABASE_URL = _build_database_url()

_connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=_connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
