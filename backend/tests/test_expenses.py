"""
Expense CRUD tests.

Note: the create/update routes lowercase the category before storing it
(e.g. "Food" -> "food"), so assertions check the normalized lowercase form.
"""
from datetime import date


def test_create_expense(client, auth_headers):
    resp = client.post(
        "/expenses/",
        json={
            "amount": 500,
            "category": "Food",
            "description": "Swiggy lunch",
            "date": date.today().isoformat(),
        },
        headers=auth_headers,
    )
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["amount"] == 500
    assert data["category"] == "food"


def test_get_expenses(client, auth_headers):
    for category, amount in [("Food", 100), ("Transport", 200)]:
        client.post(
            "/expenses/",
            json={"amount": amount, "category": category, "date": date.today().isoformat()},
            headers=auth_headers,
        )

    resp = client.get("/expenses/", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 2


def test_create_expense_unauthorized(client):
    resp = client.post(
        "/expenses/",
        json={"amount": 500, "category": "Food", "date": date.today().isoformat()},
    )
    assert resp.status_code in (401, 403)


def test_delete_expense(client, auth_headers):
    create_resp = client.post(
        "/expenses/",
        json={"amount": 500, "category": "Food", "date": date.today().isoformat()},
        headers=auth_headers,
    )
    expense_id = create_resp.json()["id"]

    delete_resp = client.delete(f"/expenses/{expense_id}", headers=auth_headers)
    assert delete_resp.status_code == 200

    list_resp = client.get("/expenses/", headers=auth_headers)
    ids = [e["id"] for e in list_resp.json()]
    assert expense_id not in ids
