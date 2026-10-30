import axios from 'axios';

// Read API base URL from Vite environment variable with local fallback
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor for optional JWT token attachment (does not block public demo endpoints)
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('agrinexa_auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Global response error handler with clear error messaging
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    let errorMessage = 'An unexpected error occurred.';
    let isNetworkError = false;

    if (error.response) {
      // Server responded with an error status (4xx, 5xx)
      const data = error.response.data;
      if (typeof data?.detail === 'string') {
        errorMessage = data.detail;
      } else if (Array.isArray(data?.detail) && data.detail[0]?.msg) {
        errorMessage = data.detail[0].msg;
      } else {
        errorMessage = data?.message || `Server error: ${error.response.status}`;
      }
    } else if (error.request) {
      // Request was made but no response was received (backend down, CORS, network offline)
      isNetworkError = true;
      errorMessage = 'Unable to connect to AgriNexa backend server (http://127.0.0.1:8000). Please verify FastAPI is running.';
    } else {
      errorMessage = error.message || errorMessage;
    }

    const enhancedError = {
      message: errorMessage,
      status: error.response?.status,
      isNetworkError,
      originalError: error,
    };

    console.warn('[AgriNexa API Error]:', errorMessage);
    return Promise.reject(enhancedError);
  }
);

export default apiClient;
