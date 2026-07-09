"""
AI chat tests. The Groq client's chat.completions.create is mocked so this
test never needs a real GROQ_API_KEY and runs fast/deterministically in CI.
"""
from unittest.mock import MagicMock, patch

from app.services import ai_service


def test_chat_endpoint_shape(client, auth_headers):
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content="Here's a quick look at your spending."))]

    if ai_service.client is not None:
        with patch.object(ai_service.client.chat.completions, "create", return_value=mock_response):
            resp = client.post("/ai/chat", json={"message": "Hello"}, headers=auth_headers)
    else:
        # No GROQ_API_KEY configured (e.g. in CI) -> service already returns a
        # deterministic fallback reply without calling Groq at all.
        resp = client.post("/ai/chat", json={"message": "Hello"}, headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert "reply" in data
    assert isinstance(data["reply"], str)
