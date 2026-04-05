const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const REQUEST_TIMEOUT_MS = 12000;

const makeUrl = (path, query = {}) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  const base = API_BASE_URL
    ? new URL(API_BASE_URL.endsWith("/") ? API_BASE_URL : `${API_BASE_URL}/`)
    : new URL(window.location.origin);

  const url = new URL(normalizedPath, base);

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  if (API_BASE_URL) {
    return url.toString();
  }

  return `${url.pathname}${url.search}`;
};

export const apiRequest = async (path, options = {}) => {
  const { query, timeoutMs = REQUEST_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(makeUrl(path, query), {
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(fetchOptions.headers || {}),
      },
      ...fetchOptions,
    });

    if (!response.ok) {
      const detail = await response.text();
      const error = new Error(detail || `Request failed with status ${response.status}`);
      error.status = response.status;
      throw error;
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
};
