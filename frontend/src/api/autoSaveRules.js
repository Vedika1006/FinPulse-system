import API from "./axios";

export async function getAutoSaveRules() {
  const res = await API.get("/auto-save-rules/");
  return res.data;
}

export async function createAutoSaveRule(payload) {
  const res = await API.post("/auto-save-rules/", payload);
  return res.data;
}

export async function deleteAutoSaveRule(id) {
  await API.delete(`/auto-save-rules/${id}`);
}
