from datetime import date

import pytest


def test_create_loan(client, auth_headers):
    resp = client.post(
        "/emi",
        json={
            "name": "Personal Loan",
            "loan_type": "personal",
            "principal": 100000,
            "interest_rate": 12,
            "tenure_months": 12,
            "start_date": date.today().isoformat(),
        },
        headers=auth_headers,
    )
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["emi_amount"] == pytest.approx(8885, abs=10)


def test_amortization_first_month(client, auth_headers):
    create_resp = client.post(
        "/emi",
        json={
            "name": "Personal Loan",
            "loan_type": "personal",
            "principal": 100000,
            "interest_rate": 12,
            "tenure_months": 12,
            "start_date": date.today().isoformat(),
        },
        headers=auth_headers,
    )
    debt_id = create_resp.json()["id"]

    resp = client.get(f"/emi/{debt_id}", headers=auth_headers)
    assert resp.status_code == 200
    first_month = resp.json()["schedule"][0]
    assert first_month["interest_component"] == pytest.approx(1000, abs=5)
    assert first_month["principal_component"] == pytest.approx(7885, abs=10)


def test_zero_interest_emi(client, auth_headers):
    resp = client.post(
        "/emi",
        json={
            "name": "No-Cost EMI",
            "loan_type": "consumer",
            "principal": 12000,
            "interest_rate": 0,
            "tenure_months": 12,
            "start_date": date.today().isoformat(),
        },
        headers=auth_headers,
    )
    assert resp.status_code in (200, 201)
    assert resp.json()["emi_amount"] == 1000.0
