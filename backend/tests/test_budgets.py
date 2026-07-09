from datetime import date


def _current_month():
    return date.today().strftime("%Y-%m")


def test_create_budget(client, auth_headers):
    resp = client.post(
        "/budgets/",
        json={"category": "Food", "amount": 5000, "month": _current_month()},
        headers=auth_headers,
    )
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["category"] == "food"
    assert data["amount"] == 5000


def test_get_budget_suggestions(client, auth_headers):
    resp = client.get("/budgets/suggestions", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_budget_vs_actual(client, auth_headers):
    month = _current_month()
    client.post(
        "/budgets/",
        json={"category": "Food", "amount": 5000, "month": month},
        headers=auth_headers,
    )
    client.post(
        "/expenses/",
        json={"amount": 500, "category": "Food", "date": date.today().isoformat()},
        headers=auth_headers,
    )

    resp = client.get(f"/budgets/vs-actual/{month}/", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    food_category = next(c for c in data["categories"] if c["category"] == "food")
    assert food_category["actual_spent"] == 500
    assert food_category["actual_spent"] < food_category["budget"]
    assert food_category["status"] == "Within Budget"
