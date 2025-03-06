import axios from 'axios';
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

// Create an axios instance
const api = axios.create({
  baseURL: getAuthApiUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to add the token to requests
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    // If the error is 401 (Unauthorized), clear the auth state
    if (error.response && error.response.status === 401) {
      await logout();
    }
    
    return Promise.reject(error);
  }
);

/**
 * Register a new user
 * @param {string} name - User's full name
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise} - Promise with the registration result
 */
export const register = async (name, email, password) => {
  try {
    const response = await api.post('/auth/register', {
      name,
      email,
      password,
    });
    
    const { access_token } = response.data;
    const userData = {
      email: response.data.email,
      name: response.data.name,
      id: response.data.id || response.data.user_id,
      username: response.data.username || response.data.email
    };
    
    // Store token and user data
    await AsyncStorage.setItem('token', access_token);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    
    return { user: userData, token: access_token };
  } catch (error) {
    throw handleError(error);
  }
};

/**
 * Login a user
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise} - Promise with the login result
 */
export const login = async (email, password) => {
  try {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    
    const response = await axios.post(`${getAuthApiUrl()}/auth/token`, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    const { access_token } = response.data;
    const userData = {
      email: response.data.email,
      name: response.data.name,
      id: response.data.id || response.data.user_id,
      username: response.data.username || response.data.email
    };
    
    // Store token and user data
    await AsyncStorage.setItem('token', access_token);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    
    return { user: userData, token: access_token };
  } catch (error) {
    throw handleError(error);
  }
};

/**
 * Login with Google
 * @param {string} token - Google auth token
 * @returns {Promise} - Promise with the login result
 */
export const googleLogin = async (token) => {
  try {
    const response = await api.post('/auth/google', {
      code: token,
    });
    
    const { access_token } = response.data;
    const userData = {
      email: response.data.email,
      name: response.data.name,
      id: response.data.id || response.data.user_id,
      username: response.data.username || response.data.email
    };
    
    // Store token and user data
    await AsyncStorage.setItem('token', access_token);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    
    return { user: userData, token: access_token };
  } catch (error) {
    throw handleError(error);
  }
};

/**
 * Reset password
 * @param {string} email - User's email
 * @returns {Promise} - Promise that resolves when reset email is sent
 */
export const resetPassword = async (email) => {
  try {
    await api.post('/auth/forgot-password', { email });
    return true;
  } catch (error) {
    throw handleError(error);
  }
};

/**
 * Logout the current user
 * @returns {Promise} - Promise that resolves when logout is complete
 */
export const logout = async () => {
  try {
    // Clear storage
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
  } catch (error) {
    console.error('Logout error:', error);
  }
};

/**
 * Get the current user's profile
 * @returns {Promise} - Promise with the user profile
 */
export const getCurrentUser = async () => {
  try {
    const response = await api.get('/auth/me');
    return response.data;
  } catch (error) {
    throw handleError(error);
  }
};

/**
 * Check if the user is authenticated
 * @returns {Promise<boolean>} - Promise that resolves to true if authenticated
 */
export const isAuthenticated = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    return !!token;
  } catch (error) {
    return false;
  }
};

/**
 * Handle API errors
 * @param {Error} error - The error object
 * @returns {Error} - A formatted error
 */
const handleError = (error) => {
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    const { data, status } = error.response;
    
    if (status === 400) {
      return new Error(data.detail || 'Invalid request');
    } else if (status === 401) {
      return new Error('Authentication failed');
    } else if (status === 403) {
      return new Error('You do not have permission to perform this action');
    } else if (status === 404) {
      return new Error('Resource not found');
    } else if (status === 500) {
      return new Error('Server error. Please try again later');
    }
    
    return new Error(data.detail || 'An error occurred');
  } else if (error.request) {
    // The request was made but no response was received
    return new Error('No response from server. Please check your internet connection');
  } else {
    // Something happened in setting up the request that triggered an Error
    return new Error('An error occurred. Please try again');
  }
}; 