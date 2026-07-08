"""
Merchant-name categorization service.

Matches merchant names against a pre-computed index of 273 Indian merchants
using substring matching and fuzzy string matching (difflib, threshold 0.80).
FAISS is used as a verification/scoring step after the name lookup, not for
free-text semantic search, because the sentence-transformer embedding model
is not available at runtime (deliberately excluded to keep Railway
deployment lightweight). Unknown merchants fall through to Groq LLM for
categorization.

The merchant embeddings themselves are pre-computed offline
(scripts/build_embeddings.py, using sentence-transformers all-MiniLM-L6-v2)
and saved as merchant_vectors.npy — at runtime only FAISS + numpy load,
no PyTorch / sentence-transformers.
"""



import json

import os

import threading

from pathlib import Path



import numpy as np

from dotenv import load_dotenv



load_dotenv(Path(__file__).resolve().parents[2] / ".env")

# Same "large chat model" knob as ai_service.py's GROQ_CHAT_MODEL — kept as
# its own env read here since services in this codebase don't share a config
# module, but the env var name matches so one setting updates both.
GROQ_FALLBACK_MODEL = os.getenv("GROQ_CHAT_MODEL", "llama-3.3-70b-versatile")



# ─── Merchant knowledge base (200+ Indian merchants) ─────────────────

MERCHANT_CATEGORIES: list[tuple[str, str]] = [

    # ── Food & Dining ─────────────────────────────────────────────────

    ("Swiggy", "Food"),

    ("Zomato", "Food"),

    ("McDonald's", "Food"),

    ("McDonalds", "Food"),

    ("KFC", "Food"),

    ("Domino's", "Food"),

    ("Dominos", "Food"),

    ("Pizza Hut", "Food"),

    ("Subway", "Food"),

    ("Burger King", "Food"),

    ("Taco Bell", "Food"),

    ("Starbucks", "Food"),

    ("Cafe Coffee Day", "Food"),

    ("CCD", "Food"),

    ("Barista", "Food"),

    ("Haldiram's", "Food"),

    ("Haldirams", "Food"),

    ("Barbeque Nation", "Food"),

    ("Social", "Food"),

    ("Papa John's", "Food"),

    ("Faasos", "Food"),

    ("Fasoos", "Food"),

    ("Box8", "Food"),

    ("EatFit", "Food"),

    ("Behrouz Biryani", "Food"),

    ("Oven Story", "Food"),

    ("The Good Bowl", "Food"),

    ("Freshmenu", "Food"),

    ("Rebel Foods", "Food"),

    ("Wow Momo", "Food"),

    ("Chaayos", "Food"),

    ("Theobroma", "Food"),

    ("Naturals Ice Cream", "Food"),

    ("Baskin Robbins", "Food"),

    ("Kwality Walls", "Food"),

    ("Amul", "Food"),

    ("Dunkin Donuts", "Food"),

    ("Dunkin", "Food"),

    ("Tim Hortons", "Food"),

    ("Wendy's", "Food"),

    ("Popeyes", "Food"),

    ("Panda Express", "Food"),

    ("Paradise Biryani", "Food"),

    ("Biryani By Kilo", "Food"),

    ("Moti Mahal", "Food"),

    ("Saravana Bhavan", "Food"),

    ("Hotel Saravana Bhavan", "Food"),

    ("Udupi", "Food"),

    ("Sagar Ratna", "Food"),

    ("restaurant", "Food"),

    ("dhaba", "Food"),

    ("canteen", "Food"),

    ("cafe", "Food"),

    ("bakery", "Food"),



    # ── Groceries ─────────────────────────────────────────────────────

    ("DMart", "Groceries"),

    ("D-Mart", "Groceries"),

    ("BigBasket", "Groceries"),

    ("Big Basket", "Groceries"),

    ("Blinkit", "Groceries"),

    ("Zepto", "Groceries"),

    ("Grofers", "Groceries"),

    ("JioMart", "Groceries"),

    ("Jio Mart", "Groceries"),

    ("Swiggy Instamart", "Groceries"),

    ("Instamart", "Groceries"),

    ("Nature's Basket", "Groceries"),

    ("Spencer's", "Groceries"),

    ("Spencers", "Groceries"),

    ("More Supermarket", "Groceries"),

    ("Reliance Smart", "Groceries"),

    ("Smart Bazaar", "Groceries"),

    ("Star Bazaar", "Groceries"),

    ("Nilgiris", "Groceries"),

    ("Spar", "Groceries"),

    ("Lulu Hypermarket", "Groceries"),

    ("Metro Cash and Carry", "Groceries"),

    ("WinMart", "Groceries"),

    ("Ratnadeep", "Groceries"),

    ("More Retail", "Groceries"),

    ("supermarket", "Groceries"),

    ("grocery", "Groceries"),

    ("kirana", "Groceries"),

    ("vegetable shop", "Groceries"),

    ("fruits and vegetables", "Groceries"),



    # ── Transport (daily/local commuting) ───────────────────────────────

    ("Ola", "Transport"),

    ("Ola Cabs", "Transport"),

    ("Uber", "Transport"),

    ("Rapido", "Transport"),

    ("Namma Yatri", "Transport"),

    ("InDrive", "Transport"),

    ("BluSmart", "Transport"),

    ("Meru Cabs", "Transport"),

    ("FastTag", "Transport"),

    ("NHAI", "Transport"),

    ("Bounce", "Transport"),

    ("Yulu", "Transport"),

    ("Ola Electric", "Transport"),

    ("parking", "Transport"),

    ("petrol", "Transport"),

    ("diesel", "Transport"),

    ("fuel", "Transport"),

    ("HP Petrol", "Transport"),

    ("Indian Oil", "Transport"),

    ("BPCL", "Transport"),

    ("auto rickshaw", "Transport"),

    ("metro card", "Transport"),

    ("bus pass", "Transport"),

    ("BMTC", "Transport"),

    ("DTC", "Transport"),

    ("BEST bus", "Transport"),


    # ── Travel (flights, trains, intercity/holiday — distinct from daily commuting) ──

    ("IRCTC", "Travel"),

    ("Indian Railways", "Travel"),

    ("IndiGo", "Travel"),

    ("Air India", "Travel"),

    ("SpiceJet", "Travel"),

    ("Vistara", "Travel"),

    ("Akasa Air", "Travel"),

    ("GoFirst", "Travel"),

    ("GoAir", "Travel"),

    ("Air Asia", "Travel"),

    ("MakeMyTrip", "Travel"),

    ("Yatra", "Travel"),

    ("Cleartrip", "Travel"),

    ("redBus", "Travel"),

    ("Abhibus", "Travel"),



    # ── Shopping ──────────────────────────────────────────────────────

    ("Amazon", "Shopping"),

    ("Amazon India", "Shopping"),

    ("Flipkart", "Shopping"),

    ("Myntra", "Shopping"),

    ("Ajio", "Shopping"),

    ("Meesho", "Shopping"),

    ("Nykaa", "Shopping"),

    ("Nykaa Fashion", "Shopping"),

    ("Snapdeal", "Shopping"),

    ("Tata Cliq", "Shopping"),

    ("Reliance Digital", "Shopping"),

    ("Croma", "Shopping"),

    ("Vijay Sales", "Shopping"),

    ("Decathlon", "Shopping"),

    ("H&M", "Shopping"),

    ("Zara", "Shopping"),

    ("Marks & Spencer", "Shopping"),

    ("Lifestyle", "Shopping"),

    ("Shoppers Stop", "Shopping"),

    ("Westside", "Shopping"),

    ("Max Fashion", "Shopping"),

    ("V-Mart", "Shopping"),

    ("Pantaloons", "Shopping"),

    ("FBB", "Shopping"),

    ("Big Bazaar", "Shopping"),

    ("Lenskart", "Shopping"),

    ("Pepperfry", "Shopping"),

    ("Urban Ladder", "Shopping"),

    ("Ikea", "Shopping"),

    ("IKEA", "Shopping"),

    ("FirstCry", "Shopping"),

    ("HRX", "Shopping"),

    ("Bewakoof", "Shopping"),

    ("The Souled Store", "Shopping"),



    # ── Entertainment ─────────────────────────────────────────────────

    ("Netflix", "Entertainment"),

    ("Hotstar", "Entertainment"),

    ("Disney+ Hotstar", "Entertainment"),

    ("Amazon Prime", "Entertainment"),

    ("Prime Video", "Entertainment"),

    ("Zee5", "Entertainment"),

    ("SonyLIV", "Entertainment"),

    ("MX Player", "Entertainment"),

    ("ALTBalaji", "Entertainment"),

    ("Voot", "Entertainment"),

    ("JioCinema", "Entertainment"),

    ("Eros Now", "Entertainment"),

    ("BookMyShow", "Entertainment"),

    ("PVR", "Entertainment"),

    ("PVR Cinemas", "Entertainment"),

    ("INOX", "Entertainment"),

    ("Carnival Cinemas", "Entertainment"),

    ("Miraj Cinemas", "Entertainment"),

    ("Spotify", "Entertainment"),

    ("JioSaavn", "Entertainment"),

    ("Gaana", "Entertainment"),

    ("Wynk", "Entertainment"),

    ("Apple Music", "Entertainment"),

    ("YouTube Premium", "Entertainment"),

    ("Steam", "Entertainment"),

    ("PlayStation", "Entertainment"),

    ("Xbox", "Entertainment"),

    ("gaming", "Entertainment"),

    ("movie tickets", "Entertainment"),

    ("concert tickets", "Entertainment"),

    ("theme park", "Entertainment"),

    ("Imagica", "Entertainment"),

    ("Wonderla", "Entertainment"),



    # ── Health ────────────────────────────────────────────────────────

    ("Apollo Pharmacy", "Health"),

    ("Apollo Hospitals", "Health"),

    ("MedPlus", "Health"),

    ("NetMeds", "Health"),

    ("1mg", "Health"),

    ("PharmEasy", "Health"),

    ("Practo", "Health"),

    ("Fortis", "Health"),

    ("Max Healthcare", "Health"),

    ("Manipal Hospitals", "Health"),

    ("Columbia Asia", "Health"),

    ("Narayana Health", "Health"),

    ("Lybrate", "Health"),

    ("Tata 1mg", "Health"),

    ("Truemeds", "Health"),

    ("Wellness Forever", "Health"),

    ("Medikart", "Health"),

    ("doctor", "Health"),

    ("hospital", "Health"),

    ("clinic", "Health"),

    ("pharmacy", "Health"),

    ("chemist", "Health"),

    ("medicine", "Health"),

    ("diagnostic", "Health"),

    ("lab test", "Health"),



    # ── Utilities ─────────────────────────────────────────────────────

    ("Jio", "Utilities"),

    ("Reliance Jio", "Utilities"),

    ("Airtel", "Utilities"),

    ("Bharti Airtel", "Utilities"),

    ("Vi", "Utilities"),

    ("Vodafone Idea", "Utilities"),

    ("BSNL", "Utilities"),

    ("ACT Fibernet", "Utilities"),

    ("Excitel", "Utilities"),

    ("YOU Broadband", "Utilities"),

    ("DEN Networks", "Utilities"),

    ("Hathway", "Utilities"),

    ("Tata Sky", "Utilities"),

    ("Dish TV", "Utilities"),

    ("Sun Direct", "Utilities"),

    ("Tata Power", "Utilities"),

    ("BSES", "Utilities"),

    ("MSEDCL", "Utilities"),

    ("BESCOM", "Utilities"),

    ("TNEB", "Utilities"),

    ("CESC", "Utilities"),

    ("Mahanagar Gas", "Utilities"),

    ("Gujarat Gas", "Utilities"),

    ("Indraprastha Gas", "Utilities"),

    ("Adani Gas", "Utilities"),

    ("IGL", "Utilities"),

    ("electricity bill", "Utilities"),

    ("water bill", "Utilities"),

    ("gas bill", "Utilities"),

    ("mobile recharge", "Utilities"),

    ("broadband", "Utilities"),

    ("DTH recharge", "Utilities"),



    # ── Education ─────────────────────────────────────────────────────

    ("BYJU's", "Education"),

    ("Byjus", "Education"),

    ("Unacademy", "Education"),

    ("Vedantu", "Education"),

    ("WhiteHat Jr", "Education"),

    ("Toppr", "Education"),

    ("Udemy", "Education"),

    ("Coursera", "Education"),

    ("upGrad", "Education"),

    ("Great Learning", "Education"),

    ("Simplilearn", "Education"),

    ("Duolingo", "Education"),

    ("Physics Wallah", "Education"),

    ("PW", "Education"),

    ("Allen", "Education"),

    ("FIITJEE", "Education"),

    ("Aakash", "Education"),

    ("school fees", "Education"),

    ("college fees", "Education"),

    ("tuition", "Education"),

    ("coaching", "Education"),

    ("books", "Education"),

    ("stationery", "Education"),

    ("exam fee", "Education"),

]



# ─── Singleton state ─────────────────────────────────────────────────
_lock = threading.Lock()
_index = None
_label_list: list[str] = []
_merchant_names: list[str] = []
_vectors: np.ndarray | None = None
_load_attempted = False
_load_failed = False

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_VECTORS_PATH = _DATA_DIR / "merchant_vectors.npy"
_LABELS_PATH = _DATA_DIR / "merchant_labels.json"
_NAMES_PATH = _DATA_DIR / "merchant_names.json"


def _load():
    """Load the pre-computed merchant index from disk — no PyTorch at runtime."""
    global _index, _label_list, _merchant_names, _vectors, _load_attempted, _load_failed

    if _index is not None:
        return

    if _load_attempted and _load_failed:
        # Already failed once this run — don't hit the disk again on every
        # call. A server restart is needed to retry (e.g. after fixing the
        # artifact files).
        raise FileNotFoundError(f"FAISS artifacts previously failed to load from {_DATA_DIR}; skipping retry until restart.")

    with _lock:
        if _index is not None:
            return
        if _load_attempted and _load_failed:
            raise FileNotFoundError(f"FAISS artifacts previously failed to load from {_DATA_DIR}; skipping retry until restart.")

        _load_attempted = True
        try:
            import faiss

            if not _VECTORS_PATH.exists() or not _LABELS_PATH.exists():
                raise FileNotFoundError(
                    f"Missing embedding artifacts in {_DATA_DIR}. "
                    "Run: python scripts/build_embeddings.py"
                )

            _vectors = np.load(str(_VECTORS_PATH))
            with _LABELS_PATH.open(encoding="utf-8") as f:
                _label_list = json.load(f)
            if _NAMES_PATH.exists():
                with _NAMES_PATH.open(encoding="utf-8") as f:
                    _merchant_names = json.load(f)
            else:
                _merchant_names = [m for m, _ in MERCHANT_CATEGORIES]

            _index = faiss.IndexFlatIP(_vectors.shape[1])
            _index.add(_vectors)

            print(f"[FAISS] Loaded {len(_label_list)} merchant vectors from disk OK")
        except Exception:
            _load_failed = True
            raise


def _faiss_search(query_vec: np.ndarray) -> tuple[str, float]:
    """Run FAISS cosine search on a normalized query vector."""
    distances, indices = _index.search(query_vec.astype(np.float32), k=1)
    confidence = float(distances[0][0])
    category = _label_list[int(indices[0][0])]
    return category, confidence


def _merchant_row_vector(name: str) -> np.ndarray | None:
    """Return the pre-computed embedding row for an exact merchant name."""
    try:
        idx = _merchant_names.index(name)
    except ValueError:
        return None
    return _vectors[idx : idx + 1]


def _resolve_query_vector(query: str) -> np.ndarray | None:
    """
    Map free-text to a pre-computed merchant embedding when the query
    references a known merchant name, then FAISS scores it.
    """
    import re
    from difflib import SequenceMatcher

    q = query.lower().strip()

    # 1) Word-boundary match — "Swiggy dinner" contains "swiggy" as a whole
    # word. Word boundaries matter: a naive substring check would match the
    # short merchant name "Vi" inside unrelated words like "via" or
    # "vitamin", silently mis-routing something like "NoBroker rent payment
    # via nobroker" to Vi/Vodafone's category instead of falling through to
    # Groq.
    best_name = None
    best_len = 0
    for name in _merchant_names:
        n = name.lower()
        if re.search(r"\b" + re.escape(n) + r"\b", q) and len(n) > best_len:
            best_name = name
            best_len = len(n)
    if best_name:
        return _merchant_row_vector(best_name)

    # 2) Fuzzy whole-query match — handles typos / slight variations
    best_name = None
    best_score = 0.0
    for name in _merchant_names:
        score = SequenceMatcher(None, q, name.lower()).ratio()
        if score > best_score:
            best_name = name
            best_score = score
    if best_name and best_score >= 0.80:
        return _merchant_row_vector(best_name)

    return None


# ─── Public API ──────────────────────────────────────────────────────

def categorize_merchant(merchant: str, description: str = "") -> dict:
    """
    Returns: { category, confidence, method }

    method is one of: "faiss" | "groq" | "fallback"
    confidence is 0.0 – 1.0
    """
    if not merchant and not description:
        return {"category": "Other", "confidence": 0.0, "method": "fallback"}

    try:
        _load()
        query = f"{merchant} {description}".strip()

        query_vec = _resolve_query_vector(query)
        if query_vec is not None:
            category, confidence = _faiss_search(query_vec)
            if confidence >= 0.80:
                return {
                    "category": category,
                    "confidence": round(confidence, 3),
                    "method": "faiss",
                }
            return _groq_categorize(merchant, description, category, confidence)

        return _groq_categorize(merchant, description)

    except Exception as exc:
        print(f"[FAISS] Error: {exc}")
        return _groq_categorize(merchant, description)





# ─── Groq fallback ───────────────────────────────────────────────────



def _groq_categorize(

    merchant: str,

    description: str = "",

    faiss_hint: str | None = None,

    faiss_conf: float | None = None,

) -> dict:

    """Ask Groq when FAISS isn't confident enough."""

    try:

        from groq import Groq



        client = Groq(api_key=os.getenv("GROQ_API_KEY"))



        hint_line = ""

        if faiss_hint and faiss_conf is not None:

            hint_line = f'\nFAISS weakly suggested "{faiss_hint}" ({faiss_conf:.0%} confidence) — use your judgement.'



        prompt = f"""You are categorizing an Indian user's expense.

Merchant: "{merchant}"

Description: "{description}"{hint_line}

Pick ONE category from this exact list — use the examples to disambiguate close calls:

- Rent: monthly rent, PG accommodation, hostel fees, landlord/NoBroker payments
- Groceries: DMart, BigBasket, Zepto, Blinkit, JioMart, supermarkets, vegetables, fruits, household supplies
- Food: Swiggy, Zomato, restaurants, cafes, bakeries, street food, dining out (NOT grocery shopping)
- Utilities: electricity, water, gas cylinder (Indane/HP/Bharat Gas), WiFi/broadband, mobile recharge/postpaid
- Transport: Ola, Uber, Rapido, auto, metro, bus pass, petrol/fuel, parking, toll (local/daily commuting)
- Travel: flights, trains (IRCTC), hotels, MakeMyTrip/Yatra, holiday/vacation expenses (NOT daily commuting)
- Shopping: Myntra, Flipkart, Amazon, Ajio, clothing, electronics, household items, gifts
- Entertainment: Netflix, Spotify, YouTube Premium, Hotstar, Prime Video, movies (PVR/INOX), books for leisure, games, concerts
- Health: pharmacy (Apollo/MedPlus/1mg/Netmeds/PharmEasy), gym/fitness (Cult Fit, Gold's Gym), doctor visits, lab tests, health insurance
- Education: courses (Udemy/Coursera), academic books, coaching, tuition/school/college fees, exam fees
- Investment: SIP, mutual funds, stocks, PPF, FD, NPS, gold purchases
- EMI: loan EMI payments (home/car/personal/education loan installments)
- Personal: salon, spa, laundry, dry cleaning, personal care
- Bills: ONLY things that don't fit above — credit card bill payments, non-health insurance premiums, government fees, fines, misc recurring payments
- Other: genuinely unclassifiable

Reply ONLY with JSON, no markdown:

{{"category": "<category>", "confidence": <0.0-1.0>}}"""



        resp = client.chat.completions.create(

            model=GROQ_FALLBACK_MODEL,

            messages=[{"role": "user", "content": prompt}],

            max_tokens=60,

        )



        text = resp.choices[0].message.content.strip()

        text = text.replace("```json", "").replace("```", "").strip()

        result = json.loads(text)

        result["method"] = "groq"

        return result



    except Exception as exc:

        print(f"[Groq categorize] Error: {exc}")

        return {"category": "Other", "confidence": 0.0, "method": "fallback"}


