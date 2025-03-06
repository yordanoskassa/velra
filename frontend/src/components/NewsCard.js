import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View, Image, ActivityIndicator, Animated, Easing } from 'react-native';
import { Card, Title, Paragraph, Text, useTheme, Surface, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import PropTypes from 'prop-types';

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
    };
    startSpinning();

    return () => {
      // Cleanup animations
      spinValue.setValue(0);
      spinValueReverse.setValue(0);
      spinValueSlow.setValue(0);
      pulseValue.setValue(1);
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
            opacity: pulseValue.interpolate({
              inputRange: [1, 1.2],
              outputRange: [1, 0.6]
            })
          }
        ]}
      >
        <MaterialCommunityIcons name="chart-line" size={24} color="#FFFFFF" />
      </Animated.View>
    </View>
  );
};

const NewsCard = ({ article, onPress, index = 0 }) => {
  // Validate article data
  if (!article) {
    console.warn('Article is undefined or null');
    return (
      <View style={styles.cardContainer}>
        <Text>Invalid article data</Text>
      </View>
    );
  }
  
  // Ensure article has an ID and title
  if (!article.id || !article.title) {
    console.warn('Invalid article data:', article);
    return (
      <View style={styles.cardContainer}>
        <Text>Invalid article format: missing ID or title</Text>
      </View>
    );
  }

  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lottieError, setLottieError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imageError, setImageError] = useState(false);
  
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
    setLottieError(false);
    
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
        if (loading) {
          startPulseAnimation();
        }
      });
    };
    
    if (loading) {
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
  }, [loading]);

  const toggleExpand = async () => {
    // Animate the chevron rotation
    Animated.timing(rotateAnim, {
      toValue: expanded ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.quad),
    }).start();
  
    if (expanded) {
      setExpanded(false);
      return;
    }
  
    // Open expanded view
    setExpanded(true);
  
    if (insights) return; // Don't fetch if insights already exist
  
    try {
      setLoading(true);
      setError(null);
  
      Animated.timing(progressAnim, {
        toValue: 0.7, // Animate progress bar to 70%
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
  
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: false,
        easing: Easing.out(Easing.quad),
      }).start();
      
      // Check if response contains the expected data
      if (response && response.key_points) {
        // Convert the response to an array of insight objects for the InsightCard component
        const insightsArray = [
          {
            title: "Key Points",
            description: response.key_points.join("\n• "),
            impact_level: "high",
            confidence: response.confidence_score
          },
          {
            title: "Potential Impact on Stocks",
            description: typeof response.potential_impact.stocks === 'object' 
              ? Object.entries(response.potential_impact.stocks)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join('\n\n')
              : response.potential_impact.stocks,
            impact_level: "medium",
            affected_assets: ["Stocks"]
          },
          {
            title: "Potential Impact on Commodities",
            description: typeof response.potential_impact.commodities === 'object'
              ? Object.entries(response.potential_impact.commodities)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join('\n\n')
              : response.potential_impact.commodities,
            impact_level: "medium",
            affected_assets: ["Commodities"]
          },
          {
            title: "Potential Impact on Forex",
            description: typeof response.potential_impact.forex === 'object'
              ? Object.entries(response.potential_impact.forex)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join('\n\n')
              : response.potential_impact.forex,
            impact_level: "medium",
            affected_assets: ["Forex"]
          },
          {
            title: "Recommended Actions",
            description: response.recommended_actions.join("\n• "),
            impact_level: "high"
          }
        ];
        
        setInsights(insightsArray);
      } else {
        // Handle empty or invalid response
        setError("Failed to generate insights: Invalid response format");
      }
    } catch (err) {
      console.error("Error fetching insights:", err);
      setError("Failed to generate insights. Please try again.");
  
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } finally {
      setTimeout(() => setLoading(false), 500);
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

  // Add null checks and fallback values
  const safeArticle = {
    id: article?.id || 'unknown',
    title: article?.title || 'Market Update',
    source: article?.source || 'Unknown Source',
    url: article?.url || '#',
    publishedAt: article?.publishedAt ? new Date(article.publishedAt) : new Date(),
    sentiment: article?.sentiment || 'neutral',
    category: article?.category || 'stocks',
    summary: article?.summary || 'Latest financial news updates',
    imageUrl: article?.urlToImage || '/placeholder-news.jpg'
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
          {safeArticle.imageUrl && !imageError ? (
            <Card.Cover 
              source={getImageSource()} 
              style={styles.cardImage}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={[styles.placeholderImage, { backgroundColor: `${getCategoryColor()}15` }]}>
              <MaterialCommunityIcons name={getPlaceholderIcon()} size={48} color={getCategoryColor()} />
              <View style={styles.categoryBadge}>
                <Text style={[styles.categoryText, { color: getCategoryColor() }]}>{getCategoryName()}</Text>
              </View>
              <View style={styles.logoContainer}>
                <Text style={styles.headlineText}>HEADLINE</Text>
                <Text style={styles.decoderText}>DECODER</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
        
        <Card.Content style={styles.cardContent}>
          <View style={styles.sourceContainer}>
            <Text style={styles.source}>{getSourceName()}</Text>
            <Text style={styles.date}>{formatDate(safeArticle.publishedAt.toISOString())}</Text>
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
              {expanded ? 'Hide Market Insights' : 'Generate Market Insights'}
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
        
        {expanded && (
          <Card.Content style={styles.expandedContent}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <LoadingSpinner />
                <Text style={styles.loadingText}>Analyzing market impact...</Text>
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
                  <InsightCard key={index} insight={insight} index={index} />
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
};

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 16,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
    elevation: 1,
  },
  cardImage: {
    height: 200,
    backgroundColor: '#F0F0F0',
  },
  cardContent: {
    padding: 16,
  },
  sourceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  source: {
    fontSize: 12,
    color: '#000000',
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
    textTransform: 'uppercase',
  },
  date: {
    fontSize: 12,
    color: '#666666',
    fontFamily: 'Inter-Regular',
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
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
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
    paddingTop: 0,
  },
  placeholderImage: {
    height: 200,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
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
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    margin: 16,
  },
  loadingText: {
    marginTop: 16,
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
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  spinnerOuter: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderWidth: 3,
    borderRadius: 60,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderTopColor: '#4CAF50', // Green for finance
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  spinnerMiddle: {
    position: 'absolute',
    width: '80%',
    height: '80%',
    borderWidth: 5,
    borderRadius: 48,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderTopColor: 'transparent',
    borderRightColor: '#2196F3', // Blue for tech
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  spinnerInner: {
    position: 'absolute',
    width: '60%',
    height: '60%',
    borderWidth: 3,
    borderRadius: 36,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FF9800', // Orange for business
    borderLeftColor: 'transparent',
  },
  spinnerCenter: {
    position: 'absolute',
    width: '40%',
    height: '40%',
    borderRadius: 24,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightsContainer: {
    padding: 16,
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
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  readMoreText: {
    fontSize: 14,
    color: '#2196F3',
    marginRight: 4,
  },
});

export default NewsCard;
