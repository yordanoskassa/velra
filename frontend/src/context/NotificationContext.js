import React, { createContext, useState, useContext, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/api';
import { getAuthToken } from '../api/auth';
import * as notificationService from '../services/notifications/notificationService';
import { Platform } from 'react-native';

// Create context
const NotificationContext = createContext();

// Default notification settings
const DEFAULT_NOTIFICATION_SETTINGS = {
  enabled: false,
  frequency: 'daily' // 'hourly', 'daily', or 'weekly'
};

// Define keys for storage
const NOTIFICATION_PROMPT_SHOWN = 'notification_prompt_shown';
const NOTIFICATION_FIRST_OPEN_TIME = 'notification_first_open_time';
const NOTIFICATION_PERMISSION_STATUS = 'notification_permission_status';

export const NotificationProvider = ({ children }) => {
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(false);
  const [notificationFrequency, setNotificationFrequency] = useState('daily');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pushToken, setPushToken] = useState(null);
  const [notificationSettings, setNotificationSettings] = useState(DEFAULT_NOTIFICATION_SETTINGS);
  const [isNotificationPromptVisible, setIsNotificationPromptVisible] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [hasPromptBeenShown, setHasPromptBeenShown] = useState(false);

  // Register for push notifications on mount
  useEffect(() => {
    registerForPushNotifications();
    loadNotificationSettings();
  }, []);

  // Register for push notifications
  const registerForPushNotifications = async () => {
    try {
      // Check if we have permission
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // If we don't have permission, ask for it
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      // If we still don't have permission, exit
      if (finalStatus !== 'granted') {
        return;
      }

      // Get the token
      const token = await notificationService.registerForPushNotificationsAsync();
      
      if (token) {
        setPushToken(token);
        
        // Save to server if logged in
        const authToken = await getAuthToken();
        if (authToken) {
          await registerDevice(token);
        }
      }
    } catch (err) {
      console.error('Error registering for push notifications:', err);
      setError('Failed to register for push notifications');
    }
  };

  // Register the device with our backend
  const registerDevice = async (token) => {
    try {
      console.log('Registering device token with backend:', token.substring(0, 10) + '...');
      await api.post('/api/notifications/register-device', { token });
      console.log('Device token registered successfully');
    } catch (error) {
      console.error('Error registering device token:', error);
    }
  };

  // Load notification settings from AsyncStorage and server
  const loadNotificationSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Try to load from server first
      const authToken = await getAuthToken();
      if (authToken) {
        try {
          const response = await fetchNotificationSettings();
          const settings = response.preferences || DEFAULT_NOTIFICATION_SETTINGS;
          
          setNotificationSettings(settings);
          setIsNotificationsEnabled(settings.enabled);
          setNotificationFrequency(settings.frequency);
          
          return;
        } catch (err) {
          console.log('Could not load notification settings from server, falling back to local storage');
        }
      }
      
      // Fall back to AsyncStorage
      const savedEnabled = await AsyncStorage.getItem('notifications_enabled');
      const savedFrequency = await AsyncStorage.getItem('notification_frequency');
      
      setIsNotificationsEnabled(savedEnabled === 'true');
      if (savedFrequency) {
        setNotificationFrequency(savedFrequency);
      }
      
      setNotificationSettings({
        enabled: savedEnabled === 'true',
        frequency: savedFrequency || 'daily'
      });
    } catch (err) {
      console.error('Error loading notification settings:', err);
      setError('Failed to load notification settings');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch notification settings from the backend
  const fetchNotificationSettings = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/notifications/preferences');
      console.log('Fetched notification preferences:', response.data);
      setNotificationSettings(response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      // Return default settings
      return DEFAULT_NOTIFICATION_SETTINGS;
    } finally {
      setIsLoading(false);
    }
  };

  // Update notification settings (both enabled and frequency if provided)
  const updateNotificationSettings = async (settings = {}) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Merge with current settings
      const updatedSettings = {
        ...notificationSettings,
        ...settings
      };
      
      // Update state
      setNotificationSettings(updatedSettings);
      setIsNotificationsEnabled(updatedSettings.enabled);
      if (updatedSettings.frequency) {
        setNotificationFrequency(updatedSettings.frequency);
      }
      
      // Save to AsyncStorage
      await AsyncStorage.setItem('notifications_enabled', updatedSettings.enabled.toString());
      if (updatedSettings.frequency) {
        await AsyncStorage.setItem('notification_frequency', updatedSettings.frequency);
      }
      
      // Save to server if logged in
      const authToken = await getAuthToken();
      if (authToken) {
        await api.post('/api/notifications/preferences', { preferences: updatedSettings });
      }
      
      return true;
    } catch (err) {
      console.error('Error updating notification settings:', err);
      setError('Failed to update notification settings');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Enable notifications
  const enableNotifications = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      
      if (status !== 'granted') {
        setError('Permission to receive notifications was denied');
        return false;
      }
      
      await updateNotificationSettings({ enabled: true });
      return true;
    } catch (err) {
      console.error('Error enabling notifications:', err);
      setError('Failed to enable notifications');
      return false;
    }
  };

  // Disable notifications
  const disableNotifications = async () => {
    try {
      await updateNotificationSettings({ enabled: false });
      return true;
    } catch (err) {
      console.error('Error disabling notifications:', err);
      setError('Failed to disable notifications');
      return false;
    }
  };

  // Set notification frequency
  const setFrequency = async (frequency) => {
    try {
      setIsLoading(true);
      setError(null);
      
      await updateNotificationSettings({ frequency });
      return true;
    } catch (err) {
      console.error('Error setting notification frequency:', err);
      setError('Failed to set notification frequency');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Send a test notification
  const sendTestNotification = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // First check permission status
      const { status } = await Notifications.getPermissionsAsync();
      
      // If not granted, request permissions
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        
        if (newStatus !== 'granted') {
          setError('Notification permissions not granted');
          return false;
        }
      }
      
      // Don't check app settings for test notifications, instead use force enable
      // This allows test notifications to work even if the app setting isn't properly saved
      
      // Schedule test notification for 3 seconds from now with force enable
      const notificationId = await notificationService.scheduleHeadlineNotification(
        'Test Notification',
        'This is a test notification from velra',
        { type: 'test' },
        3,
        true // Force enable for test
      );
      
      const success = !!notificationId;
      
      if (success) {
        // If the test succeeds, also enable notifications in the app settings
        await updateNotificationSettings({ enabled: true });
      } else {
        setError('Notification scheduling failed');
      }
      
      return success;
    } catch (err) {
      console.error('Error sending test notification:', err);
      setError('Failed to send test notification: ' + err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Send a real news notification
  const sendNewsNotification = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // First check permission status
      const { status } = await Notifications.getPermissionsAsync();
      
      // If not granted, request permissions
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        
        if (newStatus !== 'granted') {
          setError('Notification permissions not granted');
          return false;
        }
      }
      
      // Schedule real headline notification for 3 seconds from now
      const notificationId = await notificationService.scheduleRealHeadlineNotification(3);
      
      const success = !!notificationId;
      
      if (success) {
        // If successful, also enable notifications in the app settings
        await updateNotificationSettings({ enabled: true });
      } else {
        setError('News notification scheduling failed');
      }
      
      return success;
    } catch (err) {
      console.error('Error sending news notification:', err);
      setError('Failed to send news notification: ' + err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Enable daily notifications (5 times per day by default)
  const enableDailyNotifications = async (count = 5) => {
    try {
      setIsLoading(true);
      setError(null);

      // First check permission status
      const { status } = await Notifications.getPermissionsAsync();
      
      // If not granted, request permissions
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        
        if (newStatus !== 'granted') {
          setError('Notification permissions not granted');
          return false;
        }
      }
      
      // Enable notifications in app settings
      await updateNotificationSettings({ enabled: true });
      
      // Schedule the daily notifications
      const success = await notificationService.scheduleMultipleDailyNotifications(count);
      
      if (!success) {
        setError('Failed to schedule daily notifications');
      }
      
      return success;
    } catch (err) {
      console.error('Error setting up daily notifications:', err);
      setError('Failed to set up daily notifications: ' + err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Check if app should setup daily notifications on startup
  useEffect(() => {
    const checkDailyNotificationsSetup = async () => {
      try {
        const shouldSetup = await AsyncStorage.getItem('SETUP_DAILY_NOTIFICATIONS');
        
        if (shouldSetup === 'true') {
          const count = await AsyncStorage.getItem('NOTIFICATIONS_PER_DAY');
          const notificationsPerDay = count ? parseInt(count, 10) : 5;
          
          // Setup tomorrow's notifications
          await notificationService.scheduleMultipleDailyNotifications(notificationsPerDay);
        }
      } catch (error) {
        console.error('Error checking daily notifications setup:', error);
      }
    };
    
    checkDailyNotificationsSetup();
  }, []);

  // Check notification permissions
  const checkPermissions = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (err) {
      console.error('Error checking notification permissions:', err);
      setError('Failed to check notification permissions');
      return false;
    }
  };

  // Check if notification permissions have been granted
  const checkNotificationPermissions = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setPermissionStatus(status);
      await AsyncStorage.setItem(NOTIFICATION_PERMISSION_STATUS, status);
      return status;
    } catch (error) {
      console.error('Error checking notification permissions:', error);
      return 'error';
    }
  };

  // Request notification permissions
  const requestNotificationPermissions = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setPermissionStatus(status);
      await AsyncStorage.setItem(NOTIFICATION_PERMISSION_STATUS, status);
      return status;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return 'error';
    }
  };

  // Check if this is the first time opening the app
  const checkFirstOpen = async () => {
    try {
      const firstOpenTime = await AsyncStorage.getItem(NOTIFICATION_FIRST_OPEN_TIME);
      const promptShown = await AsyncStorage.getItem(NOTIFICATION_PROMPT_SHOWN);
      
      if (!firstOpenTime) {
        // This is the first time opening the app, set the current time
        const now = Date.now();
        await AsyncStorage.setItem(NOTIFICATION_FIRST_OPEN_TIME, now.toString());
        console.log('First open time recorded:', now);
        return now;
      }
      
      if (promptShown === 'true') {
        setHasPromptBeenShown(true);
      }
      
      return parseInt(firstOpenTime);
    } catch (error) {
      console.error('Error checking first open time:', error);
      return null;
    }
  };

  // Show notification prompt after delay
  const showNotificationPromptAfterDelay = async (delayMs = 5 * 60 * 1000) => {
    try {
      // Check if prompt has already been shown
      const promptShown = await AsyncStorage.getItem(NOTIFICATION_PROMPT_SHOWN);
      if (promptShown === 'true') {
        console.log('Notification prompt has already been shown');
        return;
      }

      // Check permissions first
      const status = await checkNotificationPermissions();
      if (status === 'granted') {
        console.log('Notifications already enabled, no need to show prompt');
        return;
      }

      // Get first open time
      const firstOpenTime = await checkFirstOpen();
      if (!firstOpenTime) return;

      const now = Date.now();
      const timeSinceFirstOpen = now - firstOpenTime;

      if (timeSinceFirstOpen >= delayMs) {
        // It's been 5 minutes or more since first open, show prompt immediately
        console.log('5+ minutes since first open, showing notification prompt');
        setIsNotificationPromptVisible(true);
      } else {
        // Schedule the prompt to show after the remaining delay time
        const remainingTime = delayMs - timeSinceFirstOpen;
        console.log(`Scheduling notification prompt in ${remainingTime / 1000} seconds`);
        
        setTimeout(() => {
          // Check if the prompt has already been shown before showing it
          AsyncStorage.getItem(NOTIFICATION_PROMPT_SHOWN).then(shown => {
            if (shown !== 'true') {
              console.log('Showing scheduled notification prompt');
              setIsNotificationPromptVisible(true);
            }
          });
        }, remainingTime);
      }
    } catch (error) {
      console.error('Error showing notification prompt after delay:', error);
    }
  };

  // Mark notification prompt as shown
  const markNotificationPromptAsShown = async () => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_PROMPT_SHOWN, 'true');
      setHasPromptBeenShown(true);
      console.log('Notification prompt marked as shown');
    } catch (error) {
      console.error('Error marking notification prompt as shown:', error);
    }
  };

  // Close notification prompt
  const closeNotificationPrompt = async () => {
    setIsNotificationPromptVisible(false);
    await markNotificationPromptAsShown();
  };

  // Initialize on app start
  useEffect(() => {
    const initNotifications = async () => {
      // Check permissions
      await checkNotificationPermissions();
      
      // Start the timer for the notification prompt
      await showNotificationPromptAfterDelay();
    };

    initNotifications();
  }, []);

  // Context value
  const value = {
    isNotificationsEnabled,
    notificationFrequency,
    isLoading,
    error,
    enableNotifications,
    disableNotifications,
    setFrequency,
    sendTestNotification,
    sendNewsNotification,
    checkPermissions,
    pushToken,
    notificationSettings,
    updateNotificationSettings,
    enableDailyNotifications,
    permissionStatus,
    isNotificationPromptVisible,
    hasPromptBeenShown,
    showNotificationPrompt: () => setIsNotificationPromptVisible(true),
    closeNotificationPrompt,
    requestNotificationPermissions,
    checkNotificationPermissions,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

// Custom hook to use the notification context
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    console.warn('useNotifications must be used within a NotificationProvider, returning default values');
    return {
      isNotificationsEnabled: false,
      notificationFrequency: 'daily',
      isLoading: false,
      error: null,
      enableNotifications: () => {
        console.warn('Notification functionality unavailable');
        return false;
      },
      disableNotifications: () => {
        console.warn('Notification functionality unavailable');
        return false;
      },
      setFrequency: () => {
        console.warn('Notification functionality unavailable');
        return false;
      },
      sendTestNotification: () => {
        console.warn('Notification functionality unavailable');
        return false;
      },
      sendNewsNotification: () => {
        console.warn('Notification functionality unavailable');
        return false;
      },
      checkPermissions: () => {
        console.warn('Notification functionality unavailable');
        return false;
      },
      pushToken: null,
      notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      updateNotificationSettings: () => {
        console.warn('Notification functionality unavailable');
        return false;
      },
      enableDailyNotifications: () => {
        console.warn('Notification functionality unavailable');
        return false;
      },
      permissionStatus: null,
      isNotificationPromptVisible: false,
      hasPromptBeenShown: false,
      showNotificationPrompt: () => {
        console.warn('Notification functionality unavailable');
      },
      closeNotificationPrompt: () => {
        console.warn('Notification functionality unavailable');
      },
      requestNotificationPermissions: () => {
        console.warn('Notification functionality unavailable');
        return false;
      },
      checkNotificationPermissions: () => {
        console.warn('Notification functionality unavailable');
        return false;
      },
    };
  }
  return context;
};

export default NotificationContext; 