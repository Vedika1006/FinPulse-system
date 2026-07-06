import base64
import json
import os
from groq import Groq

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# llama-3.2-11b-vision-preview was decommissioned by Groq. This is currently
# the only vision-capable (text+image input) model in Groq's active model
# list — confirmed via client.models.list(). Env-configurable so a future
# deprecation only needs an env var change, not a code change.
GROQ_VISION_MODEL = os.getenv("GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

UNAVAILABLE_MESSAGE = "Receipt scanning is temporarily unavailable. Please enter the expense manually."


def scan_receipt(image_bytes: bytes, image_type: str = "image/jpeg") -> dict:
    if not GROQ_API_KEY or client is None:
        return {"success": False, "error": "OCR unavailable — add GROQ_API_KEY and try again"}

    base64_image = base64.b64encode(image_bytes).decode("utf-8")

    try:
        response = client.chat.completions.create(
            model=GROQ_VISION_MODEL,
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
        if not result_text:
            return {"success": False, "error": UNAVAILABLE_MESSAGE}
        result_text = result_text.replace("```json", "").replace("```", "").strip()
    except Exception as exc:
        print(f"[OCR] Groq vision call failed: {exc}")
        return {"success": False, "error": UNAVAILABLE_MESSAGE}

    try:
        parsed = json.loads(result_text)
        if isinstance(parsed.get("category"), str):
            parsed["category"] = parsed["category"].strip().lower()
        parsed["success"] = True
        return parsed
    except json.JSONDecodeError:
        return {
            "success": True,
            "amount": None,
            "merchant": None,
            "category": "other",
            "date": None,
            "description": "Could not extract — please fill manually",
        }
