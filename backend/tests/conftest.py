"""
Shared pytest fixtures for the FinPulse backend test suite.

Everything here runs against an in-memory SQLite database — this file must
NEVER connect to the real Neon PostgreSQL database. USE_SQLITE is forced on
before app.database (and anything that imports it) is loaded, so even if a
developer's shell has DATABASE_URL pointing at Neon, tests still use SQLite.
"""
import os

os.environ["USE_SQLITE"] = "1"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app

TEST_EMAIL = "testuser@example.com"
TEST_PASSWORD = "TestPass123!"


@pytest.fixture()
def db_engine():
    """A brand-new in-memory SQLite engine, with all tables created fresh."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture()
def client(db_engine):
    """FastAPI TestClient wired up to the per-test in-memory database."""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers(client):
    """Registers a test user and returns Bearer auth headers for it."""
    client.post(
        "/auth/register",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD, "name": "Test User"},
    )
    resp = client.post(
        "/auth/login",
        data={"username": TEST_EMAIL, "password": TEST_PASSWORD},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def seed_data(client, auth_headers):
    """
    Baseline dataset for tests that need pre-existing data:
    5 expenses across different categories/dates, 1 income record,
    2 budgets, 1 goal.
    """
    from datetime import date, timedelta

    today = date.today()
    current_month = today.strftime("%Y-%m")

    expense_specs = [
        (500, "Food", "Swiggy lunch", 1),
        (1200, "Groceries", "BigBasket order", 2),
        (300, "Transport", "Uber ride", 3),
        (900, "Entertainment", "Netflix + movie", 4),
        (2000, "Shopping", "Amazon order", 5),
    ]
    expenses = []
    for amount, category, description, days_ago in expense_specs:
        resp = client.post(
            "/expenses/",
            json={
                "amount": amount,
                "category": category,
                "description": description,
                "date": (today - timedelta(days=days_ago)).isoformat(),
            },
            headers=auth_headers,
        )
        expenses.append(resp.json())

    income_resp = client.post(
        "/income/",
        json={"month": current_month, "amount": 72000, "description": "Salary"},
        headers=auth_headers,
    )

    budget_specs = [("Food", 5000), ("Transport", 2000)]
    budgets = []
    for category, amount in budget_specs:
        resp = client.post(
            "/budgets/",
            json={"category": category, "amount": amount, "month": current_month},
            headers=auth_headers,
        )
        budgets.append(resp.json())

    goal_resp = client.post(
        "/goals/",
        json={"name": "Emergency Fund", "target_amount": 100000},
        headers=auth_headers,
    )

    return {
        "expenses": expenses,
        "income": income_resp.json(),
        "budgets": budgets,
        "goal": goal_resp.json(),
        "month": current_month,
    }
