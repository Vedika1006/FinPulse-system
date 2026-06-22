export function buildAlerts(healthData, totalIncome, totalSpent) {
  const alerts = [];

  // Low health score
  if (healthData && healthData.health_score !== undefined) {
    const score = Number(healthData.health_score);
    if (score < 40) {
      alerts.push({
        id: `health-danger-${healthData.month}`,
        message: "Your financial health score is critically low. Review your recent expenses.",
        severity: "danger",
        link: "/analytics",
      });
    } else if (score < 60) {
      alerts.push({
        id: `health-warn-${healthData.month}`,
        message: "Your financial health score is dropping. Try trimming extra spending.",
        severity: "warning",
        link: "/analytics",
      });
    }
  }

  // No income
  if (totalIncome !== undefined && totalIncome <= 0) {
    alerts.push({
      id: "no-income-warn",
      message: "No income logged for this month. Add income to track accurate savings.",
      severity: "warning",
      link: "/analytics",
    });
  }

  // Over budget
  if (totalSpent > 0 && totalIncome > 0) {
    if (totalSpent > totalIncome) {
      alerts.push({
        id: "over-budget-danger",
        message: "You have exceeded your total income for the month!",
        severity: "danger",
        link: "/budgets",
      });
    } else if (totalSpent > totalIncome * 0.9) {
      alerts.push({
        id: "near-budget-warn",
        message: "You are approaching your income limits for the month.",
        severity: "warning",
        link: "/budgets",
      });
    }
  }

  return alerts;
}
