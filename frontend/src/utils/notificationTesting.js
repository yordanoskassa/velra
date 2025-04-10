import AsyncStorage from '@react-native-async-storage/async-storage';

// Constants for keys
const NOTIFICATION_PROMPT_SHOWN = 'notification_prompt_shown';
const NOTIFICATION_FIRST_OPEN_TIME = 'notification_first_open_time';

/**
 * Reset notification prompt state to simulate a new app install
 * @returns {Promise<void>}
 */
export const resetNotificationPromptState = async () => {
  try {
    await AsyncStorage.multiRemove([
      NOTIFICATION_PROMPT_SHOWN,
      NOTIFICATION_FIRST_OPEN_TIME
    ]);
    console.log('Notification prompt state reset successfully');
  } catch (error) {
    console.error('Error resetting notification prompt state:', error);
  }
};

/**
 * Set the first open time to a specific time in the past to trigger the prompt immediately
 * @param {number} minutesAgo - Number of minutes to set the first open time in the past
 * @returns {Promise<void>}
 */
export const setFirstOpenTimeInPast = async (minutesAgo = 5) => {
  try {
    const pastTime = Date.now() - (minutesAgo * 60 * 1000);
    await AsyncStorage.setItem(NOTIFICATION_FIRST_OPEN_TIME, pastTime.toString());
    console.log(`First open time set to ${minutesAgo} minutes ago`);
  } catch (error) {
    console.error('Error setting first open time:', error);
  }
};

/**
 * Check the current notification prompt state
 * @returns {Promise<Object>} - Object containing the current state
 */
export const checkNotificationPromptState = async () => {
  try {
    const promptShown = await AsyncStorage.getItem(NOTIFICATION_PROMPT_SHOWN);
    const firstOpenTime = await AsyncStorage.getItem(NOTIFICATION_FIRST_OPEN_TIME);
    
    return {
      promptShown: promptShown === 'true',
      firstOpenTime: firstOpenTime ? new Date(parseInt(firstOpenTime)).toLocaleString() : null,
    };
  } catch (error) {
    console.error('Error checking notification prompt state:', error);
    return { error: error.message };
  }
};

/**
 * For testing: Force show the notification prompt by setting prompt shown to false
 * and first open time to 5 minutes ago
 * @returns {Promise<void>}
 */
export const forceShowNotificationPrompt = async () => {
  try {
    await resetNotificationPromptState();
    await setFirstOpenTimeInPast(5);
    console.log('Set up to force show notification prompt');
  } catch (error) {
    console.error('Error setting up to force show notification prompt:', error);
  }
};

export default {
  resetNotificationPromptState,
  setFirstOpenTimeInPast,
  checkNotificationPromptState,
  forceShowNotificationPrompt,
}; 