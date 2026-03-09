const API_BASE_URL = "http://localhost:5000/api";

function getToken() {
  const raw = localStorage.getItem("amar_ration_auth");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed?.token || parsed?.accessToken || null;
  } catch {
    return null;
  }
}

async function request(endpoint: string, options: RequestInit = {}) {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || `API request failed with status ${response.status}`);
  }

  return data;
}

const api = {
  get: (endpoint: string) => request(endpoint),
  post: (endpoint: string, body: unknown) =>
    request(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  put: (endpoint: string, body: unknown) =>
    request(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  patch: (endpoint: string, body: unknown) =>
    request(endpoint, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  delete: (endpoint: string) =>
    request(endpoint, {
      method: "DELETE",
    }),
};

export default api;