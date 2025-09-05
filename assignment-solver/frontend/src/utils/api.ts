import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    console.log('🌐 API REQUEST - Making request to:', config.url);
    const token = localStorage.getItem('token');
    console.log('🌐 API REQUEST - Token from localStorage:', token ? 'Token present' : 'No token found');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('🌐 API REQUEST - Added Authorization header');
    } else {
      console.log('🌐 API REQUEST - No token to add to headers');
    }
    console.log('🌐 API REQUEST - Final headers:', config.headers);
    return config;
  },
  (error) => {
    console.error('🌐 API REQUEST ERROR:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => {
    console.log('🌐 API RESPONSE - Success:', response.config.url, response.status);
    return response;
  },
  (error) => {
    console.error('🌐 API RESPONSE ERROR:', error.config?.url, error.response?.status);
    console.error('🌐 API RESPONSE ERROR Details:', error.response?.data);
    
    if (error.response?.status === 401) {
      const isAssignmentEndpoint = error.config?.url?.includes('/assignments');
      const isAuthEndpoint = error.config?.url?.includes('/auth');
      
      console.log('🌐 API 401 ERROR - Assignment endpoint:', isAssignmentEndpoint);
      console.log('🌐 API 401 ERROR - Auth endpoint:', isAuthEndpoint);
      
      // For assignment endpoints, let the component handle the Google auth flow
      if (isAssignmentEndpoint) {
        console.log('🌐 API 401 ERROR - Letting assignment component handle error');
        return Promise.reject(error);
      }
      
      // For auth endpoints, only redirect if it's not a token verification call
      if (isAuthEndpoint && !error.config?.url?.includes('/auth/me')) {
        console.log('🌐 API 401 ERROR - Clearing token and redirecting to signin');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/signin';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: async (userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  login: async (credentials: { email: string; password: string }) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  getMe: async () => {
    console.log('🔐 authAPI.getMe - Starting auth check');
    const response = await api.get('/auth/me');
    console.log('🔐 authAPI.getMe - Response received:', response.data);
    return response.data;
  },

  updateProfile: async (profileData: {
    firstName?: string;
    lastName?: string;
  }) => {
    const response = await api.put('/auth/profile', profileData);
    return response.data;
  },

  changePassword: async (passwordData: {
    currentPassword: string;
    newPassword: string;
  }) => {
    const response = await api.put('/auth/change-password', passwordData);
    return response.data;
  },
};

// User API
export const userAPI = {
  getProfile: async () => {
    const response = await api.get('/user/profile');
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/user/stats');
    return response.data;
  },

  deactivateAccount: async () => {
    const response = await api.delete('/user/account');
    return response.data;
  },
};

// Health check
export const healthCheck = async () => {
  const response = await api.get('/health');
  return response.data;
};

export default api;
