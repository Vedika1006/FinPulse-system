"""
Goal tests.

Note: GoalCreate only accepts name/target_amount/deadline — saved_amount is
always 0.0 on creation and can only be changed afterwards via PUT.
"""


def test_create_goal(client, auth_headers):
    resp = client.post(
        "/goals/",
        json={"name": "Emergency Fund", "target_amount": 200000},
        headers=auth_headers,
    )
    assert resp.status_code in (200, 201)
    data = resp.json()
    assert data["name"] == "Emergency Fund"
    assert data["target_amount"] == 200000
    assert data["saved_amount"] == 0.0


def test_update_goal(client, auth_headers):
    create_resp = client.post(
        "/goals/",
        json={"name": "Emergency Fund", "target_amount": 200000},
        headers=auth_headers,
    )
    goal_id = create_resp.json()["id"]

    resp = client.put(
        f"/goals/{goal_id}",
        json={"saved_amount": 50000},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["saved_amount"] == 50000


def test_reject_negative_saved_amount(client, auth_headers):
    create_resp = client.post(
        "/goals/",
        json={"name": "Emergency Fund", "target_amount": 200000},
        headers=auth_headers,
    )
    goal_id = create_resp.json()["id"]

    resp = client.put(
        f"/goals/{goal_id}",
        json={"saved_amount": -1000},
        headers=auth_headers,
    )
    assert resp.status_code == 422
