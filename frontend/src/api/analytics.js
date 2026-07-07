import API from "./axios";
import { currentMonthParam } from "../utils/month";

/** GET /analytics/health-score/?month=YYYY-MM */
export async function getHealthScore(month) {
  const res = await API.get("/analytics/health-score/", {
    params: month ? { month } : {},
  });
  return res.data;
}

export async function getMonthlyTrend() {
  const res = await API.get("/analytics/monthly-trend/");
  return res.data;
}

/** GET /analytics/category-comparison/?month=YYYY-MM — omit month for all-time totals */
export async function getCategoryComparison(month) {
  const res = await API.get("/analytics/category-comparison/", {
    params: month ? { month } : {},
  });
  return res.data;
}

/** GET /analytics/insight/?month=YYYY-MM */
export async function getInsight(month) {
  const res = await API.get("/analytics/insight/", {
    params: month ? { month } : {},
  });
  return res.data;
}

export { currentMonthParam };
