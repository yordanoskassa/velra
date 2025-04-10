// API Configuration
export const API_URL = 'https://decddr.onrender.com';

// App Configuration
export const APP_NAME = 'velra';
export const APP_VERSION = '2.0.0';

// Feature Flags
export const FEATURES = {
  APPLE_PAY_ENABLED: true,
  CREDIT_CARD_ENABLED: true,
  SUBSCRIPTION_ENABLED: true,
};

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'token',
  USER_DATA: 'userData',
  IS_PREMIUM: 'isPremium',
  INSIGHTS_USED: 'insightsUsed',
  RESET_DATE: 'resetDate',
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  AUTHENTICATION_ERROR: 'Authentication error. Please log in again.',
  SUBSCRIPTION_ERROR: 'Error processing subscription. Please try again later.',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  SUBSCRIPTION_CREATED: 'Subscription created successfully!',
  SUBSCRIPTION_RESTORED: 'Subscription restored successfully!',
  SUBSCRIPTION_CANCELED: 'Subscription canceled. You will have access until the end of your billing period.',
};

// Timeouts
export const TIMEOUTS = {
  API_REQUEST: 10000, // 10 seconds
  PAYMENT_PROCESSING: 30000, // 30 seconds
};

// Limits
export const LIMITS = {
  FREE_INSIGHTS_PER_MONTH: 5,
}; 