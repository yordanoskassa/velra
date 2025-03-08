import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get the API URL from environment variables or use a default
const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:8000';

// For iOS simulator, we need to use 127.0.0.1 instead of localhost
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
  deleteAccount: async () => {},
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
  const [isInitialized, setIsInitialized] = useState(false);

  // Load user data from storage on app start
  useEffect(() => {
    loadUser();
  }, []);

  // Log when user state changes
  useEffect(() => {
    if (isInitialized) {
      console.log('AuthContext: User state changed:', user ? `Logged in as ${user.email}` : 'Logged out');
    }
  }, [user, isInitialized]);

  const loadUser = async () => {
    try {
      setIsLoading(true);
      
      console.log('AuthContext: Loading user data from storage...');
      
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      
      if (token && userData) {
        console.log('AuthContext: Found token and user data in storage');
        const parsedUser = JSON.parse(userData);
        console.log('AuthContext: Setting user state from storage:', parsedUser.email);
        setUser(parsedUser);
      } else {
        console.log('AuthContext: No valid auth data found in storage');
        setUser(null);
      }
    } catch (err) {
      console.error('AuthContext: Error loading user data:', err);
      setError('Failed to load user data');
      setUser(null);
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  };

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
  const register = async (name, email, password, disclaimerAccepted) => {
    console.log('Starting registration process...');
    try {
      setIsLoading(true);
      setError(null);
      
      // Log registration attempt
      console.log(`Attempting to register user: ${email}`);
      
      // Make API request
      const response = await fetch(`${getAuthApiUrl()}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name, 
          email, 
          password, 
          disclaimer_accepted: disclaimerAccepted 
        }),
      });
      
      // Parse response
      const data = await response.json();
      console.log('Registration API response:', data);
      
      // Check if registration was successful
      if (!response.ok) {
        console.error('Registration failed:', data.detail || 'Unknown error');
        throw new Error(data.detail || 'Registration failed');
      }
      
      // Create user object
      const userData = {
        email: data.email,
        name: data.name,
        id: data.id || data.user_id,
        username: data.username || data.email,
        disclaimer_accepted: true
      };
      
      console.log('Registration successful, user data:', userData);
      
      // Save token to storage
      console.log('Saving token to storage...');
      await AsyncStorage.setItem('token', data.access_token);
      
      // Save user data to storage
      console.log('Saving user data to storage...');
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      
      // Update user state - this should trigger navigation change
      console.log('Updating user state...');
      setUser(userData);
      
      console.log('Registration complete, user state updated');
      return userData;
    } catch (error) {
      console.error('Registration error:', error);
      setError(error.message || 'An error occurred during registration');
      throw error;
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

  // Delete account function
  const deleteAccount = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get token
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        throw new Error('Authentication token not found');
      }
      
      console.log('Attempting to delete account...');
      
      // Call API to delete account
      const response = await fetch(`${getAuthApiUrl()}/auth/delete-account`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Delete account response status:', response.status);
      
      if (!response.ok) {
        let errorMessage = 'Failed to delete account';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorData.message || errorMessage;
          console.error('Delete account error response:', errorData);
        } catch (jsonError) {
          console.error('Error parsing error response:', jsonError);
          // If we can't parse the JSON, try to get the text
          try {
            const errorText = await response.text();
            console.error('Error response text:', errorText);
          } catch (textError) {
            console.error('Error getting response text:', textError);
          }
        }
        throw new Error(errorMessage);
      }
      
      console.log('Account deleted successfully');
      
      // Clear storage
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      
      setUser(null);
      return true;
    } catch (err) {
      console.error('Delete account error:', err);
      setError(err.message || 'Failed to delete account. Please try again.');
      throw err;
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
    deleteAccount,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 