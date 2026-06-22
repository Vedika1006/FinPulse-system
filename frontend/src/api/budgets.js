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
