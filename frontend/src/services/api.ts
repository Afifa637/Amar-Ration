const API_BASE_URL = "http://localhost:5000/api";

const request = async (endpoint: string, options: RequestInit = {}) => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

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
