import axios from 'axios';
import { cognitoService } from '../cognitoService';

const baseURL = import.meta.env.VITE_API_BASE_URL || undefined;
const apiClient = axios.create({ timeout: 30000, baseURL });

apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await cognitoService.getAccessToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (_) {}
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export { apiClient };


