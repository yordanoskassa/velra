import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getNewsHeadlines } from '../../api/newsService';

// Storage keys
const STORAGE_KEYS = {
  NOTIFICATION_TOKEN: 'notification_token',
  NOTIFICATION_ENABLED: 'notification_enabled',
  NOTIFICATION_FREQUENCY: 'notification_frequency', // 'daily', 'twice-daily', 'hourly'
  LAST_NOTIFICATION_TIME: 'last_notification_time',
};

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications
 * @returns {Promise<string|null>} Notification token or null if not available
 */
export const registerForPushNotifications = async () => {
  try {
    console.log('Device is physical:', Device.isDevice);
    
    // Check if this is a physical device (notifications won't work on simulators)
    // But continue anyway to support testing on simulators
    if (!Device.isDevice) {
      console.log('Push notifications may not work correctly on simulator/emulator');
      // Continue anyway for testing purposes
    }

    // Check permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // If permission not determined, ask for it
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // If not granted, exit
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    // Get the project ID from Constants
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || 'unknown-project-id';
    console.log('Using project ID for notifications:', projectId);

    // Get the Expo push token
    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    })).data;
    
    console.log('Push Notification Token:', token);
    
    // Store the token
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_TOKEN, token);
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_ENABLED, 'true');
    
    // Configure for Android
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
    
    return token;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
};

/**
 * Schedule a local notification for a hot headline
 * @param {string} title - Headline title
 * @param {string} body - Headline description
 * @param {Object} data - Additional data to include with notification
 * @param {number} seconds - Seconds from now to schedule the notification
 * @param {boolean} forceEnabled - Force send even if notifications are disabled in app settings
 * @returns {Promise<string>} Notification identifier
 */
export const scheduleHeadlineNotification = async (title, body, data = {}, seconds = 5, forceEnabled = false) => {
  try {
    console.log('Attempting to schedule notification...');
    
    // Check permission status
    const { status } = await Notifications.getPermissionsAsync();
    console.log('Notification permission status:', status);
    
    if (status !== 'granted') {
      console.log('Cannot schedule notification: permission not granted');
      return null;
    }
    
    // Ensure notifications are enabled (unless force enabled for testing)
    if (!forceEnabled) {
      const enabled = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_ENABLED);
      console.log('Notifications enabled in storage:', enabled);
      
      if (enabled !== 'true') {
        console.log('Notifications are disabled in app settings');
        
        // Auto-enable notifications if we have OS permission but app setting isn't set
        if (status === 'granted') {
          console.log('Auto-enabling notifications since OS permission is granted');
          await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_ENABLED, 'true');
        } else {
          return null;
        }
      }
    } else {
      console.log('Force enabled for test notification - bypassing app settings check');
    }
    
    // Schedule the notification
    const notificationContent = {
      content: {
        title: title || 'New Market Update',
        body: body || 'Check out the latest market news and analysis',
        data: { ...data, timestamp: new Date().getTime() },
        badge: 1,
      },
      trigger: { seconds },
    };
    
    console.log('Scheduling notification with content:', JSON.stringify(notificationContent));
    
    const identifier = await Notifications.scheduleNotificationAsync(notificationContent);
    
    console.log('Successfully scheduled notification:', identifier);
    
    // Update last notification time
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_NOTIFICATION_TIME, new Date().toISOString());
    
    return identifier;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    console.error('Error details:', error.message);
    return null;
  }
};

/**
 * Cancel all scheduled notifications
 * @returns {Promise<void>}
 */
export const cancelAllNotifications = async () => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('All notifications canceled');
  } catch (error) {
    console.error('Error canceling notifications:', error);
  }
};

/**
 * Enable or disable notifications
 * @param {boolean} enabled - Whether notifications should be enabled
 * @returns {Promise<void>}
 */
export const setNotificationsEnabled = async (enabled) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_ENABLED, enabled ? 'true' : 'false');
    console.log('Notifications enabled:', enabled);
    
    // If disabled, cancel all scheduled notifications
    if (!enabled) {
      await cancelAllNotifications();
    }
  } catch (error) {
    console.error('Error setting notifications enabled:', error);
  }
};

/**
 * Check if notifications are enabled
 * @returns {Promise<boolean>}
 */
export const areNotificationsEnabled = async () => {
  try {
    const enabled = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_ENABLED);
    return enabled === 'true';
  } catch (error) {
    console.error('Error checking if notifications are enabled:', error);
    return false;
  }
};

/**
 * Set notification frequency
 * @param {string} frequency - 'daily', 'twice-daily', or 'hourly'
 * @returns {Promise<void>}
 */
export const setNotificationFrequency = async (frequency) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_FREQUENCY, frequency);
    console.log('Notification frequency set to:', frequency);
  } catch (error) {
    console.error('Error setting notification frequency:', error);
  }
};

/**
 * Get notification frequency
 * @returns {Promise<string>} - 'daily' (default), 'twice-daily', or 'hourly'
 */
export const getNotificationFrequency = async () => {
  try {
    const frequency = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_FREQUENCY);
    return frequency || 'daily'; // Default to daily
  } catch (error) {
    console.error('Error getting notification frequency:', error);
    return 'daily'; // Default to daily on error
  }
};

/**
 * Check if we should send a notification based on frequency settings
 * @returns {Promise<boolean>}
 */
export const shouldSendNotification = async () => {
  try {
    const enabled = await areNotificationsEnabled();
    if (!enabled) return false;
    
    const frequency = await getNotificationFrequency();
    const lastTimeStr = await AsyncStorage.getItem(STORAGE_KEYS.LAST_NOTIFICATION_TIME);
    
    // If no previous notification sent, send one now
    if (!lastTimeStr) return true;
    
    const lastTime = new Date(lastTimeStr);
    const now = new Date();
    const hoursSinceLastNotification = (now - lastTime) / (1000 * 60 * 60);
    
    // Check if enough time has passed based on frequency
    switch (frequency) {
      case 'hourly':
        return hoursSinceLastNotification >= 1; // At least 1 hour
      case 'twice-daily':
        return hoursSinceLastNotification >= 12; // At least 12 hours
      case 'daily':
      default:
        return hoursSinceLastNotification >= 24; // At least 24 hours
    }
  } catch (error) {
    console.error('Error checking if notification should be sent:', error);
    return false;
  }
};

/**
 * Schedule a periodic notification for hot headlines based on frequency settings
 */
export const setupPeriodicHeadlineNotifications = async () => {
  const frequency = await getNotificationFrequency();
  let intervalHours;
  
  switch (frequency) {
    case 'hourly':
      intervalHours = 1;
      break;
    case 'twice-daily':
      intervalHours = 12;
      break;
    case 'daily':
    default:
      intervalHours = 24;
      break;
  }
  
  // Cancel any existing notifications first
  await cancelAllNotifications();
  
  // Schedule a new notification
  const titles = [
    "Breaking Market News",
    "Hot Market Update",
    "Important Market Alert",
    "Market Trends Update",
    "Financial Headlines Alert"
  ];
  
  const bodies = [
    "Check the latest market-moving headlines now",
    "New insights available for today's top stories",
    "Market conditions are changing - get updated",
    "Stay ahead with the latest financial insights",
    "Don't miss today's market analysis"
  ];
  
  // Use random message variations
  const randomTitle = titles[Math.floor(Math.random() * titles.length)];
  const randomBody = bodies[Math.floor(Math.random() * bodies.length)];
  
  // Schedule for future intervals
  await scheduleHeadlineNotification(
    randomTitle,
    randomBody,
    { type: 'periodic' },
    intervalHours * 60 * 60 // Convert hours to seconds
  );
  
  console.log(`Periodic notifications set up with ${frequency} frequency`);
};

// Add listener for notification interactions
export const addNotificationResponseListener = (callback) => {
  return Notifications.addNotificationResponseReceivedListener(response => {
    console.log('Notification response received:', response);
    if (typeof callback === 'function') {
      callback(response);
    }
  });
};

/**
 * Schedule multiple daily notifications with real headlines
 * @param {number} notificationsPerDay - Number of notifications per day (default: 5)
 * @returns {Promise<boolean>} - Success status
 */
export const scheduleMultipleDailyNotifications = async (notificationsPerDay = 5) => {
  try {
    console.log(`Setting up ${notificationsPerDay} daily notifications`);
    
    // Ensure notifications are enabled
    const enabled = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_ENABLED);
    
    if (enabled !== 'true') {
      console.log('Notifications are disabled in app settings, enabling them now');
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_ENABLED, 'true');
    }
    
    // Cancel any existing notifications to avoid duplicates
    await cancelAllNotifications();
    
    // Calculate intervals between notifications (in waking hours from 8am to 10pm)
    const wakingHours = 14; // 8am to 10pm = 14 hours
    const intervalHours = wakingHours / notificationsPerDay;
    
    // Start from 8am
    const now = new Date();
    let baseTime = new Date(now);
    baseTime.setHours(8, 0, 0, 0);
    
    // If it's already past 8am, start from today, otherwise start from tomorrow
    if (now.getHours() >= 8) {
      // Keep today's date
    } else {
      baseTime.setDate(baseTime.getDate() + 1);
    }
    
    // Get some real headlines to use for notifications
    // We'll fetch a few more than we need in case some are unusable
    console.log('Fetching headlines for daily notifications');
    let headlines = [];
    
    try {
      // Try to get real headlines
      const response = await getNewsHeadlines({ limit: notificationsPerDay * 2 });
      
      if (response && response.articles && response.articles.length > 0) {
        headlines = response.articles.map(article => ({
          title: article.title || 'Breaking News',
          body: article.description 
            ? (article.description.length > 100 ? article.description.substring(0, 97) + '...' : article.description)
            : 'Check out the latest financial news and analysis',
          articleId: article.id || null,
          articleUrl: article.url || null
        }));
        
        // Shuffle the headlines for variety
        headlines = headlines.sort(() => Math.random() - 0.5);
        
        console.log(`Fetched ${headlines.length} real headlines for notifications`);
      }
    } catch (error) {
      console.error('Error fetching headlines for notifications:', error);
      // Will use fallback headlines
    }
    
    // If we couldn't get headlines or not enough, add fallbacks
    if (headlines.length < notificationsPerDay) {
      console.log('Adding fallback headlines');
      
      const fallbackTitles = [
        "Breaking Market News",
        "Hot Market Update",
        "Important Market Alert",
        "Market Trends Update",
        "Financial Headlines Alert"
      ];
      
      const fallbackBodies = [
        "Check the latest market-moving headlines now",
        "New insights available for today's top stories",
        "Market conditions are changing - get updated",
        "Stay ahead with the latest financial insights",
        "Don't miss today's market analysis"
      ];
      
      // Add fallbacks until we have enough
      while (headlines.length < notificationsPerDay) {
        const randomTitle = fallbackTitles[Math.floor(Math.random() * fallbackTitles.length)];
        const randomBody = fallbackBodies[Math.floor(Math.random() * fallbackBodies.length)];
        
        headlines.push({
          title: randomTitle,
          body: randomBody,
          articleId: null,
          articleUrl: null
        });
      }
    }
    
    // Schedule notifications throughout the day
    const scheduledNotifications = [];
    
    for (let i = 0; i < notificationsPerDay && i < headlines.length; i++) {
      // Calculate the time for this notification
      const notificationTime = new Date(baseTime);
      notificationTime.setHours(8 + Math.floor(i * intervalHours), Math.floor((i * intervalHours % 1) * 60), 0, 0);
      
      // Skip if the time is in the past
      if (notificationTime <= now) continue;
      
      // Calculate seconds until this notification
      const secondsUntilNotification = Math.floor((notificationTime - now) / 1000);
      
      // Don't schedule if it's more than 24 hours away (Expo limitation)
      if (secondsUntilNotification > 24 * 60 * 60) continue;
      
      console.log(`Scheduling notification for ${notificationTime.toLocaleTimeString()}, in ${secondsUntilNotification} seconds`);
      
      // Get the headline for this notification
      const headline = headlines[i];
      
      // Schedule with real headline content
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: headline.title,
          body: headline.body,
          data: { 
            type: 'headline',
            timestamp: notificationTime.getTime(),
            articleId: headline.articleId,
            articleUrl: headline.articleUrl
          },
          badge: 1,
        },
        trigger: { 
          seconds: secondsUntilNotification
        },
      });
      
      scheduledNotifications.push({
        id: identifier,
        time: notificationTime,
        headline: headline.title
      });
      
      console.log(`Scheduled notification ${identifier} for ${notificationTime.toLocaleTimeString()} with headline: ${headline.title}`);
    }
    
    // Set up a daily repeating schedule - this will run once a day to set up the next day's notifications
    // We'll use AsyncStorage to remember to set up tomorrow's notifications when the app starts
    await AsyncStorage.setItem('SETUP_DAILY_NOTIFICATIONS', 'true');
    await AsyncStorage.setItem('NOTIFICATIONS_PER_DAY', notificationsPerDay.toString());
    
    return scheduledNotifications.length > 0;
  } catch (error) {
    console.error('Error scheduling multiple notifications:', error);
    return false;
  }
};

/**
 * Fetch a real news headline to use in a notification
 * @returns {Promise<Object>} - Promise with headline title and body
 */
export const fetchRealNewsHeadline = async () => {
  try {
    console.log('Fetching real news headline for notification...');
    
    // Fetch latest headlines from the API
    const response = await getNewsHeadlines({ limit: 5 });
    
    // If we have articles, pick one randomly
    if (response && response.articles && response.articles.length > 0) {
      // Choose a random article from the first 5
      const randomIndex = Math.floor(Math.random() * Math.min(5, response.articles.length));
      const article = response.articles[randomIndex];
      
      console.log('Selected headline for notification:', article.title);
      
      // Extract the headline and description
      const title = article.title || 'Breaking News';
      
      // Create a short description from the article content or description
      let body = '';
      if (article.description) {
        // Use description if available, but limit length
        body = article.description.length > 100 
          ? article.description.substring(0, 97) + '...' 
          : article.description;
      } else if (article.content) {
        // Use content as fallback, but limit length
        body = article.content.length > 100 
          ? article.content.substring(0, 97) + '...' 
          : article.content;
      } else {
        // Generic fallback
        body = 'Check out the latest market news and analysis';
      }
      
      return { 
        title, 
        body,
        articleId: article.id || null,
        articleUrl: article.url || null
      };
    } else {
      console.log('No headlines available, using fallback');
      return {
        title: 'Latest Market News',
        body: 'Check the app for the latest market headlines',
        articleId: null,
        articleUrl: null
      };
    }
  } catch (error) {
    console.error('Error fetching real headlines:', error);
    // Return a fallback headline
    return {
      title: 'Market Updates Available',
      body: 'New financial information is waiting for you',
      articleId: null,
      articleUrl: null
    };
  }
};

/**
 * Schedule a notification with a real headline
 * @param {number} seconds - Seconds from now to schedule the notification
 * @returns {Promise<string>} Notification identifier
 */
export const scheduleRealHeadlineNotification = async (seconds = 5) => {
  try {
    console.log('Setting up real headline notification...');
    
    // Check permission status
    const { status } = await Notifications.getPermissionsAsync();
    
    if (status !== 'granted') {
      console.log('Cannot schedule notification: permission not granted');
      return null;
    }
    
    // Fetch real headline content
    const headline = await fetchRealNewsHeadline();
    
    // Schedule the notification
    const notificationContent = {
      content: {
        title: headline.title,
        body: headline.body,
        data: { 
          type: 'headline',
          timestamp: new Date().getTime(),
          articleId: headline.articleId,
          articleUrl: headline.articleUrl
        },
        badge: 1,
      },
      trigger: { seconds },
    };
    
    console.log('Scheduling real headline notification...');
    
    const identifier = await Notifications.scheduleNotificationAsync(notificationContent);
    
    console.log('Successfully scheduled real headline notification:', identifier);
    
    // Update last notification time
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_NOTIFICATION_TIME, new Date().toISOString());
    
    return identifier;
  } catch (error) {
    console.error('Error scheduling real headline notification:', error);
    return null;
  }
};

// Export notification handlers for use in other components
export default {
  registerForPushNotifications,
  scheduleHeadlineNotification,
  cancelAllNotifications,
  setNotificationsEnabled,
  areNotificationsEnabled,
  setNotificationFrequency,
  getNotificationFrequency,
  shouldSendNotification,
  setupPeriodicHeadlineNotifications,
  addNotificationResponseListener,
  scheduleMultipleDailyNotifications,
  scheduleRealHeadlineNotification,
}; 