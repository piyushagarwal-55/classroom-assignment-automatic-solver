import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { authAPI } from '../utils/api';

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture?: string;
  subscription: 'free' | 'premium' | 'enterprise';
  assignmentsSolved: number;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is authenticated on app load
  const checkAuth = useCallback(async () => {
    console.log('🔐 AuthContext - checkAuth called');
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      console.log('🔐 AuthContext - Token from localStorage:', token ? 'Token present' : 'No token');
      console.log('🔐 AuthContext - Stored user from localStorage:', storedUser ? 'User data present' : 'No user data');
      
      if (!token) {
        console.log('🔐 AuthContext - No token found, setting not authenticated');
        setIsLoading(false);
        setIsAuthenticated(false);
        setUser(null);
        return;
      }

      // If we have both token and user data, set authenticated state immediately
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          console.log('🔐 AuthContext - Setting user from stored data:', userData.email);
          setUser(userData);
          setIsAuthenticated(true);
        } catch (e) {
          console.error('🔐 AuthContext - Error parsing stored user data:', e);
        }
      }

      // Verify token with server
      console.log('🔐 AuthContext - Verifying token with server...');
      try {
        const response = await authAPI.getMe();
        console.log('🔐 AuthContext - Server response:', response);
        
        if (response.success) {
          console.log('🔐 AuthContext - Authentication successful, user:', response.data.user.email);
          setUser(response.data.user);
          setIsAuthenticated(true);
          // Update stored user data
          localStorage.setItem('user', JSON.stringify(response.data.user));
        } else {
          console.log('🔐 AuthContext - Authentication failed, clearing token');
          // Invalid token, clear it
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (error: any) {
        console.error('🔐 AuthContext - Auth check failed:', error);
        // Don't clear immediately - token might still be valid, just network issue
        // Only clear if it's a 401 error
        if (error.response?.status === 401) {
          console.log('🔐 AuthContext - 401 error, clearing token');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setIsAuthenticated(false);
          setUser(null);
        }
      }
    } catch (error: any) {
      console.error('🔐 AuthContext - Auth check failed:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      console.log('🔐 AuthContext - Auth check complete, authenticated:', isAuthenticated);
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const login = async (email: string, password: string) => {
    try {
      const response = await authAPI.login({ email, password });
      
      if (response.success) {
        const { user, token } = response.data;
        
        // Store token and user data
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        setUser(user);
        setIsAuthenticated(true);
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Clear any existing auth data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setIsAuthenticated(false);
      
      throw new Error(error.response?.data?.message || error.message || 'Login failed');
    }
  };

  const register = async (userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => {
    try {
      const response = await authAPI.register(userData);
      
      if (response.success) {
        const { user, token } = response.data;
        
        // Store token and user data
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        setUser(user);
        setIsAuthenticated(true);
      } else {
        throw new Error(response.message || 'Registration failed');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(error.response?.data?.message || 'Registration failed');
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage and state regardless of API call success
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const value = {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    updateUser,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
