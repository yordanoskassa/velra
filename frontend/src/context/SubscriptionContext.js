import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert, Linking, Modal } from 'react-native';

// Create a mock implementation of Purchases for web
const createMockPurchases = () => ({
  configure: async () => console.log('Mock Purchases.configure called'),
  getOfferings: async () => ({ current: null }),
  getCustomerInfo: async () => ({ entitlements: { active: {} } }),
  addCustomerInfoUpdateListener: () => ({ remove: () => {} }),
  logIn: async () => ({ customerInfo: { entitlements: { active: {} } } }),
  setLogLevel: () => {},
  setSimulatesAskToBuyInSandbox: async () => {},
  getAppUserID: async () => 'mock-user-id',
  restorePurchases: async () => ({ customerInfo: { entitlements: { active: {} } } }),
  LOG_LEVEL: { DEBUG: 0 }
});

// Conditionally import Purchases based on platform
const Purchases = Platform.OS === 'web' ? createMockPurchases() : require('react-native-purchases').default;

// Only import PaywallUI if not on web
import { useAuth } from './AuthContext';
import CustomPaywall from '../components/CustomPaywall';
import { getApiUrl } from '../api/config';

// Conditionally import PaywallUI to avoid web platform issues
const PaywallUI = Platform.OS === 'web' ? null : require('react-native-purchases-ui').PaywallUI;

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

// Your RevenueCat API key
const REVENUECAT_API_KEY = Platform.select({
  ios: 'appl_VbXixkeNBSQFnDRuWejEVUDtbWw', // Your iOS API key
  android: 'YOUR_ANDROID_API_KEY', // Your Android API key (for future use)
  default: '',
});

// Product IDs for your subscriptions from RevenueCat
export const SUBSCRIPTION_SKUS = Platform.select({
  ios: [
    'com.decodr.monthlysub',  // Monthly subscription - match your RevenueCat product IDs exactly
    'com.decodr.annual'       // Yearly subscription - match your RevenueCat product IDs exactly
  ],
  android: [
    'com.decodr.monthlysub',
    'com.decodr.annual'
  ],
  default: []
});

// RevenueCat Offering IDs
const OFFERING_ID = 'ofrngc4d412681a'; // Your specific offering ID from RevenueCat dashboard

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
    
    // Get current customer info from RevenueCat to send to backend
    const customerInfo = await Purchases.getCustomerInfo();
    
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
    const response = await fetch(`${getApiUrl()}/subscriptions/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        // Send RevenueCat data to help backend verify
        hasRcActiveEntitlements,
        customerInfo: customerInfo,
      })
    });
    
    // Handle response
    if (response.ok) {
      const data = await response.json();
      console.log('Backend subscription verification response:', data);
      
      // Check if backend considers user subscribed
      const isUserSubscribed = data.isSubscribed === true;
      
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
      const customerInfo = await Purchases.getCustomerInfo();
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
    monthly: '$4.99',
    annual: '$39.99',
  });
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);

  // Function to force refresh subscription status from both backend and RevenueCat
  const forceRefreshSubscriptionStatus = async () => {
    console.log('Forcing refresh of subscription status');
    
    try {
      // Clear cached status first
      await AsyncStorage.removeItem('cached_subscription_status');
      
      // If there's no token (user not logged in), just try RevenueCat
      if (!token) {
        console.log('No authentication token, checking only RevenueCat');
        try {
          // Get customer info from RevenueCat
          const customerInfo = await Purchases.getCustomerInfo();
          console.log('RC Customer info:', JSON.stringify(customerInfo?.entitlements));
          
          const hasActiveEntitlements = 
            customerInfo?.entitlements?.active && 
            Object.keys(customerInfo.entitlements.active).length > 0;
          
          console.log('RevenueCat reports active entitlements:', hasActiveEntitlements);
          
          if (hasActiveEntitlements) {
            console.log('Setting subscribed state to TRUE based on RC entitlements');
            setIsSubscribed(true);
            await AsyncStorage.setItem('cached_subscription_status', 'true');
            // Update UI
            setCustomerInfo(customerInfo);
            return true;
          } else {
            console.log('No active entitlements found in RevenueCat, setting subscribed state to FALSE');
            setIsSubscribed(false);
            await AsyncStorage.setItem('cached_subscription_status', 'false');
            return false;
          }
        } catch (rcError) {
          console.error('Error fetching customer info from RevenueCat:', rcError);
          return false;
        }
      }
      
      // Both verify with RevenueCat and backend if user is logged in
      console.log('Verifying subscription status with backend using token');
      const result = await verifySubscriptionWithBackend(token);
      
      // Make sure UI reflects subscription status
      if (result) {
        console.log('Backend verification successful, setting subscribed state to TRUE');
        setIsSubscribed(true);
        await AsyncStorage.setItem('cached_subscription_status', 'true');
      } else {
        console.log('Backend verification failed, setting subscribed state to FALSE');
        setIsSubscribed(false);
        await AsyncStorage.setItem('cached_subscription_status', 'false');
      }
      
      return result;
    } catch (error) {
      console.error('Error in forceRefreshSubscriptionStatus:', error);
      return false;
    }
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
        
        // Always try to configure in development mode or if not already configured
        if (__DEV__ || !isConfigured) {
          console.log('Configuring RevenueCat...');
          
          // Enable more detailed logs in development
          if (__DEV__) {
            Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
            console.log('Debug logging enabled for RevenueCat');
            
            // Enable StoreKit configuration mode in development
            console.log('Enabling StoreKit test mode for development');
            try {
              // This allows RevenueCat to use StoreKit configuration file in development
              await Purchases.setSimulatesAskToBuyInSandbox(true);
              console.log('StoreKit simulation enabled');
            } catch (storeKitError) {
              console.error('Failed to enable StoreKit test mode:', storeKitError);
            }
          }
          
          // User ID for RevenueCat - use anonymous if no user logged in
          const userId = user?.id || 'anonymous_user';
          console.log('Using user ID for RevenueCat:', userId);
          
          try {
            // Configure RevenueCat
            await Purchases.configure({
              apiKey: REVENUECAT_API_KEY,
              appUserID: userId,
              observerMode: false // Make sure observer mode is OFF
            });
            
            setIsConfigured(true);
            console.log('RevenueCat configured successfully');
            
            // Link the RevenueCat user ID with our backend
            if (user && token) {
              // Get the RevenueCat user ID
              const rcUserID = await Purchases.getAppUserID();
              console.log('RevenueCat User ID:', rcUserID);
              
              // Link with backend
              await linkRevenueCatWithBackend(rcUserID, token);
            }
            
            // Log app bundle ID to help debug
            console.log('App Bundle ID (Info.plist):', require('expo-constants').default.manifest.ios?.bundleIdentifier);
            
            // Immediately fetch offerings and check subscription status
            try {
              console.log('Fetching offerings...');
              const offerings = await Purchases.getOfferings();
              console.log('Offerings response:', JSON.stringify(offerings));
              setOfferings(offerings);
              
              if (offerings.current) {
                console.log('Current offering found:', offerings.current.identifier);
                console.log('Available packages:', offerings.current.availablePackages.map(pkg => pkg.identifier));
              } else {
                console.warn('No current offering found. Check RevenueCat dashboard.');
              }
              
              // Check subscription status
              await checkSubscriptionStatus();
            } catch (offeringsError) {
              console.error('Error fetching offerings:', offeringsError);
              console.error('Error message:', offeringsError.message);
              console.error('Error code:', offeringsError.code);
              console.error('Error details:', offeringsError.details);
            }
          } catch (configError) {
            console.error('Error configuring RevenueCat:', configError);
            console.error('Error details:', configError.message);
          }
        }
      } catch (err) {
        console.error('Error in setupPurchases:', err);
        setError('Failed to initialize subscription services');
      } finally {
        setIsLoading(false);
      }
    };
    
    // Always run setup - don't wait for user login
    setupPurchases();
    
    // Setup purchase listener
    let purchaseListener = null;
    if (isConfigured) {
      try {
        purchaseListener = Purchases.addCustomerInfoUpdateListener((info) => {
          console.log('Purchase info updated:', info);
          setCustomerInfo(info);
          checkSubscriptionStatus(info);
        });
      } catch (listenerError) {
        console.error('Error setting up purchase listener:', listenerError);
      }
    }
    
    return () => {
      // Clean up
      if (purchaseListener) {
        try {
          purchaseListener.remove();
        } catch (cleanupError) {
          console.error('Error removing listener:', cleanupError);
        }
      }
    };
  }, [user, isConfigured, token]);
  
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
        
        // Next, check customer info from RevenueCat (works even if not logged in)
        try {
          const customerInfo = await Purchases.getCustomerInfo();
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
  
  // Check subscription status with error handling
  const checkSubscriptionStatus = async (info = null) => {
    try {
      // Use a manual override for debugging if needed
      const manualOverrideSubStatus = await AsyncStorage.getItem('debug_subscription_status');
      if (manualOverrideSubStatus) {
        const overrideValue = manualOverrideSubStatus === 'true';
        console.log('Using manual override for subscription status:', overrideValue);
        setIsSubscribed(overrideValue);
        return overrideValue;
      }

      // First try to verify with backend if user is logged in
      if (user && token) {
        try {
          console.log('Verifying subscription status with backend...');
          const backendStatus = await verifySubscriptionWithBackend(token);
          
          // If backend provided a definitive yes/no answer, use it
          if (backendStatus !== null) {
            console.log('Using backend subscription status:', backendStatus);
            setIsSubscribed(backendStatus);
            return backendStatus;
          }
        } catch (error) {
          console.error('Backend verification error:', error);
        }
        
        // If backend check failed, log it and continue with RevenueCat check
        console.log('Backend verification failed or returned null, falling back to RevenueCat');
      } else {
        console.log('User not logged in, using local RevenueCat check only');
      }
      
      // If we reached here, either:
      // 1. User is not logged in, or
      // 2. Backend verification failed
      // So we fall back to RevenueCat local verification
      
      if (!isConfigured) {
        console.log('RevenueCat not configured, cannot check subscription status');
        setIsSubscribed(false);
        return false;
      }
      
      // Get customer info from RevenueCat
      let customerInfo;
      try {
        customerInfo = info || await Purchases.getCustomerInfo();
        console.log('Customer info from RevenueCat:', JSON.stringify(customerInfo));
      } catch (infoError) {
        console.error('Error getting customer info from RevenueCat:', infoError);
        setIsSubscribed(false);
        return false;
      }
      
      setCustomerInfo(customerInfo);
      
      // IMPORTANT: Handle sandbox/testing environment more carefully
      const isSandbox = customerInfo?.entitlements?.active?.Pro?.isSandbox || false;
      
      // Check if user has active entitlements
      const hasActiveSubscription = 
        customerInfo && 
        customerInfo.entitlements && 
        customerInfo.entitlements.active && 
        Object.keys(customerInfo.entitlements.active).length > 0;
      
      console.log('Has active subscription according to RevenueCat:', hasActiveSubscription);
      console.log('Is sandbox environment:', isSandbox);
      
      // Only trust RevenueCat data when user is logged in or if not sandbox
      if (user && hasActiveSubscription) {
        setIsSubscribed(true);
        return true;
      } else if (!user && hasActiveSubscription && isSandbox) {
        // In sandbox mode without user, don't trust the RevenueCat data
        console.log('Ignoring sandbox subscription data for anonymous user');
        setIsSubscribed(false);
        return false;
      } else {
        setIsSubscribed(hasActiveSubscription);
        return hasActiveSubscription;
      }
    } catch (err) {
      console.error('Error checking subscription status:', err);
      setIsSubscribed(false);
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
          const fetchedOfferings = await Purchases.getOfferings();
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
          throw new Error('PaywallUI not available');
        }
      } else {
        console.error('Error using PaywallUI:', uiError);
        // Fall back to custom paywall
      }
      
      // Fallback: Show our custom paywall implementation
      console.log('Falling back to custom paywall');
      setShowPaywall(true);
      
    } catch (err) {
      console.error('Error opening paywall:', err);
      // Always fall back to our custom UI
      setShowPaywall(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Restore purchases
  const restorePurchases = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Check if RevenueCat is configured
      if (!isConfigured) {
        try {
          console.log('Configuring RevenueCat before restoring purchases...');
          const userId = user?.id || 'anonymous_user';
          
          // Enable debug logging 
          Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
          
          // Try to configure RevenueCat
          await Purchases.configure({
            apiKey: REVENUECAT_API_KEY,
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
          customerInfo = await Purchases.restorePurchases();
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
          
          // Enable detailed logs
          Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
          
          await Purchases.configure({
            apiKey: REVENUECAT_API_KEY,
            appUserID: userId,
            observerMode: false
          });
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
      const products = await Purchases.getProducts(productIds);
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
                    const purchaseResult = await Purchases.purchaseProduct(product.identifier);
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
          
          // Enable more detailed logs
          Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
          
          await Purchases.configure({
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
        const fetchedOfferings = await Purchases.getOfferings();
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
      
      // Get the monthly product ID
      const monthlyProductId = SUBSCRIPTION_SKUS[0]; // First one should be monthly
      console.log('Purchasing monthly subscription with ID:', monthlyProductId);
      
      // Make the purchase
      const purchaseResult = await Purchases.purchaseProduct(monthlyProductId);
      console.log('Monthly purchase result:', JSON.stringify(purchaseResult));
      
      // Check if the purchase was successful by looking at entitlements
      const hasActiveEntitlements = 
        purchaseResult?.customerInfo?.entitlements?.active && 
        Object.keys(purchaseResult.customerInfo.entitlements.active).length > 0;
      
      console.log('Purchase has active entitlements:', hasActiveEntitlements);
      console.log('Active entitlements:', JSON.stringify(purchaseResult?.customerInfo?.entitlements?.active));
      
      // Update customerInfo state with new purchase data
      setCustomerInfo(purchaseResult.customerInfo);
      
      // Set subscription status directly based on purchase result
      if (hasActiveEntitlements) {
        console.log('Setting subscription status to active based on entitlements');
        
        // Update all subscription-related state
        setIsSubscribed(true);
        await AsyncStorage.setItem('cached_subscription_status', 'true');
        
        // Also update backend if user is logged in
        if (user && token) {
          try {
            console.log('Updating backend subscription status');
            await verifySubscriptionWithBackend(token);
          } catch (backendErr) {
            console.error('Error updating backend after purchase:', backendErr);
          }
        }
        
        // Show success message and close paywall
        setShowPaywall(false);
        Alert.alert('Success', 'Thank you for subscribing to Decodr Pro!');
        
        // Trigger a second refresh after a slight delay to ensure backend sync
        setTimeout(async () => {
          await forceRefreshSubscriptionStatus();
          // Force a UI update by toggling and then setting correctly
          setIsSubscribed(false);
          setTimeout(() => setIsSubscribed(true), 50);
        }, 1000);
        
        return true;
      } else {
        // Force refresh subscription status (as backup)
        console.log('No entitlements found, forcing refresh of subscription status after purchase');
        const success = await forceRefreshSubscriptionStatus();
        
        if (success) {
          setShowPaywall(false);
          Alert.alert('Success', 'Thank you for subscribing to Decodr Pro!');
          return true;
        } else {
          console.warn('Purchase seemed successful but we could not verify subscription status');
          Alert.alert(
            'Subscription Pending',
            'Your purchase was successful, but it may take a moment to activate. Please restart the app in a few minutes.'
          );
          return false;
        }
      }
    } catch (error) {
      console.error('Error purchasing monthly subscription:', error);
      Alert.alert('Purchase Failed', error.message || 'There was an error processing your purchase.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle annual purchase from custom paywall
  const handlePurchaseAnnual = async () => {
    try {
      setIsLoading(true);
      
      // Get the annual product ID
      const annualProductId = SUBSCRIPTION_SKUS[1]; // Second one should be annual
      console.log('Purchasing annual subscription with ID:', annualProductId);
      
      // Make the purchase
      const purchaseResult = await Purchases.purchaseProduct(annualProductId);
      console.log('Annual purchase result:', JSON.stringify(purchaseResult));
      
      // Check if the purchase was successful by looking at entitlements
      const hasActiveEntitlements = 
        purchaseResult?.customerInfo?.entitlements?.active && 
        Object.keys(purchaseResult.customerInfo.entitlements.active).length > 0;
      
      console.log('Purchase has active entitlements:', hasActiveEntitlements);
      console.log('Active entitlements:', JSON.stringify(purchaseResult?.customerInfo?.entitlements?.active));
      
      // Update customerInfo state with new purchase data
      setCustomerInfo(purchaseResult.customerInfo);
      
      // Set subscription status directly based on purchase result
      if (hasActiveEntitlements) {
        console.log('Setting subscription status to active based on entitlements');
        
        // Update all subscription-related state
        setIsSubscribed(true);
        await AsyncStorage.setItem('cached_subscription_status', 'true');
        
        // Also update backend if user is logged in
        if (user && token) {
          try {
            console.log('Updating backend subscription status');
            await verifySubscriptionWithBackend(token);
          } catch (backendErr) {
            console.error('Error updating backend after purchase:', backendErr);
          }
        }
        
        // Show success message and close paywall
        setShowPaywall(false);
        Alert.alert('Success', 'Thank you for subscribing to Decodr Pro!');
        
        // Trigger a second refresh after a slight delay to ensure backend sync
        setTimeout(async () => {
          await forceRefreshSubscriptionStatus();
          // Force a UI update by toggling and then setting correctly
          setIsSubscribed(false);
          setTimeout(() => setIsSubscribed(true), 50);
        }, 1000);
        
        return true;
      } else {
        // Force refresh subscription status (as backup)
        console.log('No entitlements found, forcing refresh of subscription status after purchase');
        const success = await forceRefreshSubscriptionStatus();
        
        if (success) {
          setShowPaywall(false);
          Alert.alert('Success', 'Thank you for subscribing to Decodr Pro!');
          return true;
        } else {
          console.warn('Purchase seemed successful but we could not verify subscription status');
          Alert.alert(
            'Subscription Pending',
            'Your purchase was successful, but it may take a moment to activate. Please restart the app in a few minutes.'
          );
          return false;
        }
      }
    } catch (error) {
      console.error('Error purchasing annual subscription:', error);
      Alert.alert('Purchase Failed', error.message || 'There was an error processing your purchase.');
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
            await Purchases.invalidateCustomerInfoCache();
            console.log('RevenueCat cache invalidated');
            
            // Reset RevenueCat user (this is a more aggressive approach)
            const anonymousId = 'anonymous_' + Date.now();
            await Purchases.logOut();
            await Purchases.configure({
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
            await Purchases.configure({
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
        const info = await Purchases.getCustomerInfo();
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