import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { useSubscription } from './SubscriptionContext';

// Create context
const UsageContext = createContext();

// Usage limits for free users
const DAILY_SAVE_LIMIT = 1;

export const UsageProvider = ({ children }) => {
  const { user, token } = useAuth();
  const { isSubscribed } = useSubscription();
  const [articlesSaved, setArticlesSaved] = useState(0);
  const [lastResetDate, setLastResetDate] = useState(null);
  const [randomPaywallProbability, setRandomPaywallProbability] = useState(0.15); // 15% chance
  
  // Reset usage counts at midnight
  useEffect(() => {
    const checkAndResetDailyCounts = async () => {
      try {
        const today = new Date().toDateString();
        const storedDate = await AsyncStorage.getItem('usageLastResetDate');
        
        // If it's a new day, reset counters
        if (storedDate !== today) {
          await AsyncStorage.setItem('usageLastResetDate', today);
          await AsyncStorage.setItem('articlesSaved', '0');
          
          setLastResetDate(today);
          setArticlesSaved(0);
        }
      } catch (error) {
        console.error('Error resetting daily counters:', error);
      }
    };
    
    // Load stored values on app start
    const loadUsageData = async () => {
      try {
        const storedSaves = await AsyncStorage.getItem('articlesSaved');
        const storedDate = await AsyncStorage.getItem('usageLastResetDate');
        
        if (storedSaves) setArticlesSaved(parseInt(storedSaves, 10));
        if (storedDate) setLastResetDate(storedDate);
        
        checkAndResetDailyCounts();
      } catch (error) {
        console.error('Error loading usage data:', error);
      }
    };
    
    loadUsageData();
    
    // Check at app start and whenever the component mounts
    checkAndResetDailyCounts();
    
    // Setup a timer to check periodically
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight - new Date();
    
    const timer = setTimeout(() => {
      checkAndResetDailyCounts();
    }, msUntilMidnight);
    
    return () => clearTimeout(timer);
  }, [user, token]);
  
  // Track article save
  const trackArticleSave = async () => {
    // Subscribed users have unlimited saves
    if (isSubscribed) return { showPaywall: false };
    
    try {
      // Must be logged in to save
      if (!user) {
        return { showPaywall: false, requireLogin: true };
      }
      
      // If already at limit
      if (articlesSaved >= DAILY_SAVE_LIMIT) {
        return { showPaywall: true, requireLogin: false };
      }
      
      // Track the save
      const newCount = articlesSaved + 1;
      setArticlesSaved(newCount);
      await AsyncStorage.setItem('articlesSaved', newCount.toString());
      
      // Show paywall for non-subscribed users after limit
      if (newCount >= DAILY_SAVE_LIMIT) {
        return { showPaywall: true, requireLogin: false };
      }
      
      return { showPaywall: false };
    } catch (error) {
      console.error('Error tracking article save:', error);
      return { showPaywall: false };
    }
  };
  
  // Check if random paywall should be shown
  const shouldShowRandomPaywall = () => {
    if (isSubscribed) return false;
    
    return Math.random() < randomPaywallProbability;
  };
  
  return (
    <UsageContext.Provider
      value={{
        articlesSaved,
        trackArticleSave,
        shouldShowRandomPaywall,
        dailySaveLimit: DAILY_SAVE_LIMIT,
        remainingSaves: Math.max(0, DAILY_SAVE_LIMIT - articlesSaved),
      }}
    >
      {children}
    </UsageContext.Provider>
  );
};

export const useUsage = () => {
  const context = useContext(UsageContext);
  if (!context) {
    throw new Error('useUsage must be used within a UsageProvider');
  }
  return context;
};

// For checking if user can access weekly insights
export const canAccessWeeklyInsights = (isSubscribed) => {
  // Everyone can access weekly insights now
  return true;
}; 