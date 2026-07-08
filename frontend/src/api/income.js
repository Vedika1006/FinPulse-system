import API from "./axios";

export async function listIncome() {
  const res = await API.get("/income/");
  return res.data;
}

/** Upserts income for the given month — creates or updates the one record for that month. */
export async function saveIncome(payload) {
  const res = await API.post("/income/", payload);
  return res.data;
}

export async function deleteIncome(id) {
  await API.delete(`/income/${id}`);
}
