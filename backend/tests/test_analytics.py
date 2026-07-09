def test_health_score(client, auth_headers, seed_data):
    resp = client.get(
        "/analytics/health-score/",
        params={"month": seed_data["month"]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data["score"], (int, float))
    assert 0 <= data["score"] <= 100


def test_anomalies_insufficient_data(client, auth_headers):
    # Fewer than 10 expenses -> anomaly detection should report insufficient_data
    for i in range(3):
        client.post(
            "/expenses/",
            json={"amount": 100 + i, "category": "Food"},
            headers=auth_headers,
        )

    resp = client.get("/analytics/anomalies", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["method"] == "insufficient_data"
