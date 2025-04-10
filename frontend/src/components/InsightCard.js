import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Animated, Easing, TouchableOpacity, Platform, Dimensions } from 'react-native';
import { Card, Text, useTheme, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSubscription } from '../context/SubscriptionContext';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

// Create a fixed set of locked card patterns - simple but random-looking
const LOCK_PATTERNS = [
  [0, 1, 3], // first, second, and fourth cards
  [0, 2, 4], // first, third, and fifth cards
  [1, 2, 3], // second, third, and fourth cards
  [2, 3, 4], // third, fourth, and fifth cards
  [0, 1, 4], // first, second, and fifth cards
];

// Choose a pattern based on current day - changes each day but stays consistent during a day
const getLockedIndices = () => {
  const day = new Date().getDate(); // 1-31
  return LOCK_PATTERNS[day % LOCK_PATTERNS.length];
};

const InsightCard = ({ insight, index, articleId, marketType }) => {
  const theme = useTheme();
  const { isSubscribed, showCustomPaywall, redirectToLogin } = useSubscription();
  const { user } = useAuth();
  const navigation = useNavigation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(20)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const blurAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const [isLocked, setIsLocked] = useState(false);
  const [lockedIndices, setLockedIndices] = useState(null);
  
  const borderGlow = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 215, 0, 0.4)', 'rgba(255, 215, 0, 0.9)']
  });
  
  const buttonGlow = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0, 0, 0, 0.8)', 'rgba(20, 20, 20, 0.9)']
  });
  
  const ovelrayOpacity = blurAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.97, 0.99]
  });
  
  // Generate a deterministic but random-looking hash
  const generateHash = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  };

  const coverOptions = ['Stocks', 'Commodities', 'Key Points'];
  const coverType = coverOptions[generateHash((articleId || 'default-article') + '_' + index) % coverOptions.length];

  // Get random indices based on article and market type
  const getRandomIndices = async () => {
    try {
      // Use a combination of article ID and market type to ensure unique patterns
      const combinedKey = `${articleId || 'default'}_${marketType || 'default'}`;
      const cacheKey = `locked_indices_${combinedKey}`;
      
      // Try to get cached indices first to ensure consistency during the session
      const cached = await AsyncStorage.getItem(cacheKey);
      
      if (cached) {
        console.log(`Using cached locked indices for ${combinedKey}:`, cached);
        return JSON.parse(cached);
      }

      console.log(`Generating new locked indices for ${combinedKey}`);
      
      // Use date for daily rotation - change patterns each day
      const today = new Date();
      const dayKey = `${today.getFullYear()}-${today.getMonth()+1}-${today.getDate()}`;
      
      // Combine multiple factors for the seed to ensure uniqueness across different market types
      const seedStr = `${combinedKey}_${dayKey}`;
      const seed = generateHash(seedStr);
      
      console.log(`Generated seed ${seed} for ${seedStr}`);
      
      // Create array of indices and shuffle using Fisher-Yates with the seed
      const indices = [0, 1, 2, 3, 4]; // Always 5 cards
      
      // Use a predictable but random-looking sequence from the seed
      // This shuffling algorithm ensures true randomness while maintaining consistency
      for (let i = indices.length - 1; i > 0; i--) {
        // Use the seed to generate a predictable "random" number
        const seedValue = (seed * (i + 1)) % 65537; // Use a prime number for better distribution
        const j = Math.floor(seedValue % (i + 1));
        // Swap elements
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      // Take first 3 indices as locked ones
      const selectedIndices = indices.slice(0, 3).sort((a, b) => a - b);
      
      console.log(`Selected indices for ${combinedKey}:`, selectedIndices);
      
      // Cache the result for consistent experience
      await AsyncStorage.setItem(cacheKey, JSON.stringify(selectedIndices));
      
      return selectedIndices;
    } catch (error) {
      console.error('Error generating random indices:', error);
      
      // Fallback to a deterministic pattern if something goes wrong
      // Use the index itself to determine if it should be locked
      // This ensures we always have exactly 3 locked cards in case of error
      return [0, 2, 4];
    }
  };

  useEffect(() => {
    const initializeLockedState = async () => {
      // Remove temporary override and restore original lock functionality
      if (!isSubscribed) {
        // Default to empty strings if undefined to avoid errors
        const safeArticleId = articleId || 'default-article';
        const safeMarketType = marketType || 'default-market';
        
        console.log(`Initializing lock state for article ${safeArticleId}, market ${safeMarketType}, index ${index}`);
        
        const indices = await getRandomIndices();
        setLockedIndices(indices);
        
        const shouldLock = indices.includes(index);
        console.log(`Card ${index} locked: ${shouldLock} (locked indices: ${indices.join(', ')})`);
        
        setIsLocked(shouldLock);
      } else {
        setIsLocked(false);
      }
    };

    initializeLockedState();
  }, [isSubscribed, articleId, marketType, index]);

  useEffect(() => {
    const delay = index * 150;
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.timing(translateYAnim, {
        toValue: 0,
        duration: 400,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
    ]).start();
    
    if (!isSubscribed && isLocked) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: false,
          }),
        ])
      ).start();
      
      Animated.loop(
        Animated.sequence([
          Animated.timing(blurAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: false,
          }),
          Animated.timing(blurAnim, {
            toValue: 0,
            duration: 3000,
            useNativeDriver: false,
          }),
        ])
      ).start();
    }
  }, [index, isSubscribed, fadeAnim, translateYAnim, glowAnim, blurAnim]);

  const handleUnlock = () => {
    console.log('Unlock button pressed', { user: !!user, isSubscribed, navigation: !!navigation });
    
    if (!navigation) {
      console.error('Navigation object is undefined in handleUnlock');
      return;
    }

    if (!user) {
      console.log('Redirecting to login');
      try {
        // Try direct navigation if redirectToLogin fails
        if (typeof redirectToLogin !== 'function') {
          console.error('redirectToLogin is not a function, trying direct navigation');
          navigation.navigate('Login', {
            message: 'Please log in to access premium content',
            redirectAfterLogin: true,
            redirectRoute: 'ArticleDetails'
          });
        } else {
          redirectToLogin(navigation, {
            message: 'Please log in to access premium content',
            redirectAfterLogin: true,
            redirectRoute: 'ArticleDetails'
          });
        }
      } catch (error) {
        console.error('Navigation error:', error);
        // Last resort - try simple navigation
        try {
          navigation.navigate('Login');
        } catch (e) {
          console.error('Simple navigation failed:', e);
        }
      }
      return;
    }
    
    if (!isSubscribed) {
      console.log('Showing paywall');
      try {
        if (typeof showCustomPaywall !== 'function') {
          console.error('showCustomPaywall is not a function, trying direct navigation');
          navigation.navigate('Subscription');
        } else {
          showCustomPaywall(navigation);
        }
      } catch (error) {
        console.error('Paywall navigation error:', error);
        // Last resort - try simple navigation
        try {
          navigation.navigate('Subscription');
        } catch (e) {
          console.error('Simple paywall navigation failed:', e);
        }
      }
    }
  };

  if (!insight) {
    return (
      <Animated.View
        style={[
          styles.animatedContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: translateYAnim }],
          },
        ]}
      >
        <Card style={[styles.card, { backgroundColor: '#F5F5F5' }]}>
          <Card.Content>
            <Text style={styles.errorText}>Invalid insight data</Text>
          </Card.Content>
        </Card>
      </Animated.View>
    );
  }

  const getCardColor = () => {
    if (insight.title === "Key Points") return '#F8F8F8';
    if (insight.title === "Recommended Actions") return '#F5F5F5';
    const impactLevel = insight.impact_level?.toLowerCase();
    if (!impactLevel) return '#F5F5F5';
    switch (impactLevel) {
      case 'high': return '#E8F5E9';
      case 'medium': return '#E3F2FD';
      case 'low': return '#F5F5F5';
      case 'unknown': return '#F8F8F8';
      default: return '#F5F5F5';
    }
  };

  const getBorderColor = () => {
    if (insight.title === "Key Points") return '#424242';
    if (insight.title === "Recommended Actions") return '#757575';
    const impactLevel = insight.impact_level?.toLowerCase();
    if (!impactLevel) return '#9E9E9E';
    switch (impactLevel) {
      case 'high': return '#4CAF50';
      case 'medium': return '#2196F3';
      case 'low': return '#9E9E9E';
      case 'unknown': return '#BDBDBD';
      default: return '#9E9E9E';
    }
  };

  const getImpactLabel = () => {
    if (insight.title === "Key Points" || insight.title === "Recommended Actions") return null;
    const impactLevel = insight.impact_level;
    if (!impactLevel) return null;
    return impactLevel.charAt(0).toUpperCase() + impactLevel.slice(1);
  };

  const formatDescriptionWithHighlights = (text) => {
    if (!text) return null;
    if (insight.title === "Key Points" || insight.title === "Recommended Actions") {
      return <Text style={styles.insightText}>{text}</Text>;
    }
    const regex = /(\$?\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?%?|\$\d+(?:\.\d+)?(?:-\$\d+(?:\.\d+)?)?)/g;
    const parts = text.split(regex);
    return (
      <Text style={styles.insightText}>
        {parts.map((part, i) => {
          if (part.match(regex)) {
            const isNegative = part.includes('-') || 
                              (part.toLowerCase().includes('down') || 
                               part.toLowerCase().includes('drop') || 
                               part.toLowerCase().includes('decrease') || 
                               part.toLowerCase().includes('fall') ||
                               part.toLowerCase().includes('decline'));
            return (
              <Text 
                key={i} 
                style={[
                  styles.highlightedNumber, 
                  isNegative ? styles.negativeNumber : styles.positiveNumber
                ]}
              >
                {part}
              </Text>
            );
          }
          return <Text key={i}>{part}</Text>;
        })}
      </Text>
    );
  };

  return (
    <Animated.View
      style={[
        styles.animatedContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: translateYAnim }],
        },
      ]}
    >
      <View style={[
        styles.cardWrapper, 
        { 
          backgroundColor: getCardColor(),
          borderLeftColor: getBorderColor()
        }
      ]}>
        <View style={styles.cardContent}>
          <Text style={styles.insightTitle}>{insight.title}</Text>
          <View style={styles.contentContainer}>
            {formatDescriptionWithHighlights(insight.description)}
            {insight.affected_assets && insight.affected_assets.length > 0 && (
              <View style={styles.assetsContainer}>
                <Text style={styles.assetsLabel}>Affected Assets:</Text>
                <View style={styles.chipContainer}>
                  {insight.affected_assets.map((asset, i) => (
                    <Chip 
                      key={i} 
                      style={styles.chip}
                      textStyle={styles.chipText}
                    >
                      {asset}
                    </Chip>
                  ))}
                </View>
              </View>
            )}
            <View style={styles.metadataContainer}>
              {getImpactLabel() && (
                <View style={styles.impactContainer}>
                  <MaterialCommunityIcons 
                    name="alert-circle-outline" 
                    size={14} 
                    color={getBorderColor()} 
                    style={styles.impactIcon}
                  />
                  <Text style={[styles.impactLabel, { color: getBorderColor() }]}>
                    {getImpactLabel()} Impact
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
        {isLocked && (
          <Animated.View style={[styles.ovelrayContainer]}>
            <BlurView 
              intensity={Platform.OS === 'ios' ? 70 : 100} 
              tint="light"
              style={[StyleSheet.absoluteFill]}
            />
            <Animated.View style={[
              styles.ovelrayContent,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }]
              }
            ]}>
              <View style={styles.unlockContent}>
                <Ionicons name="lock-closed" size={32} color="#000000" />
                <Text style={styles.unlockText}>Premium</Text>
                <TouchableOpacity
                  style={styles.unlockButton}
                  onPress={handleUnlock}
                >
                  <Text style={styles.unlockButtonText}>Unlock</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  animatedContainer: {
    marginBottom: 12,
    marginHorizontal: 0,
  },
  card: {
    borderRadius: 0,
    borderLeftWidth: 4,
  },
  cardWrapper: {
    borderRadius: 0,
    overflow: 'hidden',
    borderLeftWidth: 4,
    marginHorizontal: 0,
  },
  cardContent: {
    padding: 16,
    paddingHorizontal: 12,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
    zIndex: 1000,
  },
  contentContainer: {
    position: 'relative',
  },
  insightText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    color: '#000000',
  },
  assetsContainer: {
    marginBottom: 12,
  },
  assetsLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#666666',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    margin: 2,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 0,
  },
  chipText: {
    fontSize: 10,
  },
  metadataContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  impactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  impactIcon: {
    marginRight: 4,
  },
  impactLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 14,
    color: '#666666',
  },
  highlightedNumber: {
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginHorizontal: 1,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  positiveNumber: {
    backgroundColor: '#4CAF50',
  },
  negativeNumber: {
    backgroundColor: '#F44336',
  },
  ovelrayContainer: {
    position: 'absolute',
    top: 42,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  ovelrayContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  unlockContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  unlockText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginTop: 8,
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 16,
    letterSpacing: 1,
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  unlockButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    marginTop: 10,
  },
  unlockButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    paddingHorizontal: 16,
    letterSpacing: 1,
  },
});

export default InsightCard;