"""
FAISS-based expense categorization service.

On first call, builds a FAISS index from 200+ Indian merchant embeddings
(sentence-transformers all-MiniLM-L6-v2).  Subsequent calls hit the
in-memory index — microsecond latency.

Falls back to Groq LLM when FAISS confidence < 0.80.
"""

import json
import os
import threading

import numpy as np

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

    # ── Transport ─────────────────────────────────────────────────────
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
    ("IRCTC", "Transport"),
    ("Indian Railways", "Transport"),
    ("IndiGo", "Transport"),
    ("Air India", "Transport"),
    ("SpiceJet", "Transport"),
    ("Vistara", "Transport"),
    ("Akasa Air", "Transport"),
    ("GoFirst", "Transport"),
    ("GoAir", "Transport"),
    ("Air Asia", "Transport"),
    ("MakeMyTrip", "Transport"),
    ("Yatra", "Transport"),
    ("Cleartrip", "Transport"),
    ("redBus", "Transport"),
    ("Abhibus", "Transport"),
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

    # ── Healthcare ────────────────────────────────────────────────────
    ("Apollo Pharmacy", "Healthcare"),
    ("Apollo Hospitals", "Healthcare"),
    ("MedPlus", "Healthcare"),
    ("NetMeds", "Healthcare"),
    ("1mg", "Healthcare"),
    ("PharmEasy", "Healthcare"),
    ("Practo", "Healthcare"),
    ("Fortis", "Healthcare"),
    ("Max Healthcare", "Healthcare"),
    ("Manipal Hospitals", "Healthcare"),
    ("Columbia Asia", "Healthcare"),
    ("Narayana Health", "Healthcare"),
    ("Lybrate", "Healthcare"),
    ("Tata 1mg", "Healthcare"),
    ("Truemeds", "Healthcare"),
    ("Wellness Forever", "Healthcare"),
    ("Medikart", "Healthcare"),
    ("doctor", "Healthcare"),
    ("hospital", "Healthcare"),
    ("clinic", "Healthcare"),
    ("pharmacy", "Healthcare"),
    ("chemist", "Healthcare"),
    ("medicine", "Healthcare"),
    ("diagnostic", "Healthcare"),
    ("lab test", "Healthcare"),

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
_model = None
_index = None
_label_list: list[str] = []  # parallel to FAISS index rows


def _load():
    """Build the FAISS index once, lazily, thread-safe."""
    global _model, _index, _label_list

    if _model is not None:
        return  # already loaded

    with _lock:
        if _model is not None:
            return  # another thread beat us here

        from sentence_transformers import SentenceTransformer
        import faiss

        print("[FAISS] Loading sentence-transformer model…")
        _model = SentenceTransformer("all-MiniLM-L6-v2")

        merchants = [m for m, _ in MERCHANT_CATEGORIES]
        _label_list = [c for _, c in MERCHANT_CATEGORIES]

        print(f"[FAISS] Embedding {len(merchants)} merchants…")
        vecs = _model.encode(merchants, normalize_embeddings=True, show_progress_bar=False)
        vecs = np.array(vecs, dtype=np.float32)

        # IndexFlatIP = cosine similarity (for L2-normalised vectors)
        _index = faiss.IndexFlatIP(vecs.shape[1])
        _index.add(vecs)
        print("[FAISS] Index ready ✓")


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
        query_vec = np.array(
            _model.encode([query], normalize_embeddings=True),
            dtype=np.float32,
        )

        distances, indices = _index.search(query_vec, k=1)
        confidence = float(distances[0][0])   # cosine sim: 0 → 1
        category = _label_list[int(indices[0][0])]

        if confidence >= 0.80:
            return {
                "category": category,
                "confidence": round(confidence, 3),
                "method": "faiss",
            }

        # Low confidence — escalate to Groq
        return _groq_categorize(merchant, description, category, confidence)

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

Pick ONE category from this exact list:
Food, Transport, Shopping, Entertainment, Healthcare, Utilities, Groceries, Education, Other

Reply ONLY with JSON, no markdown:
{{"category": "<category>", "confidence": <0.0-1.0>}}"""

        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
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