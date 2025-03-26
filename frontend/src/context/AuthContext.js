import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getAuthApiUrl } from '../api/config';
import * as authService from '../api/authService';

// Create the Auth Context
const AuthContext = createContext({
  user: null,
  token: null,
  isLoading: false,
  error: null,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
  register: async () => {},
  resetPassword: async () => {},
  googleLogin: async () => {},
  appleLogin: async () => {},
  deleteAccount: async () => {},
  clearError: () => {},
});

// Auth Provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Restore user session on app start
  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        setLoading(true);
        const userData = await AsyncStorage.getItem('user');
        const storedToken = await AsyncStorage.getItem('token');
        
        if (userData && storedToken) {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
          setToken(storedToken);
          setIsPremium(parsedUser.isPremium || false);
          
          // Verify token is still valid
          try {
            const response = await fetch(`${getAuthApiUrl()}/auth/verify`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${storedToken}`
              }
            });
            
            if (!response.ok) {
              throw new Error('Token invalid');
            }
            
            // Optionally refresh user data
            const userResponse = await fetch(`${getAuthApiUrl()}/users/me`, {
              headers: {
                'Authorization': `Bearer ${storedToken}`
              }
            });
            
            if (userResponse.ok) {
              const freshUserData = await userResponse.json();
              setUser(freshUserData);
              setIsPremium(freshUserData.isPremium || false);
              await AsyncStorage.setItem('user', JSON.stringify(freshUserData));
            }
          } catch (error) {
            console.log('Session verification failed:', error);
            // Clear invalid session
            setUser(null);
            setToken(null);
            setIsPremium(false);
            await AsyncStorage.removeItem('user');
            await AsyncStorage.removeItem('token');
          }
        }
      } catch (e) {
        console.error('Failed to restore user session:', e);
      } finally {
        setLoading(false);
      }
    };

    bootstrapAsync();
  }, []);

  // Webhook subscription listener for premium status changes
  useEffect(() => {
    if (!user) return;
    
    // This would be replaced with actual webhook implementation
    const subscriptionListener = async () => {
      try {
        // Poll for subscription changes every 5 minutes
        const interval = setInterval(async () => {
          if (!token) {
            clearInterval(interval);
            return;
          }
          
          const response = await fetch(`${getAuthApiUrl()}/users/subscription-status`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.isPremium !== isPremium) {
              setIsPremium(data.isPremium);
              
              // Update user object
              const updatedUser = {...user, isPremium: data.isPremium};
              setUser(updatedUser);
              await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
            }
          }
        }, 5 * 60 * 1000); // Every 5 minutes
        
        return () => clearInterval(interval);
      } catch (error) {
        console.error('Error in subscription listener:', error);
      }
    };
    
    subscriptionListener();
  }, [user, token]);

  // Login function
  const login = async (email, password) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await authService.login({ email, password });
      
      const { access_token } = response;
      const userData = {
        email: response.email,
        name: response.name,
        id: response.id || response.user_id,
        username: response.username || response.email,
        isPremium: response.isPremium || false
      };
      
      // Store token and user data
      await AsyncStorage.setItem('token', access_token);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      
      setToken(access_token);
      setUser(userData);
      setIsPremium(userData.isPremium || false);
      return { user: userData, token: access_token };
    } catch (err) {
      setError(err.message || 'An error occurred during login');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Register function
  const register = async (name, email, password, disclaimerAccepted) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await authService.register({ 
        name, 
        email, 
        password, 
        disclaimer_accepted: disclaimerAccepted 
      });
      
      const { access_token } = response;
      const userData = {
        email: response.email,
        name: response.name,
        id: response.id || response.user_id,
        username: response.username || response.email,
        isPremium: response.isPremium || false
      };
      
      // Store token and user data
      await AsyncStorage.setItem('token', access_token);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      
      setToken(access_token);
      setUser(userData);
      setIsPremium(userData.isPremium || false);
      return { user: userData, token: access_token };
    } catch (err) {
      setError(err.message || 'An error occurred during registration');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    setIsLoading(true);
    
    try {
      console.log('Logging out user:', user?.email);
      
      // First remove token from AsyncStorage
      await AsyncStorage.removeItem('token');
      console.log('Token cleared from AsyncStorage');
      
      // Then remove user data
      await AsyncStorage.removeItem('user');
      console.log('User data cleared from AsyncStorage');
      
      // Finally update state
      setToken(null);
      setUser(null);
      setIsPremium(false);
      console.log('User logged out successfully');
    } catch (err) {
      console.error('Error during logout:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset password function
  const resetPassword = async (email) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await authService.resetPassword(email);
      return true;
    } catch (err) {
      setError(err.message || 'An error occurred during password reset');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Google login function
  const googleLogin = async (token) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await authService.googleLogin(token);
      
      const { access_token } = response;
      const userData = {
        email: response.email,
        name: response.name,
        id: response.id || response.user_id,
        username: response.username || response.email,
        isPremium: response.isPremium || false
      };
      
      // Store token and user data
      await AsyncStorage.setItem('token', access_token);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      
      setToken(access_token);
      setUser(userData);
      setIsPremium(userData.isPremium || false);
      return { user: userData, token: access_token };
    } catch (err) {
      setError(err.message || 'An error occurred during Google login');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Apple login function
  const appleLogin = async (identityToken, fullName) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await authService.appleLogin(identityToken, fullName);
      
      const { access_token } = response;
      const userData = {
        email: response.email,
        name: response.name,
        id: response.id || response.user_id,
        username: response.username || response.email,
        isPremium: response.isPremium || false
      };
      
      // Store token and user data
      await AsyncStorage.setItem('token', access_token);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      
      setToken(access_token);
      setUser(userData);
      setIsPremium(userData.isPremium || false);
      return { user: userData, token: access_token };
    } catch (err) {
      setError(err.message || 'An error occurred during Apple login');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete account function
  const deleteAccount = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await authService.deleteAccount();
      
      // Clear user data and token
      setToken(null);
      setUser(null);
      setIsPremium(false);
      
      return true;
    } catch (err) {
      setError(err.message || 'An error occurred while deleting your account');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Clear error function
  const clearError = () => {
    setError(null);
  };

  // Context value
  const value = {
    user,
    token,
    isLoading,
    error,
    isAuthenticated: !!token,
    isInitialized,
    isPremium,
    login,
    logout,
    register,
    resetPassword,
    googleLogin,
    appleLogin,
    deleteAccount,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext; 