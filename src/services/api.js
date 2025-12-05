// api.js
import axios from 'axios';
import { getAuth } from 'firebase/auth';

const baseURL =
  import.meta.env.VITE_USE_AUTH_EMULATOR === 'true'
    ? import.meta.env.VITE_API_URL_LOCAL
    : import.meta.env.VITE_API_URL_REMOTE;

const api = axios.create({
  baseURL,
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const auth = getAuth();
  if (auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    localStorage.setItem('AuthToken', token);
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('AuthToken');
      window.location.href = '/login';
    }
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timed out. Please try again.');
    }
    return Promise.reject(error);
  },
);

export default api;
