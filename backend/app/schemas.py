from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, ConfigDict, field_validator, model_validator

RECURRING_FREQUENCIES = {"weekly", "monthly", "quarterly", "yearly"}


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
    rollover_enabled: bool = False


class BudgetRolloverUpdate(BaseModel):
    rollover_enabled: bool


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


class AutoSaveApplied(BaseModel):
    goal_name: str
    amount: float


class IncomeWithAutoSavesResponse(BaseModel):
    id: int
    month: str
    amount: float
    auto_saves: list[AutoSaveApplied] = []


class AutoSaveRuleCreate(BaseModel):
    goal_id: int
    type: str   # "fixed" | "percent"
    value: float

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ("fixed", "percent"):
            raise ValueError("type must be 'fixed' or 'percent'")
        return v

    @field_validator("value")
    @classmethod
    def validate_value(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("value must be greater than 0")
        return v


class AutoSaveRuleResponse(BaseModel):
    id: int
    goal_id: int
    goal_name: str
    type: str
    value: float


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

    @field_validator("saved_amount")
    @classmethod
    def validate_saved_amount(cls, value: float) -> float:
        if value is not None and value < 0:
            raise ValueError("Saved amount cannot be negative")
        return value

class AIExpenseParseRequest(BaseModel):
    text: str

class AIExpenseParseResponse(BaseModel):
    amount: float
    category: str
    date: str
    description: str


# ── CSV Import schemas ────────────────────────────────────────────────────────

class ImportTransactionPreview(BaseModel):
    date: str
    description: str
    amount: float
    type: str
    suggested_category: str = "Other"
    category_confidence: float = 0.0
    is_duplicate: bool = False
    duplicate_confidence: float = 0.0


class ImportIncomeEntry(BaseModel):
    date: str
    description: str
    amount: float
    type: str


class ImportPreviewResponse(BaseModel):
    total_found: int
    duplicate_count: int
    transactions: list[ImportTransactionPreview]
    income_entries: list[ImportIncomeEntry]


class ImportConfirmRequest(BaseModel):
    transactions: list[dict]
    income_entries: list[dict] = []
    skip_duplicates: bool = True


class ImportConfirmResponse(BaseModel):
    imported_count: int
    skipped_count: int
    income_imported: int = 0
    income_merged: int = 0


class BudgetSuggestionResponse(BaseModel):
    category: str
    avg_monthly_spend: float
    suggested_budget: float
    months_analyzed: int
    existing_budget: Optional[float] = None


# ── Recurring (subscriptions) schemas ─────────────────────────────────────────

class RecurringCreate(BaseModel):
    description: str
    amount: float
    category: str
    frequency: str
    next_due_date: date

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str) -> str:
        v = (value or "").strip()
        if not v:
            raise ValueError("Description is required")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str) -> str:
        v = (value or "").strip()
        if not v:
            raise ValueError("Category is required")
        return v

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("Amount must be greater than 0")
        return value

    @field_validator("frequency")
    @classmethod
    def validate_frequency(cls, value: str) -> str:
        v = (value or "").strip().lower()
        if v not in RECURRING_FREQUENCIES:
            raise ValueError(f"Frequency must be one of: {', '.join(sorted(RECURRING_FREQUENCIES))}")
        return v


class RecurringUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    frequency: Optional[str] = None
    next_due_date: Optional[date] = None
    is_active: Optional[bool] = None

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        v = value.strip()
        if not v:
            raise ValueError("Description cannot be empty")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        v = value.strip()
        if not v:
            raise ValueError("Category cannot be empty")
        return v

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and value <= 0:
            raise ValueError("Amount must be greater than 0")
        return value

    @field_validator("frequency")
    @classmethod
    def validate_frequency(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        v = value.strip().lower()
        if v not in RECURRING_FREQUENCIES:
            raise ValueError(f"Frequency must be one of: {', '.join(sorted(RECURRING_FREQUENCIES))}")
        return v


class RecurringResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    description: str
    amount: float
    category: str
    frequency: str
    next_due_date: date
    is_active: bool
    created_at: datetime


# ── EMI / Debt tracker schemas ────────────────────────────────────────────────

DEBT_LOAN_TYPES = {"home", "car", "personal", "education", "credit_card", "consumer", "other"}


class DebtCreate(BaseModel):
    name: str
    loan_type: str
    principal: float
    interest_rate: float
    tenure_months: int
    emi_amount: Optional[float] = None
    start_date: date

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        v = (value or "").strip()
        if not v:
            raise ValueError("Name is required")
        return v

    @field_validator("loan_type")
    @classmethod
    def validate_loan_type(cls, value: str) -> str:
        v = (value or "").strip().lower()
        if v not in DEBT_LOAN_TYPES:
            raise ValueError(f"Loan type must be one of: {', '.join(sorted(DEBT_LOAN_TYPES))}")
        return v

    @field_validator("principal")
    @classmethod
    def validate_principal(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("Principal must be greater than 0")
        return value

    @field_validator("interest_rate")
    @classmethod
    def validate_interest_rate(cls, value: float) -> float:
        if value < 0:
            raise ValueError("Interest rate cannot be negative")
        return value

    @field_validator("tenure_months")
    @classmethod
    def validate_tenure_months(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("Tenure must be greater than 0 months")
        return value

    @field_validator("emi_amount")
    @classmethod
    def validate_emi_amount(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and value <= 0:
            raise ValueError("EMI amount must be greater than 0")
        return value

    @model_validator(mode="after")
    def validate_emi_covers_interest(self):
        if self.emi_amount is not None and self.interest_rate > 0:
            monthly_interest = self.principal * (self.interest_rate / 12 / 100)
            if self.emi_amount <= monthly_interest:
                raise ValueError(
                    f"EMI amount (₹{self.emi_amount:.2f}) must be greater than the monthly interest "
                    f"(₹{monthly_interest:.2f}) or the loan will never be paid off — leave EMI blank to "
                    "auto-calculate, or enter a larger amount."
                )
        return self


class DebtUpdate(BaseModel):
    name: Optional[str] = None
    emi_amount: Optional[float] = None
    is_active: Optional[bool] = None
    add_extra_payment: Optional[float] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        v = value.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        return v

    @field_validator("emi_amount")
    @classmethod
    def validate_emi_amount(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and value <= 0:
            raise ValueError("EMI amount must be greater than 0")
        return value

    @field_validator("add_extra_payment")
    @classmethod
    def validate_extra_payment(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and value <= 0:
            raise ValueError("Extra payment must be greater than 0")
        return value


class DebtResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    loan_type: str
    principal: float
    interest_rate: float
    tenure_months: int
    emi_amount: float
    start_date: date
    extra_payments: float
    is_active: bool
    created_at: datetime


class DebtListItemResponse(DebtResponse):
    current_outstanding_balance: float
    interest_remaining: float
    elapsed_months: int
    revised_tenure_months: int
    next_due_date: Optional[str] = None


class AmortizationMonth(BaseModel):
    month: int
    date: str
    emi: float
    principal_component: float
    interest_component: float
    outstanding_balance: float
    cumulative_interest: float
    paid: bool


class DebtDetailResponse(DebtListItemResponse):
    schedule: list[AmortizationMonth]
    interest_paid_so_far: float
    total_interest: float


class DebtSummaryResponse(BaseModel):
    total_monthly_emi: float
    total_outstanding: float
    total_interest_remaining: float
    active_loans: int
    debt_free_date: Optional[str] = None


# ── 80C Tax Tracker schemas ────────────────────────────────────────────────────

TAX_INSTRUMENT_TYPES = {
    "PPF", "ELSS", "NSC", "LIC", "EPF", "VPF", "FD_5yr", "SCSS", "SSY",
    "Home_Loan_Principal", "Tuition_Fees", "NPS_80CCD",
    "Health_Insurance_Self_80D", "Health_Insurance_Parents_80D",
}
TAX_FREQUENCIES = {"one_time", "monthly", "quarterly", "yearly"}


class TaxInvestmentCreate(BaseModel):
    instrument_type: str
    name: str
    amount: float
    frequency: str
    date: date

    @field_validator("instrument_type")
    @classmethod
    def validate_instrument_type(cls, value: str) -> str:
        if value not in TAX_INSTRUMENT_TYPES:
            raise ValueError(f"instrument_type must be one of: {', '.join(sorted(TAX_INSTRUMENT_TYPES))}")
        return value

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        v = (value or "").strip()
        if not v:
            raise ValueError("Name is required")
        return v

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("Amount must be greater than 0")
        return value

    @field_validator("frequency")
    @classmethod
    def validate_frequency(cls, value: str) -> str:
        v = (value or "").strip().lower()
        if v not in TAX_FREQUENCIES:
            raise ValueError(f"Frequency must be one of: {', '.join(sorted(TAX_FREQUENCIES))}")
        return v


class TaxInvestmentUpdate(BaseModel):
    instrument_type: Optional[str] = None
    name: Optional[str] = None
    amount: Optional[float] = None
    frequency: Optional[str] = None
    date: Optional[date] = None

    @field_validator("instrument_type")
    @classmethod
    def validate_instrument_type(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in TAX_INSTRUMENT_TYPES:
            raise ValueError(f"instrument_type must be one of: {', '.join(sorted(TAX_INSTRUMENT_TYPES))}")
        return value

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        v = value.strip()
        if not v:
            raise ValueError("Name cannot be empty")
        return v

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, value: Optional[float]) -> Optional[float]:
        if value is not None and value <= 0:
            raise ValueError("Amount must be greater than 0")
        return value

    @field_validator("frequency")
    @classmethod
    def validate_frequency(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        v = value.strip().lower()
        if v not in TAX_FREQUENCIES:
            raise ValueError(f"Frequency must be one of: {', '.join(sorted(TAX_FREQUENCIES))}")
        return v


class TaxInvestmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    instrument_type: str
    name: str
    amount: float
    frequency: str
    date: date
    financial_year: str
    is_recurring: bool
    created_at: datetime


class TaxInvestmentsGrouped(BaseModel):
    financial_year: str
    section_80c: list[TaxInvestmentResponse]
    section_80ccd: list[TaxInvestmentResponse]
    section_80d: list[TaxInvestmentResponse]


class Section80CBreakdown(BaseModel):
    total_invested: float
    eligible_amount: float
    remaining_limit: float
    percentage_utilized: float
    limit: float


class Section80CCDBreakdown(BaseModel):
    total_invested: float
    eligible_amount: float
    remaining_limit: float
    percentage_utilized: float
    limit: float


class Section80DBreakdown(BaseModel):
    self_invested: float
    self_eligible: float
    self_limit: float
    parents_invested: float
    parents_eligible: float
    parents_limit: float
    combined_eligible: float


class RegimeTaxResult(BaseModel):
    regime: str
    taxable_income: float
    gross_tax: float
    cess: float
    total_tax: float
    effective_tax_rate: float
    standard_deduction: float


class TaxSavedBreakdown(BaseModel):
    section_80c: float
    section_80ccd: float
    section_80d: float
    total: float


class TaxSummaryResponse(BaseModel):
    financial_year: str
    section_80c: Section80CBreakdown
    section_80ccd: Section80CCDBreakdown
    section_80d: Section80DBreakdown
    old_regime_tax: Optional[RegimeTaxResult] = None
    tax_saved: Optional[TaxSavedBreakdown] = None
    months_remaining_in_fy: int
    investment_needed_per_month_80c: float


class RegimeCompareResponse(BaseModel):
    old_regime: RegimeTaxResult
    new_regime: RegimeTaxResult
    difference: float
    better_regime: str
    recommendation: str
