"""
Tax slab calculation tests — call tax_service functions directly rather
than going through HTTP, per the task spec.
"""
import pytest

from app.services.tax_service import calculate_new_regime_tax, calculate_old_regime_tax


def test_old_regime_with_deductions():
    result = calculate_old_regime_tax(
        annual_income=1000000,
        deductions_80c=150000,
        deductions_80ccd=0,
        deductions_80d=0,
    )
    assert result["taxable_income"] == 800000

    # 0-2.5L: 0%, 2.5-5L: 5% (12500), 5-8L: 20% (60000) = 72500 gross + 4% cess
    expected_gross = 12500 + 60000
    expected_total = round(expected_gross * 1.04, 2)
    assert result["gross_tax"] == pytest.approx(expected_gross)
    assert result["total_tax"] == pytest.approx(expected_total)


def test_new_regime_no_deductions():
    # Standard deduction only (no 80C in new regime) -> taxable = 925000,
    # which is under the new regime's Section 87A rebate threshold (₹12L),
    # so tax is fully rebated to zero here.
    result = calculate_new_regime_tax(annual_income=1000000)
    assert result["taxable_income"] == 925000
    assert result["total_tax"] == 0

    # Above the ₹12L rebate threshold, slab tax + 4% cess applies normally.
    # 0-4L: 0%, 4-8L: 5% (20000), 8-12L: 10% (40000), 12-14.25L: 15% (33750) = 93750 gross
    above_rebate = calculate_new_regime_tax(annual_income=1500000)
    expected_gross = 20000 + 40000 + 33750
    expected_cess = round(expected_gross * 0.04, 2)
    assert above_rebate["gross_tax"] == pytest.approx(expected_gross)
    assert above_rebate["cess"] == pytest.approx(expected_cess)
    assert above_rebate["total_tax"] == pytest.approx(expected_gross + expected_cess)


def test_87a_rebate():
    result = calculate_old_regime_tax(annual_income=500000, deductions_80c=0, deductions_80ccd=0, deductions_80d=0)
    assert result["total_tax"] == 0
