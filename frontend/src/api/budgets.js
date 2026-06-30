import API from "./axios";

export async function getBudgets() {
  const res = await API.get("/budgets/");
  return res.data;
}

export async function createBudget(payload) {
  const res = await API.post("/budgets/", payload);
  return res.data;
}

export async function deleteBudget(id) {
  await API.delete(`/budgets/${id}`);
}

/** GET /budgets/vs-actual/{month}/ */
export async function getBudgetVsActual(month) {
  const res = await API.get(`/budgets/vs-actual/${month}/`);
  return res.data;
}

/** GET /budgets/suggestions */
export async function getBudgetSuggestions() {
  const res = await API.get("/budgets/suggestions");
  return res.data;
}

/** PATCH /budgets/{id}/rollover */
export async function updateBudgetRollover(id, rollover_enabled) {
  const res = await API.patch(`/budgets/${id}/rollover`, { rollover_enabled });
  return res.data;
}
