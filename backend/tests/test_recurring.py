from datetime import date, timedelta

from sqlalchemy.orm import sessionmaker

from app.models import Expense, Recurring
from app.services.recurring_service import process_due_recurring


def test_create_recurring(client, auth_headers):
    resp = client.post(
        "/recurring",
        json={
            "description": "Netflix",
            "amount": 649,
            "category": "entertainment",
            "frequency": "monthly",
            "next_due_date": (date.today() + timedelta(days=25)).isoformat(),
        },
        headers=auth_headers,
    )
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["description"] == "Netflix"
    assert data["amount"] == 649


def test_process_due_recurring(client, auth_headers, db_engine):
    past_due = date.today() - timedelta(days=1)
    create_resp = client.post(
        "/recurring",
        json={
            "description": "Netflix",
            "amount": 649,
            "category": "entertainment",
            "frequency": "monthly",
            "next_due_date": past_due.isoformat(),
        },
        headers=auth_headers,
    )
    recurring_id = create_resp.json()["id"]

    SessionLocal = sessionmaker(bind=db_engine)
    db = SessionLocal()
    try:
        created_count = process_due_recurring(db)
        assert created_count >= 1

        item = db.query(Recurring).filter(Recurring.id == recurring_id).first()
        assert item.next_due_date > past_due

        expense = db.query(Expense).filter(Expense.description == "Netflix").first()
        assert expense is not None
        assert float(expense.amount) == 649
    finally:
        db.close()
