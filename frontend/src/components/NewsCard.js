import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View, Image, ActivityIndicator, Animated, Easing, Alert } from 'react-native';
import { Card, Title, Paragraph, Text, useTheme, Surface, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import PropTypes from 'prop-types';
import { useAuth } from '../context/AuthContext';
import { useSavedArticles } from '../context/SavedArticlesContext';
import { useNavigation } from '@react-navigation/native';
import { useUsage } from '../context/UsageContext';
import { useSubscription } from '../context/SubscriptionContext';

// Try to import Lottie, but don't crash if it fails
let LottieView;
try {
  LottieView = require('lottie-react-native').default;
} catch (error) {
  console.warn('Failed to load Lottie:', error);
  // Create a placeholder component that renders nothing
  LottieView = () => null;
}

import InsightCard from './InsightCard';
import { getMarketInsights } from '../api/newsService';

const LoadingSpinner = () => {
  const spinValue = useRef(new Animated.Value(0)).current;
  const spinValueReverse = useRef(new Animated.Value(0)).current;
  const spinValueSlow = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;
  const opacityValue = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const startSpinning = () => {
      // Fast clockwise spin
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      // Counter-clockwise spin
      Animated.loop(
        Animated.timing(spinValueReverse, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      // Slow clockwise spin
      Animated.loop(
        Animated.timing(spinValueSlow, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();

      // Pulsating animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1.2,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseValue, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          })
        ])
      ).start();
      
      // Opacity pulsating animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacityValue, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(opacityValue, {
            toValue: 0.3,
            duration: 800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          })
        ])
      ).start();
    };
    startSpinning();

    return () => {
      // Cleanup animations
      spinValue.setValue(0);
      spinValueReverse.setValue(0);
      spinValueSlow.setValue(0);
      pulseValue.setValue(1);
      opacityValue.setValue(0.3);
    };
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const spinReverse = spinValueReverse.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg']
  });

  const spinSlow = spinValueSlow.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  return (
    <View style={styles.spinnerContainer}>
      <Animated.View
        style={[
          styles.spinnerOuter,
          { transform: [{ rotate: spin }, { scale: pulseValue }] }
        ]}
      />
      <Animated.View
        style={[
          styles.spinnerMiddle,
          { transform: [{ rotate: spinReverse }] }
        ]}
      />
      <Animated.View
        style={[
          styles.spinnerInner,
          { transform: [{ rotate: spinSlow }] }
        ]}
      />
      <Animated.View 
        style={[
          styles.spinnerCenter,
          {
            transform: [{ scale: pulseValue }],
            opacity: opacityValue
          }
        ]}
      >
        <MaterialCommunityIcons name="chart-line" size={24} color="#FFFFFF" />
      </Animated.View>
    </View>
  );
};

// Alternating loading messages
const loadingMessages = [
  "Analyzing market impact...",
  "Processing quantitative data...",
  "Evaluating financial trends...",
  "Assessing market conditions...",
  "Calculating potential effects..."
];

// Add a SubscriptionPrompt component
const SubscriptionPrompt = ({ onSubscribe }) => {
  return (
    <View style={styles.subscriptionPromptContainer}>
      <Text style={styles.subscriptionPromptTitle}>
        You've reached your free insight limit
      </Text>
      <Text style={styles.subscriptionPromptText}>
        Subscribe to DECODR PRO to unlock unlimited AI-powered market insights and premium features.
      </Text>
      <TouchableOpacity style={styles.subscribeButton} onPress={onSubscribe}>
        <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
      </TouchableOpacity>
    </View>
  );
};

const NewsCard = ({ article, onPress, index = 0, isSavedScreen = false, onSaveToggle = null }) => {
  // Validate article data
  if (!article) {
    console.warn('NewsCard received invalid article data');
    return null;
  }

  // Safe article object that won't cause crashes when properties are accessed
  const safeArticle = {
    id: article.id || `article-${index}`,
    title: article.title || 'Untitled Article',
    summary: article.description || article.summary || article.content || '',
    url: article.url || '',
    publishedAt: article.publishedAt || new Date().toISOString(),
    imageUrl: article.urlToImage || article.imageUrl || null,
    source: article.source || { name: 'Unknown' },
  };

  const theme = useTheme();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { isSubscribed, showCustomPaywall } = useSubscription();
  const { isArticleSaved, saveArticle, unsaveArticle } = useSavedArticles();
  
  // Safely access the usage context with fallbacks
  let usageContext;
  try {
    usageContext = useUsage();
  } catch (error) {
    // Create fallback functions if useUsage fails
    usageContext = {
      trackInsightView: async () => ({ showPaywall: false }),
      trackArticleSave: async () => ({ showPaywall: false }),
      shouldShowRandomPaywall: () => false
    };
    console.log('Usage context not available, using fallbacks');
  }
  
  // Destructure with fallbacks
  const { 
    trackInsightView = async () => ({ showPaywall: false }), 
    trackArticleSave = async () => ({ showPaywall: false }), 
    shouldShowRandomPaywall = () => false 
  } = usageContext || {};
  
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [insights, setInsights] = useState(null);
  const [saved, setSaved] = useState(false);
  const [insightLoaded, setInsightLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallRequiresLogin, setPaywallRequiresLogin] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(
    Math.floor(Math.random() * loadingMessages.length)
  );
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  
  // Format the publication date
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  useEffect(() => {
    // Stagger the animation based on index
    const delay = index * 100;
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
    ]).start();

    // Reset lottie error state
    setInsightLoaded(false);
    
    // Start pulse animation
    const startPulseAnimation = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        })
      ]).start(() => {
        if (generating) {
          startPulseAnimation();
        }
      });
    };
    
    if (generating) {
      startPulseAnimation();
      
      // Start shimmer animation
      const startShimmerAnimation = () => {
        Animated.loop(
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
            easing: Easing.linear,
          })
        ).start();
      };
      
      startShimmerAnimation();
    }
    
    return () => {
      // Clean up animations
      pulseAnim.setValue(1);
      shimmerAnim.setValue(0);
    };
  }, [generating]);

  // Add code to rotate through messages while generating
  useEffect(() => {
    if (generating) {
      const interval = setInterval(() => {
        setLoadingMessageIndex(prevIndex => (prevIndex + 1) % loadingMessages.length);
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [generating]);

  // Check if the article is saved
  useEffect(() => {
    const checkSavedStatus = async () => {
      if (user && article && article.id) {
        try {
          const isSaved = await isArticleSaved(article.id);
          setSaved(isSaved);
        } catch (error) {
          console.error('Error checking saved status:', error);
        }
      } else {
        setSaved(false);
      }
    };

    checkSavedStatus();
  }, [user, article]);

  const toggleExpand = async () => {
    if (!expanded) {
      // Generate insights when expanding
      if (!insights && !error) {
        // Check if the user has exceeded their free insights limit
        if (!isSubscribed) {
          console.log('Tracking insight usage before generating insight...');
          const { showPaywall, requireLogin } = await trackInsightView();
          
          if (showPaywall) {
            console.log('User has reached insight limit, showing paywall');
            setPaywallRequiresLogin(requireLogin);
            // Use the real DECODR PRO paywall
            showCustomPaywall(navigation);
            return;
          }
        }
        
        // Also show random paywalls occasionally during scrolling
        if (shouldShowRandomPaywall()) {
          setPaywallRequiresLogin(false);
          // Use the real DECODR PRO paywall
          showCustomPaywall(navigation);
          return;
        }
        
        // Generate insights
        generateInsights();
      }
    }
    
    // Toggle expanded state
    setExpanded(!expanded);
  };
  
  const generateInsights = async () => {
    try {
      setGenerating(true);
      setError(null);
      setInsightLoaded(false);
  
      Animated.timing(progressAnim, {
        toValue: 0.3, 
        duration: 1000,
        useNativeDriver: false,
        easing: Easing.out(Easing.quad),
      }).start();
      
      // Create a proper Article object that meets the backend validation requirements
      const articleData = {
        title: article.title || "",
        // Ensure content is at least 100 characters long as required by the backend
        content: article.description || article.summary || article.content || 
                "This article discusses important market trends and financial news that could impact investment decisions. " +
                "The content provides analysis of current economic conditions and potential future developments. " +
                "Readers should consider this information as part of their broader research process.",
        source: typeof article.source === 'object' ? article.source.name : article.source || "",
        publishedAt: article.publishedAt || new Date().toISOString()
      };
      
      console.log("Sending article data to insights API:", articleData);
      
      // Send the properly formatted article object to the backend
      const response = await getMarketInsights(articleData);
      
      setInsightLoaded(true);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: false,
        easing: Easing.out(Easing.quad),
      }).start();
      
      console.log("Insights API response:", response);
      
      // Check if response contains the expected data
      if (response && response.key_points) {
        // Use the existing processInsightsResponse function to create the insights array
        const insightsArray = processInsightsResponse(response);
        setInsights(insightsArray);
      } else if (response && response.error) {
        // Handle known error cases
        console.error("Insights API returned an error:", response.error);
        setError("Failed to generate insights: " + response.error);
        // Try to use fallback if error response has valid key_points
        if (response.key_points && Array.isArray(response.key_points)) {
          const fallbackInsights = processInsightsResponse(response);
          setInsights(fallbackInsights);
          setError(null); // Clear error since we have fallback
        }
      } else {
        // Handle empty or invalid response
        console.error("Invalid insights response format:", response);
        setError("Failed to generate insights: Invalid response format");
      }
    } catch (err) {
      console.error("Error fetching insights:", err);
      
      // Use fallback insights instead of showing an error
      console.log("Using fallback insights due to error");
      const fallbackResponse = {
        key_points: [
          "Unable to generate insights for this article.",
          "Please read the full article for more information."
        ],
        potential_impact: {
          stocks: {
            description: "This article does not provide specific information about the impact on stock markets.",
            impact_level: "low"
          },
          commodities: {
            description: "This article does not provide specific information about the impact on commodity markets.",
            impact_level: "low"
          },
          forex: {
            description: "This article does not provide specific information about the impact on forex markets.",
            impact_level: "low"
          }
        },
        recommended_actions: [
          "Read the full article for more details"
        ],
        confidence_score: 50
      };
      
      // Process fallback insights through the same function as normal insights
      setInsights(processInsightsResponse(fallbackResponse));
      setError(null); // Clear error since we have fallback
      
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } finally {
      setTimeout(() => setGenerating(false), 500);
    }
  };
  
  // Calculate rotation for the chevron icon
  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  // Get placeholder image if no image URL is provided
  const getImageSource = () => {
    if (article.urlToImage) {
      return { uri: article.urlToImage };
    }
    // Return null to use a placeholder color instead
    return null;
  };

  // Determine which icon to use based on article content
  const getPlaceholderIcon = () => {
    const title = article.title?.toLowerCase() || '';
    const summary = article.summary?.toLowerCase() || '';
    const category = article.category?.toLowerCase() || '';
    const combinedText = `${title} ${summary} ${category}`;
    
    // Use category from backend if available
    if (article.category) {
      switch (article.category) {
        case 'monetary_policy':
          return "bank";
        case 'stocks':
          return "chart-line";
        case 'commodities':
          return "oil";
        case 'bonds':
          return "chart-areaspline";
        case 'forex':
          return "currency-usd";
        default:
          break;
      }
    }
    
    // Fallback to text analysis
    if (combinedText.match(/stock|market|nasdaq|dow|s&p|investment|finance|financial|economy|economic/)) {
      return "chart-line";
    }
    // Technology news
    else if (combinedText.match(/tech|technology|software|hardware|app|digital|cyber|ai|artificial intelligence|robot/)) {
      return "laptop";
    }
    // Business news
    else if (combinedText.match(/business|company|corporate|industry|startup|entrepreneur/)) {
      return "briefcase";
    }
    // Politics/Government
    else if (combinedText.match(/politic|government|election|president|congress|senate|law|policy/)) {
      return "gavel";
    }
    // Health/Medical
    else if (combinedText.match(/health|medical|medicine|doctor|hospital|covid|virus|vaccine/)) {
      return "medical-bag";
    }
    // Default icon
    return "newspaper-variant-outline";
  };

  // Get category name based on the icon or backend category
  const getCategoryName = () => {
    if (article.category) {
      switch (article.category) {
        case 'monetary_policy':
          return "MONETARY POLICY";
        case 'stocks':
          return "STOCKS";
        case 'commodities':
          return "COMMODITIES";
        case 'bonds':
          return "BONDS";
        case 'forex':
          return "FOREX";
        default:
          break;
      }
    }
    
    const icon = getPlaceholderIcon();
    switch (icon) {
      case "chart-line":
        return "FINANCE";
      case "laptop":
        return "TECHNOLOGY";
      case "briefcase":
        return "BUSINESS";
      case "gavel":
        return "POLITICS";
      case "medical-bag":
        return "HEALTH";
      default:
        return "NEWS";
    }
  };

  // Get category color based on the icon or backend category
  const getCategoryColor = () => {
    if (article.category) {
      switch (article.category) {
        case 'monetary_policy':
          return "#6200EA"; // Deep purple for monetary policy
        case 'stocks':
          return "#4CAF50"; // Green for stocks
        case 'commodities':
          return "#FF9800"; // Orange for commodities
        case 'bonds':
          return "#2196F3"; // Blue for bonds
        case 'forex':
          return "#F44336"; // Red for forex
        default:
          break;
      }
    }
    
    // Use sentiment color if available
    if (article.sentiment) {
      switch (article.sentiment) {
        case 'positive':
          return "#4CAF50"; // Green for positive
        case 'negative':
          return "#F44336"; // Red for negative
        case 'neutral':
          return "#607D8B"; // Blue-grey for neutral
        default:
          break;
      }
    }
    
    const icon = getPlaceholderIcon();
    switch (icon) {
      case "chart-line":
        return "#4CAF50"; // Green for finance
      case "laptop":
        return "#2196F3"; // Blue for tech
      case "briefcase":
        return "#FF9800"; // Orange for business
      case "gavel":
        return "#9C27B0"; // Purple for politics
      case "medical-bag":
        return "#F44336"; // Red for health
      default:
        return "#607D8B"; // Blue-grey for general news
    }
  };

  // Format the source name correctly
  const getSourceName = () => {
    if (!safeArticle.source) return 'Unknown Source';
    
    // If source is an object with a name property, use that
    if (typeof safeArticle.source === 'object' && safeArticle.source !== null) {
      return safeArticle.source.name || 'Unknown Source';
    }
    
    // Otherwise, use the source directly if it's a string
    return String(safeArticle.source);
  };

  // Helper function to process insights response into an array of insight objects
  const processInsightsResponse = (response) => {
    console.log('Processing insights response:', response);
    
    // Handle case where response is null or undefined
    if (!response) {
      console.log('Response is null or undefined');
      return [
        {
          title: "No Insights Available",
          description: "Unable to generate insights for this article. Please read the full article for more information.",
          impact_level: "low",
        }
      ];
    }
    
    // Handle case where response is a string
    if (typeof response === 'string') {
      try {
        // Try to parse the string as JSON
        const parsedResponse = JSON.parse(response);
        console.log('Successfully parsed string response as JSON');
        response = parsedResponse;
      } catch (error) {
        console.error('Failed to parse string response as JSON:', error);
        // Use the string as a key point
        return [
          {
            title: "Key Points",
            description: response,
            impact_level: "medium",
          }
        ];
      }
    }
    
    // Handle case where response has raw_response field (error from backend)
    if (response && response.raw_response && !response.key_points) {
      console.log('Response contains raw_response field, attempting to extract insights');
      try {
        // Try to extract JSON from the raw response
        const jsonMatch = response.raw_response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const extractedJson = JSON.parse(jsonMatch[0]);
          console.log('Successfully extracted JSON from raw_response');
          if (extractedJson.key_points) {
            response = extractedJson;
          }
        }
      } catch (error) {
        console.error('Failed to extract JSON from raw_response:', error);
      }
    }
    
    // Create a valid key_points array if it doesn't exist
    if (!response.key_points) {
      console.log('Response missing key_points, creating default key points');
      response.key_points = [
        "Unable to generate detailed insights for this article.",
        "Please read the full article for more information."
      ];
    }
    
    // Ensure key_points is an array (sometimes the API might return a string or object)
    if (!Array.isArray(response.key_points)) {
      console.log('key_points is not an array, converting to array');
      if (typeof response.key_points === 'string') {
        // If it's a string, split by periods and filter out empty entries
        response.key_points = response.key_points
          .split('.')
          .map(point => point.trim())
          .filter(point => point.length > 0);
        
        // If splitting didn't work, use the whole string as one point
        if (response.key_points.length === 0) {
          response.key_points = [response.key_points];
        }
      } else {
        // If it's not a string or array, create a default array
        response.key_points = ["Unable to parse insights for this article."];
      }
    }
    
    // Ensure key_points is not empty
    if (response.key_points.length === 0) {
      response.key_points = ["No key points available for this article"];
    }
    
    // Ensure potential_impact exists
    if (!response.potential_impact) {
      console.log('Response missing potential_impact, creating default impact');
      response.potential_impact = {
        stocks: {
          description: "This article does not provide specific information about the impact on stock markets.",
          impact_level: "low"
        },
        commodities: {
          description: "This article does not provide specific information about the impact on commodity markets.",
          impact_level: "low"
        },
        forex: {
          description: "This article does not provide specific information about the impact on forex markets.",
          impact_level: "low"
        }
      };
    }
    
    // Handle the new response format for potential impact
    // Check if potential_impact exists and is properly structured
    let stocksImpact = { description: "", impact_level: "medium" };
    let commoditiesImpact = { description: "", impact_level: "medium" };
    let forexImpact = { description: "", impact_level: "medium" };
    
    // Extract stocks impact data
    if (response.potential_impact.stocks) {
      if (typeof response.potential_impact.stocks === 'object') {
        // New format
        stocksImpact = {
          description: response.potential_impact.stocks.description || "No impact analysis available",
          impact_level: response.potential_impact.stocks.impact_level?.toLowerCase() || "medium"
        };
      } else {
        // Old format (string)
        stocksImpact = {
          description: response.potential_impact.stocks,
          impact_level: "medium"
        };
      }
    }
    
    // Extract commodities impact data
    if (response.potential_impact.commodities) {
      if (typeof response.potential_impact.commodities === 'object') {
        // New format
        commoditiesImpact = {
          description: response.potential_impact.commodities.description || "No impact analysis available",
          impact_level: response.potential_impact.commodities.impact_level?.toLowerCase() || "medium"
        };
      } else {
        // Old format (string)
        commoditiesImpact = {
          description: response.potential_impact.commodities,
          impact_level: "medium"
        };
      }
    }
    
    // Extract forex impact data
    if (response.potential_impact.forex) {
      if (typeof response.potential_impact.forex === 'object') {
        // New format
        forexImpact = {
          description: response.potential_impact.forex.description || "No impact analysis available",
          impact_level: response.potential_impact.forex.impact_level?.toLowerCase() || "medium"
        };
      } else {
        // Old format (string)
        forexImpact = {
          description: response.potential_impact.forex,
          impact_level: "medium"
        };
      }
    }
    
    // Process each key point to ensure no impact percentages
    const processedKeyPoints = Array.isArray(response.key_points) 
      ? response.key_points
          .filter(keyPoint => keyPoint && typeof keyPoint === 'string') // Filter out null/undefined values
          .map(keyPoint => {
            // Remove any percentage symbols or confidence/impact indications from key points
            return keyPoint
              .replace(/\b\d+(?:\.\d+)?%(?:\s+(?:impact|confidence|probability|chance|likelihood))?\b/gi, '')
              .replace(/\b(?:high|medium|low)\s+(?:impact|confidence)\b/gi, '')
              .replace(/\bwith\s+(?:an?\s+)?(?:impact|confidence)(?:\s+(?:of|level))?\s+(?:of\s+)?\d+(?:\.\d+)?%?\b/gi, '')
              .replace(/\bimpact(?:\s+percentage)?\s+(?:of\s+)?\d+(?:\.\d+)?%?\b/gi, '')
              .replace(/\bconfidence\s+(?:score|level)?\s+(?:of\s+)?\d+(?:\.\d+)?%?\b/gi, '')
              .trim();
          })
      : [String(response.key_points || "No insights available")];
    
    // Handle empty key points after processing
    if (processedKeyPoints.length === 0) {
      processedKeyPoints.push("No insights available for this article");
    }
    
    // Process recommended actions to ensure no impact percentages
    const processedRecommendedActions = Array.isArray(response.recommended_actions)
      ? response.recommended_actions
          .filter(action => action && typeof action === 'string') // Filter out null/undefined values
          .map(action => {
            // Remove any percentage symbols or confidence/impact indications from recommended actions
            return action
              .replace(/\b\d+(?:\.\d+)?%(?:\s+(?:impact|confidence|probability|chance|likelihood))?\b/gi, '')
              .replace(/\b(?:high|medium|low)\s+(?:impact|confidence)\b/gi, '')
              .replace(/\bwith\s+(?:an?\s+)?(?:impact|confidence)(?:\s+(?:of|level))?\s+(?:of\s+)?\d+(?:\.\d+)?%?\b/gi, '')
              .replace(/\bimpact(?:\s+percentage)?\s+(?:of\s+)?\d+(?:\.\d+)?%?\b/gi, '')
              .replace(/\bconfidence\s+(?:score|level)?\s+(?:of\s+)?\d+(?:\.\d+)?%?\b/gi, '')
              .trim();
          })
      : (response.recommended_actions ? [String(response.recommended_actions)] : ["No specific actions recommended"]);
    
    // Handle empty recommended actions after processing
    if (processedRecommendedActions.length === 0) {
      processedRecommendedActions.push("No specific actions recommended");
    }
    
    // Create the insight objects safely
    try {
      // Convert the response to an array of insight objects for the InsightCard component
      return [
        {
          title: "Key Points",
          description: processedKeyPoints.join("\n\n"),
        },
        {
          title: "Stock Market Impact",
          description: stocksImpact.description || "No impact analysis available",
          impact_level: stocksImpact.impact_level || "medium",
          affected_assets: ["Stocks", "Equities"]
        },
        {
          title: "Commodities Impact",
          description: commoditiesImpact.description || "No impact analysis available",
          impact_level: commoditiesImpact.impact_level || "medium",
          affected_assets: ["Commodities", "Raw Materials"]
        },
        {
          title: "Forex Impact",
          description: forexImpact.description || "No impact analysis available",
          impact_level: forexImpact.impact_level || "medium",
          affected_assets: ["Currencies", "Foreign Exchange"]
        },
        {
          title: "Recommended Actions",
          description: processedRecommendedActions.join("\n\n"),
        }
      ];
    } catch (error) {
      console.error('Error creating insight cards:', error);
      // Return fallback insights if there was an error creating the insight cards
      return [
        {
          title: "Key Points",
          description: "Unable to process insights for this article. Please read the full article for more information.",
        },
        {
          title: "Market Impact",
          description: "No impact analysis available",
          impact_level: "low",
          affected_assets: ["Markets"]
        }
      ];
    }
  };

  const handleSaveToggle = async () => {
    try {
      // Prevent multiple rapid clicks
      if (insightLoaded) {
        console.log('Save operation in progress, please wait');
        return;
      }
      
      setInsightLoaded(true);
      
      if (saved) {
        // Unsave article logic
        await unsaveArticle(article.id);
        setSaved(false);
        if (onSaveToggle) {
          onSaveToggle();
        }
        return;
      }
      
      // Check if user is trying to save (not unsave) and track usage
      if (!saved && !isSubscribed) {
        const { showPaywall, requireLogin } = await trackArticleSave();
        
        if (showPaywall) {
          setPaywallRequiresLogin(requireLogin);
          // Use the real DECODR PRO paywall
          showCustomPaywall(navigation);
          return;
        }
      }
      
      // Save article
      await saveArticle({
        id: article.id,
        title: article.title,
        url: article.link,
        image_url: article.photo_url || article.thumbnail_url,
        source: article.source_name,
        description: article.snippet,
        published_at: article.published_datetime_utc
      });
      
      setSaved(true);
      if (onSaveToggle) {
        onSaveToggle();
      }
    } catch (error) {
      console.error('Error toggling saved status:', error);
      Alert.alert(
        'Error',
        'Could not update saved status. Please try again later.'
      );
    } finally {
      setInsightLoaded(false);
    }
  };

  // Get save button styles based on saved state
  const getSaveButtonStyle = () => {
    return saved ? styles.savedButton : styles.saveButton;
  };

  // Format component return
  return (
    <Animated.View
      style={[
        styles.cardContainer,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Card style={styles.card}>
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
          {safeArticle.imageUrl && !insightLoaded ? (
            <Card.Cover 
              source={getImageSource()} 
              style={styles.cardImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.placeholderImage, { backgroundColor: `${getCategoryColor()}15` }]}>
              <MaterialCommunityIcons name={getPlaceholderIcon()} size={48} color={getCategoryColor()} />
              <View style={styles.categoryBadge}>
                <Text style={[styles.categoryText, { color: getCategoryColor() }]}>{getCategoryName()}</Text>
              </View>
              <View style={styles.logoContainer}>
                <Text style={styles.headlineText}></Text>
                <Text style={styles.decoderText}>DECODR</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
        
        <Card.Content style={styles.cardContent}>
          <View style={styles.sourceContainer}>
            <Text style={styles.source}>{getSourceName()}</Text>
          </View>
            
          <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
            <Title style={styles.title}>{safeArticle.title}</Title>
            {safeArticle.summary && (
              <Paragraph style={styles.description}>{safeArticle.summary}</Paragraph>
            )}
          </TouchableOpacity>
          
          {safeArticle.url && (
            <TouchableOpacity 
              style={styles.readMoreButton} 
              onPress={onPress}
              activeOpacity={0.7}
            >
              <Text style={styles.readMoreText}>Read Full Article</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color="#2196F3" />
            </TouchableOpacity>
          )}
        </Card.Content>
        
        <View style={styles.buttonsContainer}>
          <TouchableOpacity 
            style={styles.insightsButton} 
            onPress={toggleExpand}
            activeOpacity={0.7}
          >
            <View style={styles.insightsButtonContent}>
              <MaterialCommunityIcons 
                name="chart-line" 
                size={20} 
                color="#FFFFFF" 
                style={styles.insightsIcon}
              />
              <Text style={styles.insightsButtonText}>
                {expanded ? 'Hide Market Insights' : 'View Market Insights'}
              </Text>
              <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
                <MaterialCommunityIcons 
                  name="chevron-down" 
                  size={20} 
                  color="#FFFFFF" 
                />
              </Animated.View>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={getSaveButtonStyle()} 
            onPress={handleSaveToggle}
            activeOpacity={0.7}
            disabled={insightLoaded && user}
          >
            <MaterialCommunityIcons 
              name={saved ? "bookmark" : "bookmark-outline"} 
              size={20} 
              color="#000000" 
            />
          </TouchableOpacity>
        </View>
        
        {expanded && (
          <Card.Content style={styles.expandedContent}>
            {generating ? (
              <View style={styles.loadingContainer}>
                <LoadingSpinner />
                <Text style={styles.loadingText}>{loadingMessages[loadingMessageIndex]}</Text>
                <View style={styles.loadingProgressContainer}>
                  <Animated.View 
                    style={[
                      styles.loadingProgressBar, 
                      { width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%']
                      })}
                    ]} 
                  />
                </View>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#F44336" />
                <Text style={styles.errorText}>{error}</Text>
                <Button 
                  mode="contained" 
                  onPress={() => {
                    setError(null);
                    toggleExpand();
                  }}
                  style={styles.retryButton}
                >
                  Try Again
                </Button>
              </View>
            ) : insights && insights.length > 0 ? (
              <View style={styles.insightsContainer}>
                {insights.map((insight, index) => (
                  <InsightCard key={index} insight={insight} index={index} articleId={article.id} />
                ))}
                <View style={styles.insightsFooter}>
                  <Text style={styles.insightsFooterText}>
                    Analysis based on historical market patterns and current conditions
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.noInsightsContainer}>
                <MaterialCommunityIcons name="information-outline" size={48} color="#9E9E9E" />
                <Text style={styles.noInsightsText}>No market insights available for this article</Text>
              </View>
            )}
          </Card.Content>
        )}
      </Card>
    </Animated.View>
  );
};

NewsCard.propTypes = {
  article: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string,
    description: PropTypes.string,
    urlToImage: PropTypes.string,
    publishedAt: PropTypes.string,
    source: PropTypes.shape({
      name: PropTypes.string,
    }),
  }).isRequired,
  onPress: PropTypes.func.isRequired,
  index: PropTypes.number,
  isSavedScreen: PropTypes.bool,
  onSaveToggle: PropTypes.func,
};

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 16,
  },
  card: {
    borderRadius: 0,
    overflow: 'hidden',
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { height: 0, width: 0 },
    backgroundColor: '#FFFFFF',
  },
  cardImage: {
    height: 200,
    borderRadius: 0,
  },
  cardContent: {
    padding: 16,
  },
  sourceContainer: {
    marginBottom: 8,
  },
  source: {
    fontSize: 12,
    color: '#000000',
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
    fontFamily: 'Inter-Bold',
    lineHeight: 24,
  },
  description: {
    fontSize: 14,
    color: '#333333',
    marginBottom: 16,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  insightsButton: {
    backgroundColor: '#000000',
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 0,
    minWidth: '80%',
  },
  insightsButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightsIcon: {
    marginRight: 8,
  },
  insightsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8,
    fontFamily: 'Inter_600SemiBold',
  },
  expandedContent: {
    padding: 16,
    paddingHorizontal: 8,
    paddingTop: 0,
  },
  placeholderImage: {
    height: 200,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 0,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    marginTop: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Inter_700Bold',
  },
  logoContainer: {
    marginTop: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headlineText: {
    fontSize: 24,
    color: '#000000',
    fontFamily: 'TimesNewRoman',
    letterSpacing: 1,
    marginBottom: 4,
  },
  decoderText: {
    fontSize: 16,
    color: '#666666',
    fontFamily: 'CourierPrime-Regular',
    letterSpacing: 2,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(250, 250, 250, 0.9)',
    borderRadius: 8,
    margin: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  loadingText: {
    marginTop: 24,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter_600SemiBold',
  },
  loadingProgressContainer: {
    width: '80%',
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    marginTop: 16,
    overflow: 'hidden',
  },
  loadingProgressBar: {
    height: '100%',
    backgroundColor: '#000000',
    borderRadius: 3,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 240, 240, 0.9)',
    borderRadius: 16,
    margin: 16,
  },
  errorText: {
    marginTop: 16,
    marginBottom: 16,
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
  },
  retryButton: {
    marginTop: 8,
    backgroundColor: '#F44336',
  },
  insightButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  insightButton: {
    marginVertical: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#000000',
  },
  insightDisclaimer: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  spinnerContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  spinnerOuter: {
    width: 70,
    height: 70,
    borderRadius: 35, 
    borderWidth: 3,
    borderColor: '#2196F3',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.7,
  },
  spinnerMiddle: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25, 
    borderWidth: 4,
    borderColor: '#4CAF50',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  spinnerInner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: '#FF9800',
    borderStyle: 'solid',
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    opacity: 0.9,
  },
  spinnerCenter: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  insightsContainer: {
    marginHorizontal: 0,
  },
  insightsFooter: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightsFooterText: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  noInsightsContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noInsightsText: {
    fontSize: 16,
    color: '#9E9E9E',
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
  },
  readMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  readMoreText: {
    color: '#2196F3',
    fontSize: 14,
    marginRight: 4,
    fontFamily: 'Inter_600SemiBold',
  },
  buttonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: 16,
    marginTop: 0,
    marginBottom: 16,
  },
  saveButton: {
    padding: 8,
    marginLeft: 8,
    backgroundColor: 'transparent',
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  savedButton: {
    padding: 8,
    marginLeft: 8,
    backgroundColor: 'transparent',
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flexDirection: 'column',
  },
  sourceText: {
    fontSize: 12,
    color: '#000000',
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
    textTransform: 'uppercase',
  },
  publishedText: {
    fontSize: 12,
    color: '#666666',
    fontFamily: 'Inter_400Regular',
  },
  imageContainer: {
    height: 200,
    marginBottom: 16,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  cardActions: {
    padding: 0,
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  readMoreText: {
    color: '#000000',
    fontSize: 14,
    marginRight: 8,
    fontFamily: 'Inter_600SemiBold',
  },
  insightsToggle: {
    padding: 12,
  },
  insightsToggleText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  insightSection: {
    marginBottom: 16,
  },
  subscriptionPromptContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    padding: 16,
    borderRadius: 8,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  subscriptionPromptTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  subscriptionPromptText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  subscribeButton: {
    backgroundColor: '#FFD700',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  subscribeButtonText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default NewsCard;
