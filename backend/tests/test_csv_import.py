import io


def test_preview_valid_csv(client, auth_headers):
    csv_content = (
        "Date,Description,Debit,Credit\n"
        "01/07/2026,Swiggy Order,500,\n"
        "02/07/2026,Salary Credit,,72000\n"
        "03/07/2026,Amazon Purchase,1200,\n"
    )
    files = {"file": ("statement.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    resp = client.post(
        "/import/csv/preview",
        files=files,
        data={"bank": "other"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_found"] == 2
    assert len(data["transactions"]) == 2
    assert len(data["income_entries"]) == 1


def test_preview_empty_file(client, auth_headers):
    files = {"file": ("empty.csv", io.BytesIO(b""), "text/csv")}
    resp = client.post(
        "/import/csv/preview",
        files=files,
        data={"bank": "other"},
        headers=auth_headers,
    )
    assert resp.status_code == 400
