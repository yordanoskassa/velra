import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Image, ActivityIndicator, Linking, Alert, TouchableOpacity, Animated, Platform, ImageBackground } from 'react-native';
import { Appbar, Text, Button, Divider, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import InsightCard from '../components/InsightCard';
import { getMarketInsights } from '../api/newsService';
import { useAuth } from '../context/AuthContext';
import { useSavedArticles } from '../context/SavedArticlesContext';
import { useUsage } from '../context/UsageContext';
import { useSubscription } from '../context/SubscriptionContext';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { getApiUrl, getAuthApiUrl, getNewsApiUrl } from '../api/config';

// Free users insight limit
const DAILY_INSIGHT_LIMIT = 3;

// Set these values at the top to make debug testing easier
const IS_DEBUG_MODE = false; // Set to true to show debug info
const FORCE_FREE_USER = false; // Changed to false to allow premium purchases to work

// Force coverage for debugging
const ALWAYS_COVER = false;

// Add a new InsightLoadingIndicator component at the top of the file, before the ArticleDetailsScreen component
// This will display a sophisticated loading state with alternating messages

const InsightLoadingIndicator = () => {
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  
  // Sophisticated AI/ML-sounding loading messages
  const loadingMessages = [
    "Analyzing market sentiment...",
    "Identifying key market patterns...",
    "Extracting financial insights...",
    "Calculating impact coefficients...",
    "Running predictive models...",
    "Correlating with market indicators...",
    "Quantifying statistical significance...",
    "Processing natural language signals...",
    "Synthesizing expert analysis...",
    "Evaluating market implications..."
  ];
  
  useEffect(() => {
    // Rotate through loading messages every 2 seconds
    const interval = setInterval(() => {
      setLoadingMessageIndex((current) => (current + 1) % loadingMessages.length);
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FFD700" style={styles.loadingSpinner} />
      <Text style={styles.loadingMessage}>{loadingMessages[loadingMessageIndex]}</Text>
      <Text style={styles.loadingSubtext}>Our AI is processing this article</Text>
    </View>
  );
};

const ArticleDetailsScreen = ({ route, navigation }) => {
  const { article } = route.params;
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [saved, setSaved] = useState(false);
  const { user } = useAuth();
  const { isArticleSaved, saveArticle, unsaveArticle } = useSavedArticles();
  const { insightsViewed, serverSideInsightCount } = useUsage();
  const { 
    isSubscribed: isUserSubscribed, 
    showCustomPaywall, 
    forceRefreshSubscriptionStatus,
    redirectToLogin  
  } = useSubscription();
  
  // ========== DEBUG SETTINGS ==========
  // Force subscription to false for testing blur overlays
  const isSubscribed = IS_DEBUG_MODE ? !FORCE_FREE_USER : isUserSubscribed;
  
  // State to manage insight overlays and unlock attempts
  const [insightOverlays, setInsightOverlays] = useState({});
  const [hasAttemptedUnlock, setHasAttemptedUnlock] = useState(false);
  const [articleContentLocked, setArticleContentLocked] = useState(!isSubscribed);
  
  // Animation for the blur overlay
  const [pulseAnim] = useState(new Animated.Value(1));
  const [flashAnim] = useState(new Animated.Value(0));
  
  // Debug log for subscription status
  useEffect(() => {
    console.log('ArticleDetailsScreen - Original isSubscribed:', isUserSubscribed);
    console.log('ArticleDetailsScreen - Using isSubscribed:', isSubscribed);
  }, [isUserSubscribed, isSubscribed]);

  // Modified debug section
  useEffect(() => {
    console.log('Debug Mode Active - Forcing:', {
      FORCE_FREE_USER,
    });
  }, []);

  // Start the pulse animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    // Start flashing animation for the unlock button
    Animated.loop(
      Animated.sequence([
        Animated.timing(flashAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(flashAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [pulseAnim, flashAnim]);

  // Add API connection test when component mounts
  useEffect(() => {
    const testApiConnection = async () => {
      try {
        console.log('Testing API connection...');
        console.log('Base API URL:', getApiUrl());
        console.log('Auth API URL:', getAuthApiUrl());
        console.log('News API URL:', getNewsApiUrl());
        
        // Try to connect to the auth endpoint
        const response = await axios.get(`${getAuthApiUrl()}/health-check`, { 
          timeout: 5000 
        });
        
        console.log('API connection successful:', response.data);
      } catch (error) {
        console.error('API connection test failed:', error.message);
        if (error.response) {
          console.log('Error response data:', error.response.data);
          console.log('Error response status:', error.response.status);
        } else if (error.request) {
          console.log('No response received from server');
        } else {
          console.log('Error setting up request:', error.message);
        }
      }
    };
    
    testApiConnection();
  }, []);

  // Add an effect to force subscription status refresh on component mount
  useEffect(() => {
    const refreshSubscriptionStatus = async () => {
      try {
        console.log('ArticleDetailsScreen - Refreshing subscription status');
        if (typeof forceRefreshSubscriptionStatus === 'function') {
          console.log('User authenticated?', user ? 'YES' : 'NO');
          if (!user) {
            console.log('No user logged in, subscription status will rely on local storage or RevenueCat only');
          }
          
          const status = await forceRefreshSubscriptionStatus();
          console.log('ArticleDetailsScreen - Subscription refresh result:', status);
        } else {
          console.error('forceRefreshSubscriptionStatus function not available');
        }
      } catch (error) {
        console.error('Error refreshing subscription status:', error);
      }
    };
    
    refreshSubscriptionStatus();
  }, [forceRefreshSubscriptionStatus, user]);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Format the article data to match the expected API input format
        const articleData = {
          title: article.title || "",
          // Ensure content is at least 100 characters long as required by the backend
          content: article.content || article.description || 
                  "This article discusses important market trends and financial news that could impact investment decisions. " +
                  "The content provides analysis of current economic conditions and potential future developments. " +
                  "Readers should consider this information as part of their broader research process.",
          source: typeof article.source === 'object' ? article.source.name : article.source || "",
          publishedAt: article.publishedAt || new Date().toISOString()
        };
        
        console.log("Sending article data to insights API:", articleData);
        
        // Send the properly formatted article object to the backend
        const response = await getMarketInsights(articleData);
        
        if (response && response.key_points) {
          // Process each key point to ensure no impact percentages
          const processedKeyPoints = Array.isArray(response.key_points) 
            ? response.key_points.map(keyPoint => {
                // Remove any percentage symbols or confidence/impact indications from key points
                return keyPoint
                  .replace(/\b\d+(?:\.\d+)?%(?:\s+(?:impact|confidence|probability|chance|likelihood))?\b/gi, '')
                  .replace(/\b(?:high|medium|low)\s+(?:impact|confidence)\b/gi, '')
                  .replace(/\bwith\s+(?:an?\s+)?(?:impact|confidence)(?:\s+(?:of|level))?\s+(?:of\s+)?\d+(?:\.\d+)?%?\b/gi, '')
                  .replace(/\bimpact(?:\s+percentage)?\s+(?:of\s+)?\d+(?:\.\d+)?%?\b/gi, '')
                  .replace(/\bconfidence\s+(?:score|level)?\s+(?:of\s+)?\d+(?:\.\d+)?%?\b/gi, '')
                  .trim();
              })
            : [String(response.key_points)];
          
          // Process recommended actions to ensure no impact percentages
          const processedRecommendedActions = Array.isArray(response.recommended_actions)
            ? response.recommended_actions.map(action => {
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
          
          // Extract impact data from the response
          let stocksImpact = { description: "", impact_level: "medium" };
          
          // Extract stocks impact data
          if (response.potential_impact?.stocks) {
            if (typeof response.potential_impact.stocks === 'object') {
              // Check if it's the new format with description and impact_level
              if (response.potential_impact.stocks.description) {
                // New format
                stocksImpact = {
                  description: response.potential_impact.stocks.description || "No impact analysis available",
                  impact_level: response.potential_impact.stocks.impact_level?.toLowerCase() || "medium"
                };
              } else {
                // Old format (object but without description)
                stocksImpact = {
                  description: Object.entries(response.potential_impact.stocks)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join('\n\n'),
                  impact_level: "medium"
                };
              }
            } else {
              // Old format (string)
              stocksImpact = {
                description: response.potential_impact.stocks,
                impact_level: "medium"
              };
            }
          } else {
            stocksImpact = {
              description: "No specific information about the impact on stock markets.",
              impact_level: "low"
            };
          }
          
          // Convert the response to an array of insight objects for the InsightCard component
          const insightsArray = [
            {
              title: "Key Points",
              description: processedKeyPoints.join("\n• "),
            },
            {
              title: "Potential Impact on Stocks",
              description: stocksImpact.description,
              impact_level: stocksImpact.impact_level,
              affected_assets: ["Stocks"]
            },
            {
              title: "Recommended Actions",
              description: processedRecommendedActions.join("\n• "),
            },
            {
              title: "Market Sentiment",
              description: "Overall market sentiment based on this news appears to be cautiously optimistic. Investors should monitor related developments closely.",
              impact_level: "medium",
              affected_assets: ["General Market"]
            },
            {
              title: "Premium Analysis",
              description: "This premium insight contains detailed analysis only available to Pro subscribers. Upgrade to access this content.",
              impact_level: "high",
              affected_assets: ["Premium Content"]
            }
          ];
          
          console.log('Generated insights count:', insightsArray.length);
          setInsights(insightsArray);
        } else {
          setInsights([{
            title: "No Insights Available",
            description: "Unable to generate insights for this article. Please read the full article for more information.",
            impact_level: "low",
          }]);
        }
      } catch (err) {
        console.error("Error fetching insights:", err);
        setError("Failed to load market insights. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    
    if (article?.content || article?.description) {
      fetchInsights(); // Only fetch insights if there's content
    } else {
      setError("No content available for insights.");
      setLoading(false);
    }
    
    // Check if the article is saved
    const checkSavedStatus = async () => {
      if (user && article.id) {
        try {
          const isSaved = await isArticleSaved(article.id);
          setSaved(isSaved);
        } catch (error) {
          console.error('Error checking saved status:', error);
        }
      }
    };
    
    if (user) {
      checkSavedStatus();
    }
  }, [article, user]);

  // Make sure blur is visible even when API is not available
  useEffect(() => {
    // If insights are still loading after 5 seconds, show default cards
    let timer = setTimeout(() => {
      if (loading) {
        console.log("API connection taking too long, using default insights");
        setLoading(false);
        setInsights([
          {
            title: "Key Points",
            description: "This article highlights important market trends and financial news that could affect your investment decisions.",
          },
          {
            title: "Potential Impact on Stocks",
            description: "Market analysts suggest this news could influence stock prices in the related sectors. Monitor relevant company performance closely.",
            impact_level: "medium",
            affected_assets: ["Stocks"]
          },
          {
            title: "Recommended Actions",
            description: "Consider the broader market context. Stay informed about industry developments. Consult with a financial advisor for personalized guidance.",
          }
        ]);
      }
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [loading]);

  const handleSaveToggle = async () => {
    if (!user) {
      Alert.alert(
        "Sign In Required", 
        "Please sign in to save articles",
        [{ text: "OK", onPress: () => console.log("OK Pressed") }]
      );
      return;
    }

    try {
      if (saved) {
        // Optimistically update UI
        setSaved(false);
        
        // Call API to unsave
        await unsaveArticle(article.id);
      } else {
        // Optimistically update UI
        setSaved(true);
        
        // Call API to save
        await saveArticle(article.id);
      }
    } catch (error) {
      // Revert UI on error
      setSaved(!saved);
      console.error('Error toggling saved status:', error);
      
      Alert.alert(
        "Error", 
        "Failed to save/unsave article. Please try again.",
        [{ text: "OK", onPress: () => console.log("OK Pressed") }]
      );
    }
  };

  const handleOpenArticle = () => {
    if (article.url) {
      console.log('Opening URL in browser:', article.url);
      Linking.openURL(article.url).catch(err => {
        console.error('Error opening URL:', err);
        Alert.alert('Error', 'Could not open the article link. Please try again later.');
      });
    }
  };

  // Format the publication date
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Determine which icon to use based on article content
  const getPlaceholderIcon = () => {
    const title = article.title?.toLowerCase() || '';
    const description = article.description?.toLowerCase() || '';
    const content = article.content?.toLowerCase() || '';
    const source = article.source?.name?.toLowerCase() || '';
    const combinedText = `${title} ${description} ${content} ${source}`;
    
    // Financial/Market news
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

  // Get category name based on the icon
  const getCategoryName = () => {
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

  // Get category color based on the icon
  const getCategoryColor = () => {
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

  // Add a rendering section to show insights usage for non-subscribed users
  const renderInsightUsage = () => {
    if (isSubscribed) return null; // Don't show for subscribed users
    
    // Handle upgrade button click based on login status
    const handleUpgradeClick = () => {
      if (!user) {
        redirectToLogin(navigation, {
          message: 'Please log in to subscribe to premium features',
          redirectAfterLogin: true,
          redirectRoute: 'ArticleDetails',
          articleData: article
        });
      } else {
        showCustomPaywall(navigation);
      }
    };
    
    return (
      <View style={styles.insightUsageContainer}>
        <Text style={styles.insightUsageText}>
          {user ? 'Upgrade to unlock all market insights' : 'Log in and subscribe to unlock all insights'}
        </Text>
        <TouchableOpacity 
          style={styles.upgradeButton} 
          onPress={handleUpgradeClick}
        >
          <Text style={styles.upgradeButtonText}>
            {user ? 'Upgrade to Pro' : 'Log In'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderInsightCard = (insight, index, articleId, marketType) => {
    return (
      <View key={index} style={styles.insightCardWrapper}>
        <InsightCard 
          insight={insight} 
          index={index}
          articleId={articleId}
          marketType={marketType}
        />
      </View>
    );
  };

  // Add a new function to handle article content unlock
  const handleArticleUnlock = () => {
    // Check if user is logged in first
    if (!user) {
      redirectToLogin(navigation, {
        message: 'Please log in to access premium content',
        redirectAfterLogin: true,
        redirectRoute: 'ArticleDetails',
        articleData: article // Pass article data to return to the same article
      });
      return;
    }
    
    setArticleContentLocked(false);
    setHasAttemptedUnlock(true);
    
    // Show paywall if not subscribed
    if (!isSubscribed) {
      setTimeout(() => {
        showCustomPaywall(navigation);
      }, 300);
    }
  };

  // Simplified overlay implementation matching your example
  const OverlayExample = () => (
    <View style={styles.articleContentWrapper}>
      {/* Article Content */}
      <Text style={styles.snippet}>{article.content}</Text>
      
      {/* Overlay Implementation */}
      <View style={styles.overlayContainer}>
        <ImageBackground
          source={{ uri: article.urlToImage }}
          style={styles.imageBackground}
        >
          <View style={styles.overlay}>
            <Text style={styles.overlayIcon}>🔓</Text>
            <Text style={styles.overlayText}>Tap to unlock premium content</Text>
          </View>
        </ImageBackground>
      </View>
    </View>
  );

  // Now modify the renderInsightsSection function to use the new component
  // Find the insights loading state in the renderInsightsSection function and replace it

  const renderInsightsSection = () => {
    // When insights are loading, show the advanced loading indicator
    if (loading) {
      return <InsightLoadingIndicator />;
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#F44336" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }

    // Determine market type based on article category or tags
    const getMarketType = () => {
      const category = article.category || '';
      const title = article.title || '';
      const content = article.content || '';
      
      // Check for commodity indicators
      if (
        category.toLowerCase().includes('commodit') ||
        title.toLowerCase().includes('gold') ||
        title.toLowerCase().includes('oil') ||
        title.toLowerCase().includes('commodit') ||
        content.toLowerCase().includes('commodit') ||
        content.toLowerCase().includes('precious metal') ||
        content.toLowerCase().includes('crude oil')
      ) {
        return 'commodities';
      }
      
      // Check for forex indicators
      if (
        category.toLowerCase().includes('forex') ||
        category.toLowerCase().includes('currency') ||
        title.toLowerCase().includes('forex') ||
        title.toLowerCase().includes('currency') ||
        title.toLowerCase().includes('dollar') ||
        title.toLowerCase().includes('euro') ||
        title.toLowerCase().includes('yen') ||
        content.toLowerCase().includes('exchange rate') ||
        content.toLowerCase().includes('currency pair')
      ) {
        return 'forex';
      }
      
      // Check for crypto indicators
      if (
        category.toLowerCase().includes('crypto') ||
        title.toLowerCase().includes('bitcoin') ||
        title.toLowerCase().includes('crypto') ||
        title.toLowerCase().includes('blockchain') ||
        content.toLowerCase().includes('cryptocurrency') ||
        content.toLowerCase().includes('bitcoin') ||
        content.toLowerCase().includes('ethereum')
      ) {
        return 'crypto';
      }
      
      // Default to stocks
      return 'stocks';
    };

    // Get market type for this article
    const marketType = getMarketType();
    
    // Use article ID or generate one if not available
    const articleId = article.id || article.url || article.title || Math.random().toString(36).substring(2, 10);
    
    return (
      <View style={styles.insightsCardContainer}>
        {insights.map((insight, index) => (
          <View key={index} style={styles.insightCardWrapper}>
            <InsightCard 
              insight={insight} 
              index={index} 
              articleId={articleId}
              marketType={marketType}
            />
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Article Details" />
        {user && (
          <Appbar.Action 
            icon={saved ? "bookmark" : "bookmark-outline"} 
            onPress={handleSaveToggle} 
          />
        )}
      </Appbar.Header>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Article Image */}
        {article.urlToImage && !imageError ? (
          <Image 
            source={{ uri: article.urlToImage }} 
            style={styles.image} 
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={[styles.placeholderImage, { backgroundColor: `${getCategoryColor()}15` }]}>
            <MaterialCommunityIcons name={getPlaceholderIcon()} size={72} color={getCategoryColor()} />
            <Text style={[styles.categoryText, { color: getCategoryColor() }]}>{getCategoryName()}</Text>
          </View>
        )}

        {/* Article Details */}
        <View style={styles.articleContainer}>
          <Text style={styles.title}>{article.title}</Text>
          
          {/* Cover article content with premium overlay */}
          <View style={styles.articleContentWrapper}>
            <Text style={styles.snippet}>{article.content || 'No content available'}</Text>
            <Text style={styles.description}>{article.description}</Text>
            
            {/* Premium overlay for article content */}
            {!isSubscribed && articleContentLocked && (
              <Animated.View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                borderWidth: 2,
                borderColor: '#FFD700',
                borderRadius: 8,
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 999,
                transform: [{scale: pulseAnim}]
              }}>
                <LinearGradient
                  colors={['rgba(0,0,0,0.8)', 'rgba(20,20,20,0.9)', 'rgba(0,0,0,0.8)']}
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    borderRadius: 6,
                  }}
                />
                <TouchableOpacity
                  style={{
                    width: '100%',
                    height: '100%',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  onPress={handleArticleUnlock}
                  activeOpacity={0.7}
                >
                  <Animated.View
                    style={{
                      padding: 20,
                      borderRadius: 30,
                      backgroundColor: glowColor,
                    }}
                  >
                    <MaterialCommunityIcons name="lock-open-outline" size={40} color="#FFFFFF" />
                  </Animated.View>
                  <Text style={{
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: '#FFFFFF',
                    marginTop: 16,
                    textAlign: 'center',
                    paddingHorizontal: 20,
                  }}>TAP TO READ FULL ARTICLE</Text>
                  <Text style={{
                    fontSize: 14,
                    color: '#FFFFFF',
                    marginTop: 8,
                    textAlign: 'center',
                    paddingHorizontal: 20,
                    opacity: 0.8,
                  }}>Premium content requires subscription</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>

          <View style={styles.sourceContainer}>
            <Text style={styles.source}>{article.source?.name || 'Unknown source'}</Text>
            <Text style={styles.date}>{formatDate(article.publishedAt)}</Text>
          </View>
          
          <Button 
            mode="contained" 
            style={styles.readMoreButton}
            onPress={handleOpenArticle}
          >
            Read Full Article
          </Button>
        </View>

        <Divider style={styles.divider} />

        {/* Add insight usage indicator right before the analysis section */}
        {!loading && article && renderInsightUsage()}

        {/* Market Insights Section */}
        <View style={styles.insightsContainer}>
          <Text style={styles.insightsTitle}>Market Insights</Text>
          <Text style={styles.insightsSubtitle}>
            How this news might affect the stock market
          </Text>

          {renderInsightsSection()}
        </View>

        {IS_DEBUG_MODE && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugText}>
              Subscription: {isSubscribed ? "ACTIVE" : "INACTIVE"}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007AFF',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  image: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  placeholderImage: {
    height: 250,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 16,
    color: '#666666',
  },
  categoryText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  articleContainer: {
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  snippet: {
    fontSize: 16,
    lineHeight: 24,
    color: '#444',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  sourceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  source: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  date: {
    fontSize: 14,
    color: '#666',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    marginBottom: 16,
    fontWeight: '500',
  },
  readMoreButton: {
    marginTop: 8,
    backgroundColor: '#007AFF',
    borderRadius: 0,
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 24,
  },
  insightsContainer: {
    padding: 16,
  },
  insightsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  insightsSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  loadingSpinner: {
    marginBottom: 16,
  },
  loadingMessage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 12,
    color: '#888888',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  errorCard: {
    marginTop: 16,
    backgroundColor: '#ffebee',
    borderRadius: 0,
  },
  errorText: {
    color: '#d32f2f',
    textAlign: 'center',
  },
  insightUsageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  insightUsageText: {
    fontSize: 14,
    color: '#666666',
    flex: 1,
  },
  upgradeButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 8,
  },
  upgradeButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
  },
  insightCardWrapper: {
    position: 'relative',
    marginBottom: 16,
    overflow: 'hidden',
    borderRadius: 8,
  },
  overlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    borderRadius: 8,
    overflow: 'hidden',
  },
  overlayContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 6,
  },
  upgradeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  premiumButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  premiumButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  subscriptionPrompt: {
    padding: 20,
    backgroundColor: '#FFF',
    marginVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFD700',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  subscriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
    color: '#000',
    textAlign: 'center',
  },
  subscriptionMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
    lineHeight: 20,
  },
  subscribeButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    marginTop: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  subscribeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  debugContainer: {
    backgroundColor: '#FFEB3B',
    padding: 8,
    margin: 8,
    borderRadius: 4,
  },
  debugText: {
    color: '#000',
    fontSize: 12,
  },
  articleContentWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  articleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  imageBackground: {
    flex: 1,
    resizeMode: 'cover',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayIcon: {
    fontSize: 40,
    color: '#FFD700',
    marginBottom: 10,
  },
  overlayText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#ffebee',
    borderRadius: 8,
  },
  insightsCardContainer: {
    padding: 16,
  },
});

export default ArticleDetailsScreen;
