import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Default API URL - using production endpoint
export const CACHED_API_URL = 'https://velra.onrender.com';

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
  // Use production URL for all platforms
  console.log('Using production API URL:', CACHED_API_URL);
  return CACHED_API_URL;
};

/**
 * Get the auth API URL
 * @returns {string} The auth API URL
 */
export const getAuthApiUrl = () => {
  const baseUrl = getApiUrl();
  // Remove any trailing slashes, but make sure to use the /api/auth path format
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
  const authUrl = `${cleanBaseUrl}/api/auth`;
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

/**
 * Test the API connection to verify it's working
 * @returns {Promise<boolean>} Whether the API is accessible
 */
export const testApiConnection = async () => {
  try {
    const apiUrl = getApiUrl();
    console.log('Testing API connection to:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    const data = await response.json();
    console.log('API response:', data);
    
    // Successful connection
    return true;
  } catch (error) {
    console.error('API connection test failed:', error);
    return false;
  }
};

export default {
  getApiUrl,
  getAuthApiUrl,
  getNewsApiUrl,
  getStocksApiUrl,
  testApiConnection
};
