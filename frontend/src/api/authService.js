import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getAuthApiUrl } from './config';

// Create an Axios instance with the API URL
const api = axios.create({
  baseURL: getAuthApiUrl(),
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
 * @param {Object} userData - User registration data
 * @returns {Promise} - Promise with registration response
 */
export const register = async (userData) => {
  try {
    console.log('API URL:', getAuthApiUrl());
    console.log('Register endpoint:', `${getAuthApiUrl()}/register`);
    // Ensure userData has disclaimer_accepted set
    const dataWithDisclaimer = {
      ...userData,
      disclaimer_accepted: true
    };
    console.log('Sending registration data:', JSON.stringify(dataWithDisclaimer));
    
    // The baseURL already includes '/auth', so we just need '/register'
    const response = await api.post('/register', dataWithDisclaimer);
    console.log('Registration response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Registration error details:', error);
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Error response status:', error.response.status);
      console.error('Error response data:', error.response.data);
      throw new Error(error.response.data.detail || 'Registration failed');
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received for request:', error.request);
      throw new Error('No response from server. Please check your internet connection.');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error setting up request:', error.message);
      throw new Error('Error setting up request: ' + error.message);
    }
  }
};

/**
 * Login a user
 * @param {Object} credentials - User login credentials
 * @returns {Promise} - Promise with login response
 */
export const login = async (credentials) => {
  try {
    // Ensure credentials include disclaimer_accepted
    const credentialsWithDisclaimer = {
      ...credentials,
      disclaimer_accepted: true
    };
    
    // The baseURL already includes '/auth', so we just need '/login'
    const response = await api.post('/login', credentialsWithDisclaimer);
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.detail || 'Login failed');
    } else if (error.request) {
      throw new Error('No response from server. Please check your internet connection.');
    } else {
      throw new Error('Error setting up request: ' + error.message);
    }
  }
};

/**
 * Reset password
 * @param {string} email - User email
 * @returns {Promise} - Promise with reset password response
 */
export const resetPassword = async (email) => {
  try {
    // The baseURL already includes '/auth', so we just need '/reset-password'
    const response = await api.post('/reset-password', { email });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.detail || 'Password reset failed');
    } else if (error.request) {
      throw new Error('No response from server. Please check your internet connection.');
    } else {
      throw new Error('Error setting up request: ' + error.message);
    }
  }
};

/**
 * Get user profile
 * @param {string} token - User authentication token
 * @returns {Promise} - Promise with user profile
 */
export const getUserProfile = async (token) => {
  try {
    // The baseURL already includes '/auth', so we just need '/profile'
    const response = await api.get('/profile', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.detail || 'Failed to get user profile');
    } else if (error.request) {
      throw new Error('No response from server. Please check your internet connection.');
    } else {
      throw new Error('Error setting up request: ' + error.message);
    }
  }
};

/**
 * Login with Google
 * @param {string} token - Google auth token
 * @returns {Promise} - Promise with login response
 */
export const googleLogin = async (token) => {
  try {
    // The baseURL already includes '/auth', so we just need '/google'
    const response = await api.post('/google', {
      token,
      disclaimer_accepted: true
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.detail || 'Google login failed');
    } else if (error.request) {
      throw new Error('No response from server. Please check your internet connection.');
    } else {
      throw new Error('Error setting up request: ' + error.message);
    }
  }
};

/**
 * Login with Apple credentials
 * @param {string} identityToken - Apple identity token
 * @param {Object} fullName - User's full name (optional)
 * @returns {Promise} - Promise with login response
 */
export const appleLogin = async (identityToken, fullName = null) => {
  try {
    console.log('Apple login - sending request with:', { identityToken: identityToken.substring(0, 20) + '...', fullName });
    
    // The baseURL already includes '/auth', so we just need '/apple'
    const response = await api.post('/apple', {
      identity_token: identityToken, // This is the key for backend
      full_name: fullName,
      disclaimer_accepted: true
    });
    return response.data;
  } catch (error) {
    console.error('Apple login error details:', error.response?.data || error.message);
    if (error.response) {
      throw new Error(error.response.data.detail || 'Apple login failed');
    } else if (error.request) {
      throw new Error('No response from server. Please check your internet connection.');
    } else {
      throw new Error('Error setting up request: ' + error.message);
    }
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
 * Delete the current user's account
 * @returns {Promise} - Promise that resolves when account is deleted
 */
export const deleteAccount = async () => {
  try {
    console.log('Attempting to delete account');
    const response = await api.delete('/delete-account');
    console.log('Delete account response:', response.data);
    
    // Clear storage after successful deletion
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    
    return response.data;
  } catch (error) {
    console.error('Delete account error in service:', error);
    
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      throw new Error(error.response.data.detail || 'Failed to delete account');
    } else if (error.request) {
      console.error('No response received for request:', error.request);
      throw new Error('No response from server. Please check your internet connection.');
    } else {
      console.error('Error setting up request:', error.message);
      throw new Error('Error setting up request: ' + error.message);
    }
  }
};

/**
 * Get the current user's profile
 * @returns {Promise} - Promise with the user profile
 */
export const getCurrentUser = async () => {
  try {
    // The baseURL already includes '/auth', so we just need '/me'
    const response = await api.get('/me');
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