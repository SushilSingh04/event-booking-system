import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Attach JWT Bearer token if present
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Global error handler & auto logout on 401 Unauthorized
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear persisted credentials
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Dispatch auth event so AuthContext reactively clears its internal state
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));

      // If user is not already on the login or register page, redirect to /login
      if (
        window.location.pathname !== '/login' &&
        window.location.pathname !== '/register'
      ) {
        window.location.href = `/login?redirect=${encodeURIComponent(
          window.location.pathname + window.location.search
        )}`;
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Extracts a user-friendly error message from FastAPI and AppException responses.
 *
 * @param {Error|Object} error - Axios error object
 * @returns {string} Human-readable error description
 */
export const getErrorMessage = (error) => {
  if (!error) return 'An unknown error occurred.';

  // Backend AppException standard JSON format: { success: false, error: { message: ... } }
  if (error.response?.data?.error?.message) {
    return error.response.data.error.message;
  }

  // FastAPI default HTTP / validation exceptions: { detail: ... }
  if (error.response?.data?.detail) {
    const detail = error.response.data.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (Array.isArray(detail)) {
      return detail
        .map((item) => (item.msg ? `${item.loc?.slice(-1)[0] || 'field'}: ${item.msg}` : String(item)))
        .join('; ');
    }
    if (typeof detail === 'object') {
      return JSON.stringify(detail);
    }
  }

  // Generic network or HTTP status errors
  if (error.message) {
    if (error.message === 'Network Error') {
      return 'Unable to connect to the backend server. Please verify the API is running at ' + API_BASE_URL;
    }
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
};

export default client;
