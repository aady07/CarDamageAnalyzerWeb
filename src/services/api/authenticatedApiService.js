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
      console.log('[API Client] Request interceptor - Added auth token, URL:', config.url);
    } else {
      console.warn('[API Client] Request interceptor - No auth token available, URL:', config.url);
    }
  } catch (err) {
    console.error('[API Client] Request interceptor - Error getting token:', err);
  }
  console.log('[API Client] Request config:', {
    url: config.url,
    method: config.method,
    baseURL: config.baseURL,
    hasAuth: !!config.headers?.Authorization,
    params: config.params
  });
  return config;
});

apiClient.interceptors.response.use(
  (res) => {
    console.log('[API Client] Response interceptor - Success:', {
      url: res.config?.url,
      status: res.status,
      statusText: res.statusText,
      dataKeys: res.data ? Object.keys(res.data) : []
    });
    return res;
  },
  (err) => {
    console.error('[API Client] Response interceptor - Error:', {
      url: err.config?.url,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data,
      message: err.message
    });
    if (err.response?.status === 401) {
      console.warn('[API Client] 401 Unauthorized - Redirecting to login');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export { apiClient };


