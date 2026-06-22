import API from "./axios";

export const getExpenses = async () => {
  const res = await API.get("/expenses/");
  return res.data;
};

export const addExpense = async (data) => {
  const res = await API.post("/expenses/", data);
  return res.data;
};

export const deleteExpense = async (id) => {
  await API.delete(`/expenses/${id}`);
};