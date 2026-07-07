from sqlalchemy import Boolean, Column, Integer, String
from app.database import Base
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from sqlalchemy import DateTime
from sqlalchemy import UniqueConstraint
from sqlalchemy import JSON
from sqlalchemy import Numeric, Date


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)



class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float, nullable=False)
    category = Column(String, nullable=False)
    description = Column(String)
    note = Column(String, nullable=True)
    date = Column(DateTime, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)

    owner = relationship("User")

class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    # NOTE: physical column name avoids SQLite keyword conflicts ("limit")
    limit = Column("limit_amount", Float, nullable=True)
    month = Column(String, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    rollover_enabled = Column(Boolean, default=False, nullable=False, server_default="0")

    user = relationship("User")

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "category",
            "month",
            name="unique_user_category_month",
        ),
    )


class UserMemory(Base):
    """
    Light AI memory store per user (Phase 3).
    Stores simple, explainable behavioral patterns only.
    """

    __tablename__ = "user_memory"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    frequent_category = Column(String, nullable=True)
    habit = Column(String, nullable=True)  # e.g. "overspending", "steady", "improving savings"
    meta = Column(JSON, nullable=True)  # small structured signals, e.g. {"top_category_share_pct": 42.3}
    updated_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User")


class Income(Base):
    __tablename__ = "income"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    month = Column(String, nullable=False, index=True)  # YYYY-MM
    amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User")

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "month",
            name="unique_user_income_month",
        ),
    )

class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    target_amount = Column(Float, nullable=False)
    saved_amount = Column(Float, default=0.0)
    deadline = Column(String, nullable=True) # YYYY-MM
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User")


class AutoSaveRule(Base):
    __tablename__ = "auto_save_rules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=False, index=True)
    type = Column(String, nullable=False)   # "fixed" | "percent"
    value = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User")
    goal = relationship("Goal")


class Recurring(Base):
    __tablename__ = "recurring"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    description = Column(String, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    category = Column(String, nullable=False)
    frequency = Column(String, nullable=False)  # "weekly" | "monthly" | "quarterly" | "yearly"
    next_due_date = Column(Date, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False, server_default="1")
    is_paused = Column(Boolean, default=False, nullable=False, server_default="0")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User")


class Debt(Base):
    __tablename__ = "debts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    loan_type = Column(String, nullable=False)  # "home"|"car"|"personal"|"education"|"credit_card"|"consumer"|"other"
    principal = Column(Numeric(12, 2), nullable=False)
    interest_rate = Column(Numeric(5, 2), nullable=False)  # annual %, e.g. 8.50 (0 allowed for no-cost EMI)
    tenure_months = Column(Integer, nullable=False)
    emi_amount = Column(Numeric(12, 2), nullable=False)
    start_date = Column(Date, nullable=False)
    extra_payments = Column(Numeric(12, 2), default=0, nullable=False, server_default="0")
    is_active = Column(Boolean, default=True, nullable=False, server_default="1")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User")


class TaxInvestment(Base):
    __tablename__ = "tax_investments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    instrument_type = Column(String, nullable=False)
    name = Column(String, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    frequency = Column(String, nullable=False)  # "one_time"|"monthly"|"quarterly"|"yearly"
    date = Column(Date, nullable=False)
    financial_year = Column(String, nullable=False, index=True)  # "2026-27", auto-derived from date
    is_recurring = Column(Boolean, default=False, nullable=False, server_default="0")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User")
