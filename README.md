# FinPulse

![Tests](https://github.com/Vedika1006/FinPulse-system/actions/workflows/test.yml/badge.svg)

AI-powered personal finance app for Indian users — expense tracking, budgeting, forecasting, tax planning, and more.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)

**Live site:** [fin-pulse-system.vercel.app](https://fin-pulse-system.vercel.app)

## Features

- Expense tracking with automatic merchant categorization (FAISS + LLM fallback)
- Budgets with month-over-month rollover and budget-vs-actual reporting
- Bank statement CSV import (ICICI, HDFC, and generic formats) with duplicate detection
- Recurring subscriptions and recurring income auto-tracking
- EMI/loan tracker with full amortization schedules
- Section 80C/80CCD/80D tax tracker and old-vs-new regime comparison
- Financial health score, spending forecasts, and anomaly detection
- Savings goals with auto-save rules tied to income
- AI chat assistant grounded in the user's real financial data (RAG)

## Screenshots

Screenshots coming soon.

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

Create a `.env` file inside `backend/` with:

| Variable | Description |
| --- | --- |
| `GROQ_API_KEY` | API key for Groq LLM calls (AI chat, expense categorization fallback, insights) |
| `DATABASE_URL` | PostgreSQL connection string; omit to fall back to a local SQLite database |
| `JWT_SECRET` | Secret used to sign auth JWTs (referenced as `SECRET_KEY` in code) |

## Testing

```bash
cd backend
pytest tests/ -v
```

Tests run against an in-memory SQLite database and never touch production data.
