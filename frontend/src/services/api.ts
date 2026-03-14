import axios from "axios";

const API_BASE_URL = "http://localhost:5000/api";
export const AUTH_STORAGE_KEY = "amar_ration_auth";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);

  if (stored) {
    try {
      const { token } = JSON.parse(stored);

      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // ignore broken localStorage data
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl: string = error?.config?.url || "";
    const isAuthCall = requestUrl.includes("/auth/login") || requestUrl.includes("/auth/signup");

    if (status === 401 && !isAuthCall) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      delete api.defaults.headers.common.Authorization;

      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.location.href = "/";
      }
    }

// Attach the JWT token from localStorage on every request so protected
// endpoints are reachable even when a page is loaded fresh (before the
// AuthContext useEffect has had a chance to set the default header).
api.interceptors.request.use((config) => {
  const stored = localStorage.getItem("amar_ration_auth");
  if (stored) {
    try {
      const { token } = JSON.parse(stored);
      if (token) {
        config.headers = config.headers ?? {};
        config.headers["Authorization"] = `Bearer ${token}`;
      }
    } catch {
      // malformed storage – ignore
    }
  }
  return config;
});

export default api;
