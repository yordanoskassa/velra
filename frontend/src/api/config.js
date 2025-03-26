import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Default API URL - overridden via AsyncStorage
let CACHED_API_URL = 'https://decodr-api.onrender.com';

// For development, allow running the app without a backend
let USE_MOCK_API = false;

/**
 * Set whether to use mock API instead of real backend
 */
export const setUseMockApi = async (useMock) => {
  USE_MOCK_API = useMock;
  await AsyncStorage.setItem('use_mock_api', useMock ? 'true' : 'false');
  console.log('Mock API mode:', useMock);
  return useMock;
};

// Load mock API preference
AsyncStorage.getItem('use_mock_api').then(value => {
  if (value === 'true') {
    USE_MOCK_API = true;
    console.log('Using mock API mode from storage');
  }
});

/**
 * Update the API URL at runtime
 * @param {string} newUrl - The new API URL to use
 */
export const setApiUrl = async (newUrl) => {
  if (!newUrl) return;
  
  // Store the URL in AsyncStorage
  await AsyncStorage.setItem('api_url', newUrl);
  CACHED_API_URL = newUrl;
  console.log('API URL updated to:', newUrl);
  return newUrl;
};

/**
 * Get the stored API URL
 * @returns {Promise<string>} - The stored API URL
 */
export const loadApiUrl = async () => {
  try {
    const storedUrl = await AsyncStorage.getItem('api_url');
    if (storedUrl) {
      CACHED_API_URL = storedUrl;
      console.log('Loaded stored API URL:', storedUrl);
    }
    return CACHED_API_URL;
  } catch (error) {
    console.error('Error loading API URL:', error);
    return CACHED_API_URL;
  }
};

// Load the stored URL if available (will execute on import)
loadApiUrl();

/**
 * Get the base API URL, handling iOS/Android special cases
 * @returns {string} The base API URL
 */
export const getApiUrl = () => {
  // If mock API is enabled, return a special URL
  if (USE_MOCK_API) {
    console.log('Using mock API mode - backend calls will be intercepted');
    return 'mock://api';
  }
  
  // Special handling for web platform to avoid CORS issues
  if (Platform.OS === 'web') {
    console.log('Web platform detected, using special configuration');
    
    // First, try to detect if we're running in development or production
    const isLocalDevelopment = window.location.hostname === 'localhost' || 
                              window.location.hostname === '127.0.0.1';
    
    if (isLocalDevelopment) {
      // In local development, we can use the proxy configured in package.json
      console.log('Local development detected, using proxy via relative URL');
      return '';
    } else {
      // In production or other environments, we need the full URL
      // You may need to ensure CORS is enabled on your backend
      console.log('Production or external environment detected, using full URL');
      return CACHED_API_URL;
    }
  }
  
  // For physical device testing with Render API
  // Don't include the trailing slash in the URL
  const RENDER_API_URL = CACHED_API_URL;
  
  // FORCE_API: Set to true to always use Render API URL regardless of device
  const FORCE_API = true;
  
  // ALWAYS use Render API URL when on a physical device
  // Constants.isDevice will be true when running on physical device
  const isPhysicalDevice = Constants.isDevice;
  
  // Use Render API URL when on a physical device or when forced, otherwise use localhost
  let API_URL = FORCE_API || isPhysicalDevice ? 
    RENDER_API_URL : 
    (Constants.expoConfig?.extra?.apiUrl ?? 'http://localhost:8001');

  // Handle localhost for emulators (only applies if not using Render API)
  if (API_URL.includes('localhost')) {
    if (Platform.OS === 'android') {
      API_URL = API_URL.replace('localhost', '10.0.2.2');
    } else if (Platform.OS === 'ios') {
      API_URL = API_URL.replace('localhost', '127.0.0.1');
    }
  }

  console.log('Force API:', FORCE_API);
  console.log('Device is physical:', isPhysicalDevice);
  console.log('Base API URL:', API_URL);
  return API_URL;
};

/**
 * Get the auth API URL
 * @returns {string} The auth API URL
 */
export const getAuthApiUrl = () => {
  const authUrl = `${getApiUrl()}/auth`;
  console.log('Auth API URL:', authUrl);
  return authUrl;
};

/**
 * Get the news API URL
 * @returns {string} The news API URL
 */
export const getNewsApiUrl = () => `${getApiUrl()}/news`;

/**
 * Get the stocks API URL
 * @returns {string} The stocks API URL
 */
export const getStocksApiUrl = () => `${getApiUrl()}/stocks`;

export default {
  getApiUrl,
  getAuthApiUrl,
  getNewsApiUrl,
  getStocksApiUrl
};
