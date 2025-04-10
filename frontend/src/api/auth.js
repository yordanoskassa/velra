import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Get the current auth token from AsyncStorage
 * @returns {Promise<string|null>} The authentication token or null if not found
 */
export const getAuthToken = async () => {
  try {
    return await AsyncStorage.getItem('token');
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}; 