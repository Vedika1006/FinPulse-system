#!/usr/bin/env python3
"""
Run locally once (requires torch + sentence-transformers):

  cd backend
  pip install -r requirements-build.txt
  python scripts/build_embeddings.py

Commits:
  app/data/merchant_vectors.npy
  app/data/merchant_labels.json
  app/data/merchant_names.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.categorization_service import MERCHANT_CATEGORIES  # noqa: E402

DATA_DIR = BACKEND_ROOT / "app" / "data"
VECTORS_PATH = DATA_DIR / "merchant_vectors.npy"
LABELS_PATH = DATA_DIR / "merchant_labels.json"
NAMES_PATH = DATA_DIR / "merchant_names.json"


def main() -> None:
    from sentence_transformers import SentenceTransformer

    merchants = [m for m, _ in MERCHANT_CATEGORIES]
    labels = [c for _, c in MERCHANT_CATEGORIES]

    print(f"Embedding {len(merchants)} merchants with all-MiniLM-L6-v2...")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    vecs = model.encode(merchants, normalize_embeddings=True, show_progress_bar=True)
    vecs = np.array(vecs, dtype=np.float32)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    np.save(VECTORS_PATH, vecs)
    LABELS_PATH.write_text(json.dumps(labels), encoding="utf-8")
    NAMES_PATH.write_text(json.dumps(merchants), encoding="utf-8")

    print(f"Wrote {VECTORS_PATH} shape={vecs.shape}")
    print(f"Wrote {LABELS_PATH} ({len(labels)} labels)")
    print(f"Wrote {NAMES_PATH} ({len(merchants)} names)")
    print("Done. Commit all three files under app/data/.")


if __name__ == "__main__":
    main()
