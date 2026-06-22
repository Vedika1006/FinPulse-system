import API from "./axios";

export const getGoals = async () => {
  const { data } = await API.get("/goals/");
  return data;
};

export const createGoal = async (goal) => {
  const { data } = await API.post("/goals/", goal);
  return data;
};

export const updateGoal = async (goalId, data) => {
  const res = await API.put(`/goals/${goalId}`, data);
  return res.data;
};

export const deleteGoal = async (goalId) => {
  await API.delete(`/goals/${goalId}`);
};
