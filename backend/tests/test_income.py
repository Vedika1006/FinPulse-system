from datetime import date


def _current_month():
    return date.today().strftime("%Y-%m")


def test_create_income(client, auth_headers):
    resp = client.post(
        "/income/",
        json={"month": _current_month(), "amount": 72000, "source": "Salary", "description": "Salary"},
        headers=auth_headers,
    )
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["amount"] == 72000


def test_create_recurring_income(client, auth_headers):
    resp = client.post(
        "/income/",
        json={
            "month": _current_month(),
            "amount": 72000,
            "is_recurring": True,
            "recurring_frequency": "monthly",
        },
        headers=auth_headers,
    )
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["is_recurring"] is True
    assert data["recurring_frequency"] == "monthly"


def test_get_income(client, auth_headers):
    month = _current_month()
    client.post(
        "/income/",
        json={"month": month, "amount": 72000, "description": "Salary"},
        headers=auth_headers,
    )

    resp = client.get(f"/income/{month}/", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["amount"] == 72000
    assert data["month"] == month
