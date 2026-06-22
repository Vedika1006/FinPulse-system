import API from "./axios";

export {
  getHealthScore,
  getMonthlyTrend,
  getCategoryComparison as getCategoryData,
  currentMonthParam,
} from "./analytics";

export const getRecentExpenses = async () => {
  const res = await API.get("/expenses/recent");
  return res.data;
};
