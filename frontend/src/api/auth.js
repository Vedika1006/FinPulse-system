import API from "./axios";

export const register = async (email, password) => {
  const res = await API.post("/auth/register", { email, password });
  return res.data;
};

export const login = async (email, password) => {
  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);
  const res = await API.post("/auth/login", body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return res.data;
};

export const forgotPassword = async (email) => {
  const res = await API.post("/auth/forgot-password", { email });
  return res.data;
};

export const resetPassword = async (token, new_password) => {
  const res = await API.post("/auth/reset-password", { token, new_password });
  return res.data;
};

export const changeUserPassword = async (current_password, new_password) => {
  const res = await API.put("/auth/password", { current_password, new_password });
  return res.data;
};
