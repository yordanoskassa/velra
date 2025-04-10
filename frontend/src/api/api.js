import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from './config';

// Create an Axios instance with the API URL
export const api = axios.create({
  baseURL: getApiUrl(),
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
    // If the error is 401 (Unauthorized), it will be handled by the auth context
    return Promise.reject(error);
  }
); 