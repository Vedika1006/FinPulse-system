from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, ConfigDict, field_validator


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: Optional[str] = None
    email: EmailStr


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class ExpenseCreate(BaseModel):
    amount: float
    category: str
    description: Optional[str] = None
    note: Optional[str] = None
    date: Optional[datetime] = None

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("Amount must be greater than 0")
        return value

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str) -> str:
        cat = (value or "").strip()
        if not cat:
            raise ValueError("Category is required")
        return cat

    @field_validator("date")
    @classmethod
    def validate_date(cls, value: Optional[datetime]) -> Optional[datetime]:
        if value is None:
            return value
        # Strip tzinfo for comparison; treat submitted date as local/naive UTC
        naive = value.replace(tzinfo=None)
        # Allow dates up to and including today (compare date only, not time)
        today = datetime.utcnow().date()
        if naive.date() > today:
            raise ValueError("Expense date cannot be in the future")
        return value


class ExpenseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: float
    category: str
    description: Optional[str]
    note: Optional[str] = None
    date: Optional[datetime] = None
    created_at: datetime


class BudgetCreate(BaseModel):
    category: str
    amount: float
    month: str  # format: YYYY-MM

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("Budget amount must be greater than 0")
        return value

    @field_validator("month")
    @classmethod
    def validate_month(cls, value: str) -> str:
        try:
            datetime.strptime(value, "%Y-%m")
        except ValueError as e:
            raise ValueError("Month must be in YYYY-MM format") from e
        return value

    @field_validator("category")
    @classmethod
    def validate_budget_category(cls, value: str) -> str:
        cat = (value or "").strip()
        if not cat:
            raise ValueError("Category is required")
        return cat


class BudgetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category: str
    amount: float
    month: str


class BudgetUpdate(BaseModel):
    amount: float

    @field_validator("amount")
    @classmethod
    def validate_budget_update_amount(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("Budget amount must be greater than 0")
        return value


class IncomeCreate(BaseModel):
    month: str  # YYYY-MM
    amount: float

    @field_validator("month")
    @classmethod
    def validate_income_month(cls, value: str) -> str:
        try:
            datetime.strptime(value, "%Y-%m")
        except ValueError as e:
            raise ValueError("Month must be in YYYY-MM format") from e
        return value

    @field_validator("amount")
    @classmethod
    def validate_income_amount(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("Income amount must be greater than 0")
        return value


class IncomeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    month: str
    amount: float


class HealthScoreBreakdown(BaseModel):
    spending_control: float
    budget_adherence: float
    savings_rate: float


class HealthScoreResponse(BaseModel):
    month: str
    health_score: float
    score: float
    breakdown: HealthScoreBreakdown
    reasons: list[str] = []
    savings_rate: float
    savings_score: int
    budget_score: int
    stability_score: int
    insights: list[str] = []


class InsightResponse(BaseModel):
    month: str
    insights: list[str] = []


class AIChatRequest(BaseModel):
    message: str
    context: Optional[str] = None
    data: Optional[dict[str, Any]] = None

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        msg = value.strip()
        if not msg:
            raise ValueError("Message is required")
        return msg


class AIChatResponse(BaseModel):
    reply: str


class UserMemoryResponse(BaseModel):
    frequent_category: Optional[str] = None
    habit: Optional[str] = None
    meta: Optional[dict[str, Any]] = None
    updated_at: Optional[datetime] = None


class GoalCreate(BaseModel):
    name: str
    target_amount: float
    deadline: Optional[str] = None

    @field_validator("target_amount")
    @classmethod
    def validate_amount(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("Target amount must be greater than 0")
        return value


class GoalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    target_amount: float
    saved_amount: float = 0.0
    deadline: Optional[str] = None
    created_at: datetime


class GoalUpdate(BaseModel):
    saved_amount: float

class AIExpenseParseRequest(BaseModel):
    text: str

class AIExpenseParseResponse(BaseModel):
    amount: float
    category: str
    date: str
    description: str
