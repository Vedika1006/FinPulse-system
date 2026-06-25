import base64
import json
import os
from groq import Groq

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None


def scan_receipt(image_bytes: bytes, image_type: str = "image/jpeg") -> dict:
    if not GROQ_API_KEY or client is None:
        return {
            "amount": None,
            "merchant": None,
            "category": "other",
            "date": None,
            "description": "OCR unavailable — add GROQ_API_KEY and try again",
        }

    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    response = client.chat.completions.create(
        model="llama-3.2-11b-vision-preview",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{image_type};base64,{base64_image}"
                        }
                    },
                    {
                        "type": "text",
                        "text": """Analyze this receipt or bill image. 
                        Respond ONLY in JSON with no extra text, no markdown, no explanation:
                        {
                            "amount": <total amount as number only, no currency symbol>,
                            "merchant": "<store or restaurant name>",
                            "category": "<one of: Food, Transport, Shopping, Entertainment, Healthcare, Utilities, Groceries, Education, Other>",
                            "date": "<YYYY-MM-DD if visible, else null>",
                            "description": "<one line describing what was purchased>"
                        }"""
                    }
                ]
            }
        ],
        max_tokens=300
    )

    result_text = response.choices[0].message.content
    result_text = result_text.replace("```json", "").replace("```", "").strip()

    try:
        parsed = json.loads(result_text)
        if isinstance(parsed.get("category"), str):
            parsed["category"] = parsed["category"].strip().lower()
        return parsed
    except json.JSONDecodeError:
        return {
            "amount": None,
            "merchant": None,
            "category": "other",
            "date": None,
            "description": "Could not extract — please fill manually",
        }