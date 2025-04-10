import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert, Linking, Modal } from 'react-native';
import { useAuth } from './AuthContext';
import CustomPaywall from '../components/CustomPaywall';
import { getApiUrl } from '../api/config';
import Constants from 'expo-constants';

// Conditionally import Purchases based on platform
let Purchases = null;
let LOG_LEVEL = {};

// Only import react-native-purchases on native platforms
if (Platform.OS !== 'web') {
  try {
    // First check if we're running in Expo Go which doesn't support native modules
    const isExpoGo = Constants?.executionEnvironment === 'storeClient' || 
                    global.expo?.modulesConstants?.executionEnvironment === 'storeClient';
    
    if (isExpoGo) {
      console.log('Running in Expo Go environment - RevenueCat native module will not be available');
    } else {
      // Add a timeout to ensure the native module is properly loaded
      setTimeout(() => {
        console.log('Attempting to load react-native-purchases module...');
      }, 100);
      
      const PurchasesModule = require('react-native-purchases');
      Purchases = PurchasesModule.default;
      LOG_LEVEL = PurchasesModule.LOG_LEVEL;
      
      console.log('Successfully loaded react-native-purchases module');
    }
  } catch (e) {
    console.error('Failed to import react-native-purchases:', e);
  }
}

// Create the Subscription Context
const SubscriptionContext = createContext({
  isSubscribed: false,
  isLoading: false,
  error: null,
  offerings: null,
  customerInfo: null,
  openPaywall: async () => {},
  restorePurchases: async () => {},
  isConfigured: false,
});

// RevenueCat Configuration
const REVENUECAT_API_KEY = Platform.select({
  ios: 'appl_YSxjNvrhUQOhYFytXDcqGfxnKWP',
  android: 'goog_VbXixkeNBSQFnDRuWejEVUDtbWw',
  default: '',
});

// RevenueCat Offering ID for "Velra Pro"
export const OFFERING_ID = 'default';

// Product IDs for your subscriptions from RevenueCat
export const SUBSCRIPTION_SKUS = Platform.select({
  ios: [
    'velra.monthly',  // Monthly subscription
    'velra.annual'    // Annual subscription
  ],
  android: [
    'velra.monthly',  // Monthly subscription
    'velra.annual'    // Annual subscription
  ],
  default: []
});

// Package identifiers - match exactly with RevenueCat dashboard
export const PACKAGE_TYPES = {
  MONTHLY: '$rc_monthly',  // Changed from 'monthly' to '$rc_monthly' to match RevenueCat dashboard
  ANNUAL: '$rc_annual'     // Changed from 'annual' to '$rc_annual' to match RevenueCat dashboard
};

// Default product display names - match exactly with RevenueCat dashboard
export const PRODUCT_DISPLAY_NAMES = {
  MONTHLY: 'Try on your favorite outfits',
  ANNUAL: 'Try on your favorite outfits (annual)'
};

// Add function to link RevenueCat user ID with the backend
const linkRevenueCatWithBackend = async (rcUserId, token) => {
  if (!rcUserId || !token) {
    console.log('Missing RevenueCat ID or token, not linking with backend');
    return false;
  }

  try {
    const response = await fetch(`${getApiUrl()}/users/link-revenuecat`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ revenuecat_id: rcUserId })
    });

    if (!response.ok) {
      console.error('Failed to link RevenueCat ID with backend:', await response.text());
      return false;
    }

    const data = await response.json();
    console.log('Successfully linked RevenueCat ID with backend:', data);
    return true;
  } catch (error) {
    console.error('Error linking RevenueCat ID with backend:', error);
    return false;
  }
};

// Verify subscription with backend
const verifySubscriptionWithBackend = async (currentToken) => {
  if (!currentToken) {
    console.log('No token provided to verifySubscriptionWithBackend');
    return false;
  }
  
  try {
    console.log('Verifying subscription with backend server');
    
    // Get current customer info from RevenueCat
    const customerInfo = await safePurchasesCall('getCustomerInfo');
    
    const hasRcActiveEntitlements = 
      customerInfo?.entitlements?.active && 
      Object.keys(customerInfo.entitlements.active).length > 0;
      
    console.log('RevenueCat active entitlements before backend check:', hasRcActiveEntitlements);
    
    // Set headers with authorization token
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentToken}`
    };
    
    // Call API endpoint that verifies the subscription
    const response = await fetch(`${getApiUrl()}/users/subscription-status`, {
      method: 'GET',
      headers
    });
    
    // Handle response
    if (response.ok) {
      const data = await response.json();
      console.log('Backend subscription verification response:', data);
      
      // Check if backend considers user subscribed
      const isUserSubscribed = data.isPremium === true;
      
      // Update subscription state according to backend response
      if (isUserSubscribed) {
        console.log('Backend confirmed user is subscribed, updating state to TRUE');
        setIsSubscribed(true);
        await AsyncStorage.setItem('cached_subscription_status', 'true');
      } else {
        console.log('Backend confirmed user is NOT subscribed, updating state to FALSE');
        // Only set to false if RevenueCat also reports no subscription
        if (!hasRcActiveEntitlements) {
          setIsSubscribed(false);
          await AsyncStorage.setItem('cached_subscription_status', 'false');
        } else {
          console.log('Warning: Backend says not subscribed but RevenueCat has entitlements');
          // Trust RevenueCat in this case
          setIsSubscribed(true);
          await AsyncStorage.setItem('cached_subscription_status', 'true');
        }
      }
      
      return isUserSubscribed;
    } else {
      // Handle error responses
      console.error('Backend verification failed with status:', response.status);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      
      // If backend verification fails, fall back to RevenueCat status
      if (hasRcActiveEntitlements) {
        console.log('Backend verification failed but RevenueCat has active entitlements');
        setIsSubscribed(true);
        await AsyncStorage.setItem('cached_subscription_status', 'true');
        return true;
      }
      
      return false;
    }
  } catch (error) {
    console.error('Error in verifySubscriptionWithBackend:', error);
    
    // If backend verification throws, check if RevenueCat reports subscription
    try {
      const customerInfo = await safePurchasesCall('getCustomerInfo');
      const hasRcActiveEntitlements = 
        customerInfo?.entitlements?.active && 
        Object.keys(customerInfo.entitlements.active).length > 0;
        
      if (hasRcActiveEntitlements) {
        console.log('Backend error but RevenueCat has active entitlements');
        setIsSubscribed(true);
        await AsyncStorage.setItem('cached_subscription_status', 'true');
        return true;
      }
    } catch (rcError) {
      console.error('Error also checking RevenueCat as fallback:', rcError);
    }
    
    return false;
  }
};

// Helper function to safely call Purchases methods
const safePurchasesCall = async (methodName, ...args) => {
  // Check if running in Expo Go or web
  const isExpoGo = Platform.OS !== 'web' && (
    Constants?.executionEnvironment === 'storeClient' || 
    global.expo?.modulesConstants?.executionEnvironment === 'storeClient'
  );
  
  if (Platform.OS === 'web' || isExpoGo) {
    console.log(`Skipping ${methodName} call on ${isExpoGo ? 'Expo Go' : 'web'} platform`);
    return null;
  }
  
  // Max retries for native module calls
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    // Check if Purchases module is available
    if (!Purchases) {
      console.error(`Cannot call ${methodName}: Purchases module is not available`);
      
      // Try to reload the module
      try {
        const PurchasesModule = require('react-native-purchases');
        Purchases = PurchasesModule.default;
        LOG_LEVEL = PurchasesModule.LOG_LEVEL;
        console.log('Successfully reloaded react-native-purchases module on retry');
      } catch (reloadError) {
        console.error('Failed to reload Purchases module:', reloadError);
        retryCount++;
        
        if (retryCount >= maxRetries) {
          return null;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
    }
  
    if (typeof Purchases[methodName] !== 'function') {
      console.error(`Method ${methodName} is not available on Purchases`);
      return null;
    }
    
    try {
      return await Purchases[methodName](...args);
    } catch (error) {
      console.error(`Error calling ${methodName}:`, error);
      retryCount++;
      
      if (retryCount >= maxRetries) {
        throw error;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
};

// Subscription Provider component
export const SubscriptionProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [offerings, setOfferings] = useState(null);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [productPrices, setProductPrices] = useState({
    monthly: '$9.99',
    annual: '$99.99',
  });
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);

  // Restore actual subscription check functionality
  const forceRefreshSubscriptionStatus = async () => {
    console.log('Refreshing subscription status');
    
    // Skip most checks on web platform
    if (Platform.OS === 'web') {
      console.log('Running on web platform, subscription services not available');
      // For web, we could implement a different mechanism or just use a mock
      return false;
    }
    
    // Try to get subscription status from backend
    if (token) {
      const backendStatus = await verifySubscriptionWithBackend(token);
      if (backendStatus !== null) {
        console.log('Backend subscription status:', backendStatus);
        setIsSubscribed(backendStatus);
        await AsyncStorage.setItem('cached_subscription_status', backendStatus.toString());
        return backendStatus;
      }
    }
    
    // If backend check fails, try RevenueCat as fallback
    try {
      const customerInfo = await safePurchasesCall('getCustomerInfo');
      if (customerInfo) {
        const hasActiveEntitlements = 
          customerInfo?.entitlements?.active && 
          Object.keys(customerInfo.entitlements.active).length > 0;
        
        console.log('RevenueCat subscription status:', hasActiveEntitlements);
        setIsSubscribed(hasActiveEntitlements);
        await AsyncStorage.setItem('cached_subscription_status', hasActiveEntitlements.toString());
        return hasActiveEntitlements;
      }
    } catch (rcError) {
      console.error('Error checking RevenueCat for subscription:', rcError);
    }
    
    // If all checks fail, assume not subscribed
    setIsSubscribed(false);
    await AsyncStorage.setItem('cached_subscription_status', 'false');
    return false;
  };

  // Add debug logging
  useEffect(() => {
    console.log('SubscriptionProvider - Debug Info:');
    console.log('User:', user ? 'Logged in' : 'Not logged in');
    console.log('isSubscribed:', isSubscribed);
    console.log('isConfigured:', isConfigured);
    console.log('API Key:', REVENUECAT_API_KEY ? 'Set' : 'Not set');
    console.log('Product IDs:', SUBSCRIPTION_SKUS);
    console.log('Offering ID:', OFFERING_ID);
  }, [user, isSubscribed, isConfigured]);

  // Initialize RevenueCat
  useEffect(() => {
    const setupPurchases = async () => {
      try {
        setIsLoading(true);
        console.log('Starting RevenueCat setup process...');
        
        // Skip RevenueCat setup on web platform or Expo Go
        if (Platform.OS === 'web' || Constants?.executionEnvironment === 'storeClient') {
          console.log('Skipping RevenueCat setup on web platform or Expo Go');
          setIsLoading(false);
          setIsCheckingSubscription(false);
          return;
        }
        
        // Always try to configure in development mode or if not already configured
        if (__DEV__ || !isConfigured) {
          console.log('Configuring RevenueCat...');
          
          if (__DEV__) {
            // Enable debug logs in development
            console.log('Debug logging enabled for RevenueCat');
            await safePurchasesCall('setLogLevel', LOG_LEVEL.DEBUG);
          }
          
          // User ID for RevenueCat - use anonymous if no user logged in
          const userId = user ? user._id : 'anonymous_user';
          console.log('Using user ID for RevenueCat:', userId);
          
          try {
            // Using the correct configuration method
            await safePurchasesCall('configure', {
              apiKey: REVENUECAT_API_KEY,
              appUserID: userId,
              observerMode: false
            });
            
            console.log('RevenueCat configured successfully');
            setIsConfigured(true);
            
            // Get offerings after configuration - only try once
            console.log('Fetching offerings...');
            try {
              const offeringsData = await safePurchasesCall('getOfferings');
              console.log('RevenueCat offerings retrieved successfully');
              
              if (offeringsData) {
                console.log('RevenueCat offerings:', JSON.stringify(offeringsData, null, 2));
                setOfferings(offeringsData);
                
                // Update product prices from offerings
                const packages = offeringsData.current.availablePackages;
                console.log('Available packages:', JSON.stringify(packages, null, 2));
                
                const newPrices = { ...productPrices };
                
                packages.forEach(pkg => {
                  console.log('Processing package:', pkg.identifier);
                  if (pkg.identifier === 'monthly') {
                    newPrices.monthly = pkg.product.priceString;
                    console.log('Monthly price:', pkg.product.priceString);
                  } else if (pkg.identifier === 'annual') {
                    newPrices.annual = pkg.product.priceString;
                    console.log('Annual price:', pkg.product.priceString);
                  }
                });
                
                setProductPrices(newPrices);
              }
            } catch (offeringsError) {
              console.error('Error getting offerings:', offeringsError);
            }
          } catch (configError) {
            console.error('Error configuring RevenueCat:', configError);
            console.error('Error details:', configError.message, configError.stack);
            setError(configError);
          }
        }
        
        // Fetch Customer Info
        try {
          if (Platform.OS !== 'web') {
            const purchaserInfo = await safePurchasesCall('getCustomerInfo');
            setCustomerInfo(purchaserInfo);
            console.log('Fetched customer info successfully:', purchaserInfo);
          }
        } catch (customerInfoError) {
          console.error('Error getting RevenueCat customer info:', customerInfoError);
        }
        
        // Check subscription status
        await checkSubscriptionStatus();
        
      } catch (error) {
        console.error('Error in setupPurchases:', error);
        setError(error);
      } finally {
        setIsLoading(false);
        setIsCheckingSubscription(false);
      }
    };
    
    // Delay the setup slightly to ensure React Native is fully initialized
    const timer = setTimeout(() => {
      setupPurchases();
    }, 500);
    
    return () => clearTimeout(timer);
  }, [user, token, isConfigured]);
  
  // Check subscription status on mount and token change
  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      try {
        console.log('Checking subscription status on app load or token change');
        
        // First, try to get cached status for immediate UI response
        const cachedStatus = await AsyncStorage.getItem('cached_subscription_status');
        if (cachedStatus === 'true') {
          console.log('Setting subscription to TRUE from cached value');
          setIsSubscribed(true);
        } else if (cachedStatus === 'false') {
          console.log('Setting subscription to FALSE from cached value');
          setIsSubscribed(false);
        }
        
        // Skip RevenueCat check on web
        if (Platform.OS === 'web') {
          console.log('Skipping RevenueCat check on web platform');
          setIsCheckingSubscription(false);
          return;
        }
        
        // Next, check customer info from RevenueCat (works even if not logged in)
        try {
          const customerInfo = await safePurchasesCall('getCustomerInfo');
          if (customerInfo) {
            setCustomerInfo(customerInfo);
            
            const hasActiveEntitlements = 
              customerInfo?.entitlements?.active && 
              Object.keys(customerInfo.entitlements.active).length > 0;
            
            console.log('RevenueCat reports active entitlements on startup:', hasActiveEntitlements);
            
            if (hasActiveEntitlements) {
              console.log('Setting subscription to TRUE based on RevenueCat entitlements');
              setIsSubscribed(true);
              await AsyncStorage.setItem('cached_subscription_status', 'true');
            }
          }
        } catch (rcError) {
          console.error('Error getting RevenueCat customer info:', rcError);
        }
        
        // Finally, verify with backend if user is logged in (most authoritative)
        if (token) {
          console.log('User is logged in, verifying subscription with backend');
          await forceRefreshSubscriptionStatus();
        } else {
          console.log('User is not logged in, skipping backend verification');
        }
        
        setIsCheckingSubscription(false);
      } catch (error) {
        console.error('Error in checkSubscriptionStatus:', error);
        setIsCheckingSubscription(false);
      }
    };

    checkSubscriptionStatus();
  }, [token]);

  // Get product prices when offerings change
  useEffect(() => {
    if (offerings && offerings.current) {
      try {
        const monthlyPackage = offerings.current.availablePackages.find(pkg => 
          pkg.identifier === 'monthly' || pkg.identifier.includes('month'));
          
        const annualPackage = offerings.current.availablePackages.find(pkg => 
          pkg.identifier === 'annual' || pkg.identifier.includes('year') || pkg.identifier.includes('annual'));
        
        const prices = {};
        
        if (monthlyPackage) {
          prices.monthly = monthlyPackage.product.priceString;
        }
        
        if (annualPackage) {
          prices.annual = annualPackage.product.priceString;
        }
        
        if (Object.keys(prices).length > 0) {
          setProductPrices(prevPrices => ({
            ...prevPrices,
            ...prices
          }));
          console.log('Updated product prices:', prices);
        }
      } catch (error) {
        console.error('Error extracting prices from offerings:', error);
      }
    }
  }, [offerings]);
  
  // TEMPORARY: Override subscription check for testing
  const checkSubscriptionStatus = async (info = null) => {
    console.log('Checking subscription status');
    try {
      setIsCheckingSubscription(true);
      
      // If customerInfo was passed, use it directly
      if (info) {
        console.log('Using provided customer info to check subscription status');
        const hasActiveEntitlements = 
          info?.entitlements?.active && 
          Object.keys(info.entitlements.active).length > 0;
        
        console.log('Customer has active entitlements:', hasActiveEntitlements);
        setIsSubscribed(hasActiveEntitlements);
        await AsyncStorage.setItem('cached_subscription_status', hasActiveEntitlements.toString());
        setIsCheckingSubscription(false);
        return hasActiveEntitlements;
      }
      
      // Otherwise refresh from backend and RevenueCat
      const status = await forceRefreshSubscriptionStatus();
      setIsCheckingSubscription(false);
      return status;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      setIsCheckingSubscription(false);
      return false;
    }
  };

  // Open paywall using RevenueCat Paywall UI
  const openPaywall = async () => {
    try {
      setIsLoading(true);
      console.log('Opening paywall...');
      
      // First check if we already have a current offering
      let currentOffering = offerings?.current;
      console.log('Current offering from state:', currentOffering?.identifier || 'none');
      
      // If no current offering, try to fetch it
      if (!currentOffering) {
        try {
          console.log('No current offering found, fetching offerings...');
          const fetchedOfferings = await safePurchasesCall('getOfferings');
          console.log('Fetched offerings:', fetchedOfferings);
          
          if (fetchedOfferings?.current) {
            console.log('Got current offering:', fetchedOfferings.current.identifier);
            setOfferings(fetchedOfferings);
            currentOffering = fetchedOfferings.current;
          } else {
            console.warn('No offerings available from RevenueCat');
            // Even with no offerings, we'll show our custom paywall as fallback
          }
        } catch (offeringsError) {
          console.error('Error fetching offerings:', offeringsError);
        }
      }
      
      // On web platform, always use custom paywall
      if (Platform.OS === 'web') {
        console.log('Running on web platform, using custom paywall');
        setShowPaywall(true);
        return;
      }
      
      // Try to use the PaywallUI if available
      console.log('Attempting to use PaywallUI.present()...');
      
      // Check if PaywallUI is available
      let PaywallUI;
      if (Platform.OS !== 'web' && Purchases) {
        try {
          PaywallUI = require('react-native-purchases-ui').PaywallUI;
        } catch (e) {
          console.error('Failed to import PaywallUI:', e);
        }
      }
      
      if (PaywallUI && typeof PaywallUI.present === 'function') {
        try {
          const result = await PaywallUI.present({
            offering: OFFERING_ID,
          });
          console.log('PaywallUI presented successfully:', result);
          
          // Check if the user purchased something
          if (result.purchasedProduct) {
            console.log('User purchased product:', result.purchasedProduct);
            await checkSubscriptionStatus();
          }
          
          return;
        } catch (uiError) {
          // If we get here, the UI failed to present
          console.log('PaywallUI.present is not available, falling back to direct purchase');
          console.error('Error using PaywallUI:', uiError);
          // Fall back to custom paywall
        }
      } else {
        console.log('PaywallUI not available, using custom paywall');
      }
      
      // Fallback: Show our custom paywall implementation
      console.log('Falling back to custom paywall');
      setShowPaywall(true);
      
    } catch (error) {
      console.error('Error in openPaywall:', error);
      setError(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Restore purchases
  const restorePurchases = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Skip on web platform
      if (Platform.OS === 'web') {
        console.log('Restore purchases not available on web platform');
        Alert.alert('Not Available', 'Restore purchases is not available on this platform.');
        setIsLoading(false);
        return false;
      }
      
      // Check if RevenueCat is configured
      if (!isConfigured) {
        try {
          console.log('Configuring RevenueCat before restoring purchases...');
          const userId = user?.id || 'anonymous_user';
          
          // Try to configure RevenueCat
          await safePurchasesCall('configure', {
            apiKey: REVENUECAT_API_KEY,
            logLevel: __DEV__ ? 'DEBUG' : 'WARN',
            appUserID: userId,
            observerMode: false
          });
          console.log('RevenueCat configured successfully for restore');
          setIsConfigured(true);
        } catch (configError) {
          console.error('Failed to configure RevenueCat before restoring:', configError);
          Alert.alert('Configuration Error', 'Unable to initialize subscription services. Please check your internet connection and try again.');
          setIsLoading(false);
          return false;
        }
      }
      
      // Restore purchases from RevenueCat
      let customerInfo;
      try {
        console.log('Restoring purchases...');
        
        // Check if app is on a real device (not simulator)
        if (Platform.OS === 'ios' && !__DEV__) {
          customerInfo = await safePurchasesCall('restorePurchases');
        } else {
          // Special handling for simulator in development
          console.log('Running in development mode or simulator, using mock restore');
          customerInfo = { entitlements: { active: {} } };
        }
        
        console.log('Restore completed, customer info:', customerInfo);
      } catch (restoreError) {
        console.error('Error in Purchases.restorePurchases():', restoreError);
        console.error('Error code:', restoreError.code);
        console.error('Error message:', restoreError.message);
        
        if (restoreError.message && restoreError.message.includes('not connected to internet')) {
          Alert.alert('Network Error', 'Please check your internet connection and try again.');
        } else if (Platform.OS === 'ios' && restoreError.code === 'NOT_IMPLEMENTED') {
          Alert.alert('Device Error', 'Restore purchases is not available on this device. This may be because you are using a simulator.');
        } else {
          Alert.alert('Restore Failed', 'Failed to restore purchases. Please try again later.');
        }
        
        setError('Failed to restore purchases. Please try again.');
        setIsLoading(false);
        return false;
      }
      
      // Check if restore was successful
      try {
        const hasActiveSubscription = await checkSubscriptionStatus(customerInfo);
        
        if (hasActiveSubscription) {
          Alert.alert('Success', 'Your subscription has been restored!');
        } else {
          Alert.alert('No Subscription Found', 'We couldn\'t find an active subscription linked to your account.');
        }
        
        return hasActiveSubscription;
      } catch (checkError) {
        console.error('Error checking subscription status after restore:', checkError);
        Alert.alert('Verification Error', 'We restored your purchases but couldn\'t verify your subscription status. Please try again later.');
        return false;
      }
    } catch (err) {
      console.error('Unexpected error in restorePurchases:', err);
      setError('Failed to restore purchases. Please try again.');
      Alert.alert('Error', 'An unexpected error occurred. Please try again later.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Add this new method for direct purchase
  const purchaseDirectly = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Ensure RevenueCat is configured
      if (!isConfigured) {
        try {
          console.log('Configuring RevenueCat before direct purchase...');
          const userId = user?.id || 'anonymous_user';
          
          // Configure Purchases first
          await safePurchasesCall('configure', {
            apiKey: REVENUECAT_API_KEY,
            appUserID: userId,
            observerMode: false
          });
          
          // Then set log level separately
          if (__DEV__) {
            await safePurchasesCall('setLogLevel', LOG_LEVEL.DEBUG);
          }
          
          setIsConfigured(true);
          console.log('RevenueCat configured successfully for direct purchase');
        } catch (configError) {
          console.error('Failed to configure RevenueCat:', configError);
          Alert.alert('Error', 'Subscription services are currently unavailable. Please try again later.');
          setIsLoading(false);
          return false;
        }
      }
      
      // Get products directly by ID
      console.log('Attempting direct product purchase...');
      const productIds = SUBSCRIPTION_SKUS;
      console.log('Fetching products with IDs:', productIds);
      
      // Get products directly
      const products = await safePurchasesCall('getProducts', productIds);
      console.log('Products retrieved:', JSON.stringify(products));
      
      if (products && products.length > 0) {
        // Display a custom alert to let the user choose a subscription
        return new Promise((resolve) => {
          Alert.alert(
            'Choose a Subscription',
            'Select your preferred subscription plan:',
            [
              ...products.map(product => ({
                text: `${product.title} - ${product.priceString}`,
                onPress: async () => {
                  try {
                    console.log(`Selected product: ${product.identifier}`);
                    const purchaseResult = await safePurchasesCall('purchaseProduct', product.identifier);
                    console.log('Purchase result:', JSON.stringify(purchaseResult));
                    
                    // Check if purchase was successful
                    const success = await checkSubscriptionStatus(purchaseResult.customerInfo);
                    if (success) {
                      Alert.alert('Success', 'Thank you for subscribing to Premium!');
                    }
                    resolve(success);
                  } catch (purchaseError) {
                    console.error('Error purchasing product:', purchaseError);
                    Alert.alert('Purchase Failed', purchaseError.message || 'There was an error processing your purchase.');
                    resolve(false);
                  }
                }
              })),
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => resolve(false)
              }
            ]
          );
        });
      } else {
        console.error('No products available for purchase');
        setError('No subscription products available. Please try again later.');
        return false;
      }
    } catch (err) {
      console.error('Error in direct purchase flow:', err);
      setError('Failed to process subscription. Please try again later.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Add a method to redirect to login when needed
  const redirectToLogin = (navigation, options = {}) => {
    if (!navigation) {
      console.warn('Cannot redirect to login: navigation object not provided');
      return false;
    }
    
    // Default options
    const defaultOptions = {
      message: 'Please log in to access premium features',
      redirectAfterLogin: true,
      redirectRoute: 'Home'
    };
    
    // Merge options
    const mergedOptions = { ...defaultOptions, ...options };
    
    navigation.navigate('Login', mergedOptions);
    return true;
  };

  // Add a method to show our custom paywall
  const showCustomPaywall = async (navigation) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Check if user is logged in first - redirect to login if not
      if (!user) {
        setIsLoading(false);
        console.log('User not logged in, need to redirect to login page');
        
        // If navigation was passed, use it to navigate to login
        if (navigation) {
          return redirectToLogin(navigation, {
            message: 'Please log in to subscribe to premium features',
            redirectAfterLogin: true,
            redirectRoute: 'BackToSource'
          });
        } else {
          console.warn('Navigation not available for redirect to login');
          // Can't redirect, but signal the caller that login is required
          return { loginRequired: true };
        }
      }
      
      // Make sure RevenueCat is configured
      if (!isConfigured) {
        try {
          console.log('Configuring RevenueCat before showing custom paywall...');
          const userId = user?.id || 'anonymous_user';
          
          // Enable more detailed logs through configure parameter
          
          await safePurchasesCall('configure', {
            apiKey: REVENUECAT_API_KEY,
            appUserID: userId,
            observerMode: false
          });
          setIsConfigured(true);
          console.log('RevenueCat configured successfully');
        } catch (configError) {
          console.error('Failed to configure RevenueCat before showing paywall:', configError);
          Alert.alert('Error', 'Subscription services are currently unavailable. Please try again later.');
          setIsLoading(false);
          return false;
        }
      }
      
      // Make sure we have product information
      try {
        console.log('Fetching offerings...');
        const fetchedOfferings = await safePurchasesCall('getOfferings');
        console.log('Offerings before showing paywall:', JSON.stringify(fetchedOfferings));
        setOfferings(fetchedOfferings);
      } catch (offeringsError) {
        console.error('Error fetching offerings:', offeringsError);
        // Continue anyway, we'll use default prices
      }
      
      // Show the custom paywall
      setShowPaywall(true);
      setIsLoading(false);
      
      return true;
    } catch (err) {
      console.error('Error showing custom paywall:', err);
      setError('Failed to show subscription options. Please try again.');
      setIsLoading(false);
      return false;
    }
  };
  
  // Handle purchase from custom paywall
  const handlePurchaseMonthly = async () => {
    try {
      setIsLoading(true);
      console.log('Starting monthly purchase...');
      
      // Get the current offering
      let offeringToUse = offerings?.current;
      if (!offeringToUse) {
        console.log('No current offering found, fetching offerings...');
        const fetchedOfferings = await safePurchasesCall('getOfferings');
        if (fetchedOfferings?.current) {
          offeringToUse = fetchedOfferings.current;
          setOfferings(fetchedOfferings);
        }
      }
      
      console.log('Current offering:', offeringToUse);
      
      // Find the monthly package
      const monthlyPackage = offeringToUse?.availablePackages?.find(
        pkg => pkg.identifier === PACKAGE_TYPES.MONTHLY
      );
      
      console.log('Found monthly package:', monthlyPackage);
      
      if (!monthlyPackage) {
        throw new Error('Monthly subscription package is not available');
      }
      
      // Make the purchase
      console.log('Attempting to purchase monthly package...');
      const purchaseResult = await safePurchasesCall('purchasePackage', monthlyPackage);
      console.log('Purchase result:', purchaseResult);
      
      // Check if the purchase was successful
      const hasActiveEntitlements = 
        purchaseResult?.customerInfo?.entitlements?.active && 
        Object.keys(purchaseResult.customerInfo.entitlements.active).length > 0;
      
      console.log('Has active entitlements:', hasActiveEntitlements);
      
      // Update state based on purchase result
      setCustomerInfo(purchaseResult.customerInfo);
      
      if (hasActiveEntitlements) {
        setIsSubscribed(true);
        await AsyncStorage.setItem('cached_subscription_status', 'true');
        setShowPaywall(false);
        Alert.alert('Success', 'Thank you for subscribing to Velra Pro!');
        return true;
      } else {
        console.warn('Purchase completed but no active entitlements found');
        return false;
      }
    } catch (error) {
      console.error('Error purchasing monthly subscription:', error);
      Alert.alert(
        'Purchase Failed', 
        error.message || 'There was an error processing your purchase. Please try again.'
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle annual purchase from custom paywall
  const handlePurchaseAnnual = async () => {
    try {
      setIsLoading(true);
      console.log('Starting annual purchase...');
      
      // Get the current offering
      let offeringToUse = offerings?.current;
      if (!offeringToUse) {
        console.log('No current offering found, fetching offerings...');
        const fetchedOfferings = await safePurchasesCall('getOfferings');
        if (fetchedOfferings?.current) {
          offeringToUse = fetchedOfferings.current;
          setOfferings(fetchedOfferings);
        }
      }
      
      console.log('Current offering:', offeringToUse);
      
      // Find the annual package
      const annualPackage = offeringToUse?.availablePackages?.find(
        pkg => pkg.identifier === PACKAGE_TYPES.ANNUAL
      );
      
      console.log('Found annual package:', annualPackage);
      
      if (!annualPackage) {
        throw new Error('Annual subscription package is not available');
      }
      
      // Make the purchase
      console.log('Attempting to purchase annual package...');
      const purchaseResult = await safePurchasesCall('purchasePackage', annualPackage);
      console.log('Purchase result:', purchaseResult);
      
      // Check if the purchase was successful
      const hasActiveEntitlements = 
        purchaseResult?.customerInfo?.entitlements?.active && 
        Object.keys(purchaseResult.customerInfo.entitlements.active).length > 0;
      
      console.log('Has active entitlements:', hasActiveEntitlements);
      
      // Update state based on purchase result
      setCustomerInfo(purchaseResult.customerInfo);
      
      if (hasActiveEntitlements) {
        setIsSubscribed(true);
        await AsyncStorage.setItem('cached_subscription_status', 'true');
        setShowPaywall(false);
        Alert.alert('Success', 'Thank you for subscribing to Velra Pro!');
        return true;
      } else {
        console.warn('Purchase completed but no active entitlements found');
        return false;
      }
    } catch (error) {
      console.error('Error purchasing annual subscription:', error);
      Alert.alert(
        'Purchase Failed', 
        error.message || 'There was an error processing your purchase. Please try again.'
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Add a method to manually set subscription status for testing
  const setManualSubscriptionStatus = async (status) => {
    try {
      setIsLoading(true);
      console.log('Manually setting subscription status for testing:', status);
      
      // Store in AsyncStorage
      await AsyncStorage.setItem('debug_subscription_status', status ? 'true' : 'false');
      
      // Update state
      setIsSubscribed(status);
      
      return true;
    } catch (err) {
      console.error('Error setting manual subscription status:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Create value object with all subscription-related functions
  const value = {
    isSubscribed,
    isLoading,
    error,
    offerings,
    customerInfo,
    isConfigured,
    productPrices,
    openPaywall,
    showCustomPaywall: async (navigation) => {
      return await showCustomPaywall(navigation);
    },
    redirectToLogin,
    restorePurchases,
    purchaseDirectly,
    forceRefreshSubscriptionStatus,
    forceResetSubscription: async () => {
      try {
        setIsLoading(true);
        console.log('Forcibly resetting subscription state...');
        
        // 1. Clear all local storage related to subscriptions
        await AsyncStorage.removeItem('customerInfo');
        await AsyncStorage.removeItem('isSubscribed');
        await AsyncStorage.removeItem('purchases_data');
        
        // 2. Reset local state
        setIsSubscribed(false);
        setCustomerInfo(null);
        
        // 3. Reset RevenueCat cache if configured
        if (isConfigured) {
          try {
            // Invalidate cache
            await safePurchasesCall('invalidateCustomerInfoCache');
            console.log('RevenueCat cache invalidated');
            
            // Reset RevenueCat user (this is a more aggressive approach)
            const anonymousId = 'anonymous_' + Date.now();
            await safePurchasesCall('logOut');
            await safePurchasesCall('configure', {
              apiKey: REVENUECAT_API_KEY,
              appUserID: anonymousId,
              observerMode: false
            });
            
            console.log('RevenueCat reset with anonymous ID:', anonymousId);
            setIsConfigured(true);
            
            Alert.alert('Subscription Reset', 'Your subscription status has been reset to non-subscribed.');
            return true;
          } catch (error) {
            console.error('Error resetting RevenueCat:', error);
            Alert.alert('Error', 'Failed to reset subscription completely. Try reinstalling the app.');
            return false;
          }
        } else {
          setIsConfigured(false);
          Alert.alert('Subscription Reset', 'Your subscription status has been reset to non-subscribed.');
          return true;
        }
      } catch (err) {
        console.error('Error in forceResetSubscription:', err);
        Alert.alert('Error', 'Failed to reset subscription state. Try reinstalling the app.');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    cancelSubscription: async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // First make sure RevenueCat is configured
        if (!isConfigured) {
          try {
            console.log('Configuring RevenueCat before canceling subscription...');
            const userId = user?.id || 'anonymous_user';
            await safePurchasesCall('configure', {
              apiKey: REVENUECAT_API_KEY,
              appUserID: userId,
              observerMode: false
            });
            setIsConfigured(true);
          } catch (configError) {
            console.error('Failed to configure RevenueCat before canceling:', configError);
            Alert.alert('Error', 'Subscription services are currently unavailable. Please try again later.');
            return false;
          }
        }
        
        // Get current customer info
        const info = await safePurchasesCall('getCustomerInfo');
        console.log('Customer info before cancellation:', JSON.stringify(info));
        
        if (!info || !info.activeSubscriptions || info.activeSubscriptions.length === 0) {
          Alert.alert('No Active Subscription', 'You don\'t have any active subscriptions to cancel.');
          return false;
        }
        
        // On iOS, direct users to App Store subscription management
        if (Platform.OS === 'ios') {
          Alert.alert(
            'Manage Subscription',
            'To cancel your subscription, you\'ll need to manage it through your Apple ID settings.',
            [
              {
                text: 'Cancel',
                style: 'cancel'
              },
              {
                text: 'Open Settings',
                onPress: () => {
                  // Open iOS subscription management
                  Linking.openURL('https://apps.apple.com/account/subscriptions');
                }
              }
            ]
          );
          return true;
        } 
        // Future Android implementation would go here
        else {
          Alert.alert(
            'Manage Subscription',
            'To cancel your subscription, you\'ll need to manage it through the Google Play Store.',
            [
              {
                text: 'Cancel',
                style: 'cancel'
              },
              {
                text: 'Open Play Store',
                onPress: () => {
                  // Open Play Store subscription management
                  Linking.openURL('https://play.google.com/store/account/subscriptions');
                }
              }
            ]
          );
          return true;
        }
      } catch (err) {
        console.error('Error in cancelSubscription:', err);
        setError('Failed to process subscription cancellation. Please try again.');
        Alert.alert('Error', 'Failed to process your request. Please try again later.');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    setManualSubscriptionStatus,
    verifyWithBackend: async () => {
      if (user && token) {
        const backendStatus = await verifySubscriptionWithBackend(token);
        if (backendStatus !== null) {
          setIsSubscribed(backendStatus);
          return backendStatus;
        }
      }
      return null;
    }
  };

  return <SubscriptionContext.Provider value={value}>
    {showPaywall && (
      <Modal
        animationType="slide"
        transparent={true}
        visible={showPaywall}
        onRequestClose={() => setShowPaywall(false)}
      >
        <CustomPaywall 
          onClose={() => setShowPaywall(false)}
          onPurchaseMonthly={handlePurchaseMonthly}
          onPurchaseAnnual={handlePurchaseAnnual}
          isLoading={isLoading}
          monthlyPrice={productPrices.monthly}
          annualPrice={productPrices.annual}
        />
      </Modal>
    )}
    {children}
  </SubscriptionContext.Provider>;
};

// Custom hook to use the subscription context
export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export default SubscriptionContext;

