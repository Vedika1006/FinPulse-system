import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:8000",
});

API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

API.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const reqUrl = String(err.config?.url ?? "");

    if (status === 401) {
      const isAuthRoute =
        reqUrl.includes("/auth/login") || reqUrl.includes("/auth/register");
      if (!isAuthRoute) {
        localStorage.removeItem("token");
        const path = window.location.pathname;
        if (path !== "/login" && !path.endsWith("/login")) {
          window.location.replace("/login");
        }
      }
    }

    return Promise.reject(err);
  }
);

export default API;
