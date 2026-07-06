import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from groq import Groq

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

logger = logging.getLogger("uvicorn.error")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Groq periodically deprecates/decommissions model IDs — llama3-70b-8192 and
# mixtral-8x7b-32768 are already gone; llama-3.1-8b-instant and
# llama-3.3-70b-versatile were announced deprecated on 2026-06-17 (still
# active as of this writing, confirmed via client.models.list()). Model IDs
# are env-configurable so a future deprecation only needs an env var change,
# not a code change.
GROQ_CHAT_MODEL = os.getenv("GROQ_CHAT_MODEL", "llama-3.3-70b-versatile")
GROQ_FAST_MODEL = os.getenv("GROQ_FAST_MODEL", "llama-3.1-8b-instant")
GROQ_MODEL = os.getenv("GROQ_MODEL", GROQ_FAST_MODEL)  # back-compat alias

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

FALLBACK_LINE = "AI insights temporarily unavailable. Try reducing unnecessary expenses."
MODEL_CANDIDATES = [
    GROQ_MODEL,
    GROQ_CHAT_MODEL,
    GROQ_FAST_MODEL,
    "openai/gpt-oss-120b",
    "qwen/qwen3-32b",
]


def _fallback_insights(
    total_expense: float,
    total_budget: float,
    savings_rate: float,
    top_category: Optional[Dict[str, Any]],
) -> list[str]:
    return [
        "Insight: Your spending is concentrated and needs tighter control.",
        "Risk level: Medium",
        "Suggested action: Reduce non-essential expenses by at least 10% this month.",
        "Priority: High",
    ]


def _to_lines(text: str) -> list[str]:
    if not text or not text.strip():
        return []

    lines: list[str] = []
    for raw in text.splitlines():
        line = raw.strip().lstrip("-*").strip()
        if line:
            lines.append(line)
    return lines


def _build_summary(
    total_expense: float,
    total_budget: float,
    savings_rate: float,
    top_category: Optional[Dict[str, Any]],
) -> str:
    top_text = "None"
    if top_category and top_category.get("category"):
        top_amount = float(top_category.get("total", 0))
        top_text = f"{top_category['category']} (approx Rs {top_amount:.2f})"

    return (
        f"Total spending: Rs {float(total_expense):.2f}\n"
        f"Total budget: Rs {float(total_budget):.2f}\n"
        f"Savings rate: {float(savings_rate):.1f}%\n"
        f"Top spending category: {top_text}"
    )


def generate_financial_insight(
    total_expense: float,
    total_budget: float,
    savings_rate: float,
    top_category: Optional[Dict[str, Any]] = None,
) -> list[str]:
    if not GROQ_API_KEY or client is None:
        return _fallback_insights(total_expense, total_budget, savings_rate, top_category)

    summary = _build_summary(total_expense, total_budget, savings_rate, top_category)
    overspend = max(0.0, float(total_expense) - float(total_budget or 0))
    user_stats = {
        "top_category": top_category.get("category") if top_category else None,
        "top_category_total": float(top_category.get("total", 0)) if top_category else 0.0,
        "total_expense": float(total_expense),
        "total_budget": float(total_budget),
        "overspend": float(overspend),
        "savings_rate": float(savings_rate),
    }

    for model_name in list(dict.fromkeys([m for m in MODEL_CANDIDATES if m])):
        try:
            response = client.chat.completions.create(
                model=model_name,
                temperature=0.3,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a fintech financial insights assistant. You must be data-driven and explainable. "
                            "Never give generic advice. Always reference the user's numbers."
                        ),
                    },
                    {
                        "role": "user",
                        "content": f"""
Return EXACTLY 4 lines in this format (no numbering, no extra text):

Insight: <one specific insight with ₹ and/or % from the data>
Risk: <Low/Medium/High>
Reason: <why, using at least 2 numbers from the data>
Action: <one concrete next step with a numeric target (₹ or %)>

Rules:
- ALWAYS include real numbers from the Data (₹, %)
- NEVER give generic advice (must be tied to Data)
- ALWAYS include a Reason line
- Keep each line short and clear (1 sentence)

Data:
{summary}

UserStats(JSON):
{_safe_json(user_stats)}
""",
                    },
                ],
            )

            content = (response.choices[0].message.content or "").strip()
            lines = _to_lines(content)

            if len(lines) >= 4:
                return lines[:4]

        except Exception:
            continue

    return _fallback_insights(total_expense, total_budget, savings_rate, top_category)


def generate_insights(expenses_summary: str | Dict[str, Any]) -> str:
    if not GROQ_API_KEY or client is None:
        return FALLBACK_LINE

    if isinstance(expenses_summary, dict):
        payload = "\n".join(f"{k}: {v}" for k, v in expenses_summary.items())
    else:
        payload = str(expenses_summary)

    for model_name in list(dict.fromkeys([m for m in MODEL_CANDIDATES if m])):
        try:
            response = client.chat.completions.create(
                model=model_name,
                temperature=0.3,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a professional financial advisor AI.",
                    },
                    {
                        "role": "user",
                        "content": f"""
You are a professional financial advisor AI.

Analyze the user's expense data and return EXACTLY 4 insights:

Insight: (main spending observation)
Risk level: (Low/Medium/High)
Suggested action: (clear actionable advice)
Priority: (High/Medium/Low)

Rules:
- Do NOT number the output
- Each line must start with: Insight:, Risk level:, Suggested action:, Priority:
- Keep each line short (1 sentence)
- No repetition
- No extra text

Data:
{payload}
""",
                    },
                ],
            )

            content = (response.choices[0].message.content or "").strip()
            if content:
                return content

        except Exception:
            continue

    return FALLBACK_LINE


def _safe_json(value: Any) -> str:
    try:
        import json

        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    except Exception:
        return str(value)


def _has_number(text: str) -> bool:
    if not text:
        return False
    return any(ch.isdigit() for ch in text)


def _is_plan_request(message: str) -> bool:
    m = (message or "").strip().lower()
    if not m:
        return False
    triggers = [
        "make a plan",
        "make plan",
        "plan according to my expenses",
        "plan based on my expenses",
        "plan based on my spending",
        "budget plan",
        "financial plan",
    ]
    return any(t in m for t in triggers)


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except Exception:
        return default


def _norm_cat(value: Any) -> str:
    return str(value or "").strip().lower()


def _title_cat(value: str) -> str:
    v = str(value or "").strip()
    if not v:
        return ""
    parts = [p for p in v.replace("_", " ").replace("-", " ").split(" ") if p]
    return " ".join(p[:1].upper() + p[1:].lower() for p in parts)


def _extract_user_name(data: Optional[Dict[str, Any]], memory: Optional[Dict[str, Any]]) -> str:
    for src in (data or {}, memory or {}):
        for k in ("name", "user_name", "userName", "fullName", "full_name", "displayName", "display_name"):
            v = src.get(k)
            if isinstance(v, str) and v.strip():
                return v.strip().split()[0].title()
    return "Friend"


def _build_finance_snapshot(data: Optional[Dict[str, Any]]) -> dict[str, Any]:
    """
    Build a consistent snapshot from whatever the frontend sends.
    Preferred:
      { total_expense, top_categories, category_breakdown, budget_data }
    Also supports common shapes used across pages (expenses rows, budget vs actual, etc).
    """
    d = data or {}

    total_expense = _safe_float(d.get("total_expense"), default=0.0)

    raw_breakdown = d.get("category_breakdown") or {}
    breakdown: dict[str, float] = {}
    if isinstance(raw_breakdown, dict):
        for k, v in raw_breakdown.items():
            cat = _norm_cat(k)
            if not cat:
                continue
            breakdown[cat] = breakdown.get(cat, 0.0) + _safe_float(v, 0.0)

    raw_budget_data = d.get("budget_data") or {}
    budget_data: dict[str, float] = {}
    if isinstance(raw_budget_data, dict):
        for k, v in raw_budget_data.items():
            cat = _norm_cat(k)
            if not cat:
                continue
            budget_data[cat] = _safe_float(v, 0.0)

    # Derive from expenses rows if present.
    rows = d.get("expenses") or d.get("rows") or d.get("recentExpenses") or None
    if isinstance(rows, list):
        for r in rows:
            if not isinstance(r, dict):
                continue
            cat = _norm_cat(r.get("category"))
            amt = _safe_float(r.get("amount"), 0.0)
            if cat and amt > 0:
                breakdown[cat] = breakdown.get(cat, 0.0) + amt
                total_expense += amt

    # Derive budget + spent from budgets page shape.
    cats = d.get("categories")
    if isinstance(cats, list):
        for c in cats:
            if not isinstance(c, dict):
                continue
            cat = _norm_cat(c.get("category") or c.get("name"))
            limit = _safe_float(c.get("limit") or c.get("budget"), 0.0)
            spent = _safe_float(c.get("spent") or c.get("actual_spent"), 0.0)
            if cat and limit > 0:
                budget_data[cat] = max(budget_data.get(cat, 0.0), limit)
            if cat and spent > 0:
                breakdown[cat] = breakdown.get(cat, 0.0) + spent

    if total_expense <= 0 and breakdown:
        total_expense = float(sum(breakdown.values()))

    top_categories = d.get("top_categories")
    if isinstance(top_categories, list) and top_categories:
        top_list: list[str] = []
        for x in top_categories:
            if isinstance(x, str) and x.strip():
                top_list.append(_norm_cat(x))
            elif isinstance(x, dict):
                top_list.append(_norm_cat(x.get("category") or x.get("name")))
        top_list = [c for c in top_list if c]
    else:
        top_list = [k for k, _ in sorted(breakdown.items(), key=lambda kv: kv[1], reverse=True)[:5]]

    budgets_present = bool(budget_data) and any(v > 0 for v in budget_data.values())

    overspend_by_cat: dict[str, float] = {}
    overspend_total = 0.0
    if budgets_present:
        for cat, spent in breakdown.items():
            b = budget_data.get(cat, 0.0)
            if b > 0 and spent > b:
                over = round(spent - b, 2)
                overspend_by_cat[cat] = over
                overspend_total += float(over)

    return {
        "total_expense": round(float(total_expense), 2),
        "top_categories": top_list,
        "category_breakdown": {k: round(v, 2) for k, v in breakdown.items()},
        "budget_data": {k: round(v, 2) for k, v in budget_data.items()},
        "budgets_present": budgets_present,
        "overspend_by_category": overspend_by_cat,
        "overspend_total": round(float(overspend_total), 2) if budgets_present else None,
        "budget_note": None if budgets_present else "No budgets set for this month",
    }


def _empty_data_plan() -> str:
    return "\n".join(
        [
            "⚠️ No data available",
            "",
            "Steps:",
            "- Add your first expense",
            "- Set a budget",
            "- Come back for insights",
        ]
    )


def _looks_structured_plan(text: str) -> bool:
    t = (text or "").strip()
    if not t:
        return False
    required = ["Summary:", "Top Issues:", "Spending Breakdown:", "Action Plan:", "Priority:"]
    return all(r in t for r in required) and ("\n- " in t or "\n• " in t or "\n* " in t)


def _clean_ai_response(text: str) -> str:
    """
    Normalize Groq output to a clean, UI-friendly format:
    - Convert '*' bullets to '-' bullets
    - Remove markdown fences
    - Ensure consistent blank lines between sections
    """
    if not text:
        return ""
    t = str(text).replace("\r\n", "\n").replace("\r", "\n").strip()

    # Remove code fences if any
    t = t.replace("```", "")

    lines = [ln.strip() for ln in t.split("\n")]
    out: list[str] = []
    for ln in lines:
        if not ln:
            # collapse multiple blank lines later
            out.append("")
            continue
        # Convert markdown bullets to '-' (frontend strips marker anyway)
        if ln.startswith("* "):
            ln = "- " + ln[2:].strip()
        # Avoid accidental numbered lists becoming paragraphs
        out.append(ln)

    # Collapse excessive blank lines
    cleaned: list[str] = []
    prev_blank = False
    for ln in out:
        blank = ln == ""
        if blank and prev_blank:
            continue
        cleaned.append(ln)
        prev_blank = blank

    # Keep spacing readable without forcing a fixed template.
    final: list[str] = []
    prev_blank = False
    for ln in cleaned:
        blank = ln == ""
        if blank and prev_blank:
            continue
        final.append(ln)
        prev_blank = blank
    return "\n".join(final).strip()


def _normalize_paragraphs(text: str) -> str:
    lines = [ln.rstrip() for ln in (text or "").splitlines()]
    return "\n".join(lines).strip()


def _infer_intent(message: str) -> str:
    m = (message or "").strip().lower()
    if not m:
        return "unknown"

    knowledge_terms = [
        "invest", "elss", "ppf", "nps", "sip", "mutual fund", "tax saving", "tax-saving",
        "80c", "80d", "hra", "tax regime", "cibil", "credit score", "term insurance",
        "health insurance", "ulip", "sgb", "gold bond", "fixed deposit", "fd rate",
        "credit card interest", "emergency fund", "which is better", "should i invest",
    ]
    health_terms = ["health score", "financial health", "healthscore", "score"]
    budget_terms = ["budget", "budgets", "limit", "cap", "set budget", "over budget"]
    expense_terms = ["expense", "expenses", "spend", "spent", "transactions", "purchase"]
    savings_terms = ["saving", "savings", "save", "left", "remaining"]
    overview_terms = [
        "whole",
        "full",
        "all details",
        "complete",
        "overview",
        "everything",
        "dashboard",
        "analytics",
        "report",
    ]
    advice_terms = ["what should i do", "next best", "suggest", "advice", "plan", "help me", "improve"]

    if any(t in m for t in knowledge_terms):
        return "knowledge"
    if any(t in m for t in health_terms):
        return "health"
    if any(t in m for t in budget_terms):
        return "budget"
    if any(t in m for t in expense_terms):
        return "expenses"
    if any(t in m for t in savings_terms):
        return "savings"
    if any(t in m for t in advice_terms):
        return "advice"
    if any(t in m for t in overview_terms):
        return "overview"
    return "unknown"


def generate_chat_reply(
    message: str,
    context: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None,
    memory: Optional[Dict[str, Any]] = None,
    rag_context: Optional[str] = None,
    knowledge_chunks: Optional[list[str]] = None,
) -> str:
    user_message = (message or "").strip()
    if not user_message:
        return "Please share your question, and I will help with budgeting and savings guidance."

    if not GROQ_API_KEY or client is None:
        return "AI assistant is temporarily unavailable. Try tracking this month's top expenses and setting a category budget."

    ctx = (context or "").strip()
    user_name = _extract_user_name(data, memory)
    snapshot = _build_finance_snapshot(data)
    intent = _infer_intent(user_message)

    # Deterministic answers for core metrics: do not involve the LLM.
    if intent == "health":
        h = (data or {}).get("health") if isinstance(data, dict) else None
        if isinstance(h, dict):
            score = _safe_float(h.get("score") or h.get("health_score"), default=0.0)
            month = (data or {}).get("month") if isinstance(data, dict) else None
            reasons = h.get("reasons") if isinstance(h.get("reasons"), list) else []
            lines = []
            label = f" for {month}" if isinstance(month, str) and month.strip() else ""
            lines.append(f"{user_name}, your financial health score{label} is {score:.0f}.")
            if reasons:
                for r in [x for x in reasons if isinstance(x, str) and x.strip()][:2]:
                    lines.append(f"- {r.strip()}")
            return "\n".join(lines).strip()

    if _is_plan_request(user_message):
        has_any = snapshot["total_expense"] > 0 or bool(snapshot["category_breakdown"]) or bool(snapshot["budget_data"])
        if not has_any:
            return _empty_data_plan()

    payload = _safe_json(
        {
            "requested_payload": data or {},
            "finance_snapshot": snapshot,
        }
    )
    mem = _safe_json(memory or {})

    rag_ctx = (rag_context or "").strip()
    knowledge = [c for c in (knowledge_chunks or []) if isinstance(c, str) and c.strip()]

    for model_name in list(dict.fromkeys([m for m in MODEL_CANDIDATES if m])):
        try:
            if rag_ctx:
                system = (
                    "You are FinPulse AI, a personal finance assistant for Indian users. "
                    "You have access to the user's real financial data and knowledge of Indian finance rules. "
                    "You MUST be data-aware, specific, and actionable. "
                    "Never give generic advice. Never write long paragraphs. "
                    "Do NOT force a single fixed template for every answer. "
                    "Only include information relevant to the user's question.\n\n"
                    f"User's financial context (real data — treat as ground truth):\n{rag_ctx}"
                )
                if knowledge:
                    system += (
                        "\n\nRelevant Indian personal finance knowledge (use only if relevant to the question):\n"
                        + "\n".join(f"- {c}" for c in knowledge)
                    )
                system += (
                    "\n\nInstructions: Always reference the user's actual numbers above when relevant to the "
                    "question. Format currency using ₹ with Indian comma-style grouping (e.g. ₹1,00,000). Keep "
                    "advice specific to the Indian financial context. End your reply with exactly one clear, "
                    "actionable suggestion."
                )
            else:
                system = (
                    "You are a fintech assistant for a personal finance app. "
                    "You MUST be data-aware, specific, and actionable. "
                    "Never give generic advice. Always reference the user's real numbers and categories. "
                    "Never write long paragraphs. "
                    "Do NOT force a single fixed template for every answer. "
                    "Only include information relevant to the user's question."
                )
            response = client.chat.completions.create(
                model=model_name,
                temperature=0.35,
                messages=[
                    {
                        "role": "system",
                        "content": system,
                    },
                    {
                        "role": "user",
                        "content": (
                            f"User message: {user_message}\n\n"
                            f"Context (use ONLY this): {ctx or 'N/A'}\n\n"
                            f"Data (use ONLY this JSON): {payload}\n\n"
                            f"UserMemory (use as personalization hints, keep it subtle): {mem}\n\n"
                            f"Detected intent: {intent}\n\n"
                            "HARD RULES:\n"
                            "- NO long paragraphs.\n"
                            "- Prefer short paragraphs and/or '-' bullet points.\n"
                            "- MUST use real ₹ values and real categories that exist in the JSON.\n"
                            f"- Use the user's name naturally when it helps (user name: {user_name}).\n"
                            "- DO NOT repeat the same headings every time.\n"
                            "- DO NOT include sections that the question did not ask for.\n"
                            "\n"
                            "WHAT TO ANSWER (intent rules):\n"
                            "- If intent is 'budget': ONLY talk about budgets and budget vs actual. Include total budget (₹), per-category budgets (₹), spent vs budget for those categories, and overspend (₹) if any.\n"
                            "  - If budgets_present is false OR budget_data is empty: DO NOT compute or claim overspending. Say exactly: 'No budgets set for this month.'\n"
                            "  - If you offer a budget number, label it clearly as a suggestion (e.g., 'Suggestion: set Shopping budget around ₹4000'). Never present it as a real recorded value.\n"
                            "- If intent is 'expenses': ONLY talk about expenses: total spend (₹) and top categories with ₹ values.\n"
                            "- If intent is 'overview': give a complete but compact snapshot (income, expenses, savings, top categories, budgets vs actual, biggest risk/alert, and 2 next best actions).\n"
                            "- If intent is 'advice': give 3-5 actionable steps tied to the user's numbers (₹ targets), not generic tips.\n"
                            "- If intent is 'knowledge': the user is asking a general Indian personal-finance, tax, or investment question, not asking about their own transaction history. Answer it directly and specifically using the 'Relevant Indian personal finance knowledge' given in the system message. Bring in the user's own numbers only if it naturally strengthens the answer (e.g. their savings rate) — do not force a full snapshot, budget breakdown, or overview.\n"
                            "- If intent is 'unknown': answer the user's actual question directly and conversationally using whatever context is relevant. Do not default to a generic overview unless the question is genuinely broad.\n"
                            "\n"
                            "OUTPUT STYLE:\n"
                            "- Be conversational and clear.\n"
                            "- Keep spacing between blocks.\n"
                            "- Use INR symbol '₹' (not 'Rs').\n"
                        ),
                    },
                ],
            )
            content = (response.choices[0].message.content or "").strip()
            if content:
                content = _clean_ai_response(_normalize_paragraphs(content))

                # Only enforce a structured fallback when the user explicitly asked for a plan.
                if _is_plan_request(user_message) and not _looks_structured_plan(content):
                    breakdown = snapshot.get("category_breakdown") or {}
                    budget_data = snapshot.get("budget_data") or {}
                    top = snapshot.get("top_categories") or []
                    total = snapshot.get("total_expense") or 0

                    top_issues: list[str] = []
                    if not budget_data:
                        top_issues.append("* No budget set")
                    if snapshot.get("overspend_by_category"):
                        for cat, over in list(snapshot["overspend_by_category"].items())[:2]:
                            top_issues.append(f"* {_title_cat(cat)} overspent by ₹{float(over):.0f}")
                    if not top_issues and top:
                        top_issues.append(f"* {_title_cat(top[0])} is highest (₹{_safe_float(breakdown.get(top[0])):.0f})")

                    spend_lines = []
                    for cat in top[:5]:
                        spend_lines.append(f"- {_title_cat(cat)}: ₹{_safe_float(breakdown.get(cat)):.0f}")

                    action_lines: list[str] = []
                    if top:
                        t0 = top[0]
                        suggested_budget = max(
                            2000.0,
                            _safe_float(budget_data.get(t0), 0.0) or _safe_float(breakdown.get(t0), 0.0) * 1.1,
                        )
                        action_lines.append(f"- Suggestion: set {_title_cat(t0)} budget around ₹{suggested_budget:.0f}")
                    action_lines.append("- Track expenses daily (5 mins/day)")
                    action_lines.append("- Reduce discretionary spend by ₹1000 this week")
                    if budget_data:
                        action_lines.append("- Review budgets weekly and adjust by ±10% if needed")

                    priority = "High" if snapshot.get("overspend_by_category") else "Medium"

                    return "\n".join(
                        [
                            "Summary:",
                            f"- {user_name}, you spent ₹{float(total):.0f} in the provided snapshot.",
                            "",
                            "Top Issues:",
                            *(top_issues[:4] or ["- No major issues detected in the snapshot"]),
                            "",
                            "Spending Breakdown:",
                            *(spend_lines or ["* No category breakdown available"]),
                            "",
                            "Action Plan:",
                            *action_lines[:5],
                            "",
                            "Priority:",
                            f"- {priority}",
                        ]
                    ).strip()

                if (ctx or data) and not _has_number(content):
                    return _normalize_paragraphs(
                        f"{content}\n\nTop Issues:\n* Missing numeric references — total is ₹{snapshot.get('total_expense', 0):.0f}."
                    )

                return content
        except Exception:
            continue

    return "I could not generate a reply right now. Start by reviewing your highest-spend category and set a realistic monthly cap."


def parse_expense_from_text(text: str) -> dict:
    if not GROQ_API_KEY or client is None:
        raise ValueError("AI parsing unavailable: API key not configured")
    
    import json
    from datetime import datetime

    prompt = f"""
You are an expert at extracting financial data.
Extract the expense details from the following text and return ONLY a valid JSON object.
Use one of the categories: Food, Travel, Shopping, Bills, Other.
Date format: YYYY-MM-DD. If no date is mentioned in the text, use {datetime.utcnow().strftime('%Y-%m-%d')}.
Properties to extract:
- amount (number)
- category (string)
- date (string)
- description (short text string)

Text: "{text}"
"""
    last_error = None
    for model_name in list(dict.fromkeys([m for m in MODEL_CANDIDATES if m])):
        try:
            response = client.chat.completions.create(
                model=model_name,
                temperature=0.0,
                messages=[
                    {"role": "system", "content": "You output strict JSON without any markdown formatting wrappers. Do not wrap in ```json "},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
            content = response.choices[0].message.content or "{}"
            try:
                parsed = json.loads(content.strip())
            except json.JSONDecodeError:
                clean = content.strip().lstrip("```json").rstrip("```").strip()
                parsed = json.loads(clean)

            return {
                "amount": float(parsed.get("amount", 0)),
                "category": parsed.get("category", "Other"),
                "date": parsed.get("date", datetime.utcnow().strftime("%Y-%m-%d")),
                "description": parsed.get("description", "AI Parsed Expense")
            }
        except Exception as e:
            last_error = e
            continue

    logger.error(f"AI error: parse_expense_from_text failed for all models: {last_error}")
    raise ValueError("Could not understand that expense. Try a simpler format like '500 food lunch'.")