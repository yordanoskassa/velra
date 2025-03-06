import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get the API URL from environment variables or use a default
const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:8000';

// For iOS simulator, we need to use localhost instead of 127.0.0.1
const getAuthApiUrl = () => {
  // If we're on iOS simulator, replace localhost with the special IP for simulator
  if (Platform.OS === 'ios' && API_URL.includes('localhost')) {
    return API_URL.replace('localhost', '127.0.0.1');
  }
  return API_URL;
};

// Create the context
const AuthContext = createContext({
  user: null,
  isLoading: false,
  error: null,
  login: async () => {},
  register: async () => {},
  googleLogin: async () => {},
  resetPassword: async () => {},
  logout: () => {},
  isAuthenticated: false,
});

// Custom hook to use the auth context
export const useAuth = () => {
  return useContext(AuthContext);
};

// Provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize auth state
  useEffect(() => {
    const loadUser = async () => {
      try {
        setIsLoading(true);
        
        // Check if token exists
        const token = await AsyncStorage.getItem('token');
        
        if (token) {
          // Get user data from storage
          const userData = await AsyncStorage.getItem('user');
          if (userData) {
            setUser(JSON.parse(userData));
          } else {
            // If no user data in storage but token exists, fetch from API
            try {
              const response = await fetch(`${getAuthApiUrl()}/auth/me`, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              
              if (response.ok) {
                const currentUser = await response.json();
                setUser(currentUser);
                await AsyncStorage.setItem('user', JSON.stringify(currentUser));
              } else {
                // If API call fails, clear auth state
                await logout();
              }
            } catch (err) {
              // If API call fails, clear auth state
              await logout();
            }
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        setError(err.message);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  // Login function
  const login = async (email, password) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${getAuthApiUrl()}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `username=${email}&password=${password}`,
      });
      
      const data = await response.json();
      
      if (response.ok) {
        const userData = {
          email: data.email,
          name: data.name,
          id: data.id || data.user_id,
          username: data.username || data.email
        };
        
        setUser(userData);
        
        // Store token and user data
        await AsyncStorage.setItem('token', data.access_token);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        
        return { user: userData, token: data.access_token };
      } else {
        throw new Error(data.detail || 'Login failed');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during login');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Register function
  const register = async (name, email, password) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${getAuthApiUrl()}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        const userData = {
          email: data.email,
          name: data.name,
          id: data.id || data.user_id,
          username: data.username || data.email
        };
        
        setUser(userData);
        
        // Store token and user data
        await AsyncStorage.setItem('token', data.access_token);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        
        return { user: userData, token: data.access_token };
      } else {
        throw new Error(data.detail || 'Registration failed');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during registration');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Google login function
  const googleLogin = async (token) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${getAuthApiUrl()}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: token }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        const userData = {
          email: data.email,
          name: data.name,
          id: data.id || data.user_id,
          username: data.username || data.email
        };
        
        setUser(userData);
        
        // Store token and user data
        await AsyncStorage.setItem('token', data.access_token);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        
        return { user: userData, token: data.access_token };
      } else {
        throw new Error(data.detail || 'Google login failed');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during Google login');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Reset password function
  const resetPassword = async (email) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${getAuthApiUrl()}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Password reset request failed');
      }
      
      return true;
    } catch (err) {
      setError(err.message || 'Failed to send reset email. Please try again.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      setIsLoading(true);
      
      // Clear storage
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      
      setUser(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Context value
  const value = {
    user,
    isLoading,
    error,
    login,
    register,
    googleLogin,
    resetPassword,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 