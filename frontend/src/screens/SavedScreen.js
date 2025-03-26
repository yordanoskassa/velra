import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, ActivityIndicator, Text, Animated, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useTheme, Button, Divider } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useSavedArticles } from '../context/SavedArticlesContext';
import NewsCard from '../components/NewsCard';
import { getWeeklyPicks } from '../api/newsService';
import GridBackground from '../components/GridBackground';
import { useSubscription } from '../context/SubscriptionContext';

const LoadingSpinner = () => {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#000000" />
      <Text style={styles.loadingText}>Loading articles...</Text>
    </View>
  );
};

const EmptyStateView = ({ isSavedTab, isSubscribed, onSubscribe }) => {
  return (
    <View style={styles.emptyStateContainer}>
      <Text style={styles.emptyStateTitle}>
        {isSavedTab ? "No Saved Articles" : "Weekly Picks"}
      </Text>
      <Text style={styles.emptyStateText}>
        {isSavedTab 
          ? "Articles you save will appear here. Tap the bookmark icon on any article to add it to your saved list."
          : isSubscribed 
            ? "Check back later for this week's top market insights based on key financial topics."
            : "Weekly Picks are a premium feature only available to DECODR PRO subscribers. Subscribe to access exclusive weekly financial insights."
        }
      </Text>
      
      {/* Show subscribe button for non-subscribers on weekly picks tab */}
      {!isSavedTab && !isSubscribed && (
        <Button 
          mode="contained" 
          onPress={onSubscribe}
          style={styles.subscribeButton}
          labelStyle={styles.subscribeButtonText}
        >
          Subscribe to DECODR PRO
        </Button>
      )}
    </View>
  );
};

const ErrorView = ({ error, onRetry }) => {
  return (
    <View style={styles.errorContainer}>
      <MaterialIcons name="error-outline" size={50} color="#FF3B30" />
      <Text style={styles.errorTitle}>Failed to Load Articles</Text>
      <Text style={styles.errorText}>{error}</Text>
      <Button 
        mode="contained" 
        onPress={onRetry} 
        style={styles.retryButton}
        labelStyle={styles.retryButtonText}
      >
        Try Again
      </Button>
    </View>
  );
};

const TabSelector = ({ activeTab, onTabChange }) => {
  return (
    <View style={styles.tabSelector}>
      <TouchableOpacity 
        style={[styles.tab, activeTab === 'saved' && styles.activeTab]} 
        onPress={() => onTabChange('saved')}
      >
        <Text style={[styles.tabText, activeTab === 'saved' && styles.activeTabText]}>Saved</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.tab, activeTab === 'weekly' && styles.activeTab]} 
        onPress={() => onTabChange('weekly')}
      >
        <View style={styles.tabContentRow}>
          <Text style={[styles.tabText, activeTab === 'weekly' && styles.activeTabText]}>Weekly Picks</Text>
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumText}>PRO</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const SavedScreen = ({ navigation }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { savedArticles, isLoading, error, refreshSavedArticles, unsaveArticle } = useSavedArticles();
  const { isSubscribed, showCustomPaywall } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);
  const [scrollY] = useState(new Animated.Value(0));
  const [activeTab, setActiveTab] = useState('saved');
  const [weeklyPicks, setWeeklyPicks] = useState([]);
  const [weeklyPicksLoading, setWeeklyPicksLoading] = useState(false);
  const [weeklyPicksError, setWeeklyPicksError] = useState(null);

  // Animation values
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [1, 0.98],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    if (user) {
      if (activeTab === 'saved') {
        fetchSavedArticles();
      } else if (isSubscribed) {
        // Only fetch weekly picks if user is subscribed
        fetchWeeklyPicks();
      } else {
        // Show paywall if user tries to access weekly picks tab via direct URL or state change
        console.log('Non-subscribed user attempting to access weekly picks via state change, showing paywall');
        showCustomPaywall();
        // Force back to saved tab
        setActiveTab('saved');
      }
    }
  }, [user, activeTab, isSubscribed]);

  const fetchSavedArticles = () => {
    try {
      console.log('Fetching saved articles from SavedScreen');
      refreshSavedArticles();
    } catch (err) {
      console.error('Error in fetchSavedArticles:', err);
    }
  };

  const fetchWeeklyPicks = async () => {
    try {
      // Check subscription status first
      if (!isSubscribed) {
        console.log('Non-subscribed user attempting to access weekly picks, showing paywall');
        showCustomPaywall();
        setWeeklyPicks([]);
        setWeeklyPicksLoading(false);
        return;
      }
      
      setWeeklyPicksLoading(true);
      setWeeklyPicksError(null);
      
      // Try to fetch the weekly picks from the backend
      console.log('Fetching weekly picks from backend...');
      const response = await getWeeklyPicks();
      
      if (response && response.articles && response.articles.length > 0) {
        console.log(`Loaded ${response.articles.length} weekly picks from backend`);
        
        // Transform to match the format expected by NewsCard
        const formattedArticles = response.articles.map(article => {
          // Get the appropriate image URL
          const imageUrl = article.photo_url || article.thumbnail_url || 
                          (article.urlToImage ? article.urlToImage : null);
          
          // Create a properly formatted article object
          return {
            id: article._id,
            title: article.title || "",
            url: article.link || article.url || "",
            urlToImage: imageUrl,
            publishedAt: article.published_datetime_utc || article.publishedAt,
            content: article.snippet || article.content || "",
            source: {
              name: article.source_name || (article.source ? article.source.name : "News Source")
            },
            author: Array.isArray(article.authors) 
              ? article.authors.join(', ') 
              : (article.author || article.authors || ""),
            category: article.weekly_pick_categories && article.weekly_pick_categories.length > 0 
              ? article.weekly_pick_categories[0] 
              : "business",
            weekly_pick_categories: article.weekly_pick_categories || ["recent"]
          };
        });
        
        setWeeklyPicks(formattedArticles);
        console.log('Weekly picks loaded successfully');
      } else {
        console.log('No weekly picks returned from API');
        setWeeklyPicks([]);
      }
    } catch (err) {
      console.error('Error fetching weekly picks:', err);
      setWeeklyPicksError('Failed to load weekly picks. Please try again.');
    } finally {
      setWeeklyPicksLoading(false);
    }
  };

  const handleRetry = () => {
    if (activeTab === 'saved') {
      console.log('Retrying saved articles fetch');
      fetchSavedArticles();
    } else {
      console.log('Retrying weekly picks fetch');
      fetchWeeklyPicks();
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'saved') {
      await refreshSavedArticles();
    } else {
      await fetchWeeklyPicks();
    }
    setRefreshing(false);
  };

  const handleTabChange = (tab) => {
    if (tab === 'weekly' && !isSubscribed) {
      console.log('Non-subscribed user attempting to switch to weekly picks tab, showing paywall');
      showCustomPaywall();
      // Stay on saved tab
      return;
    }
    setActiveTab(tab);
  };

  const handleArticlePress = (article) => {
    navigation.navigate('ArticleDetails', { article });
  };

  const handleUnsaveArticle = async (articleId) => {
    try {
      console.log(`Attempting to unsave article: ${articleId}`);
      await unsaveArticle(articleId);
      console.log(`Successfully unsaved article: ${articleId}`);
    } catch (err) {
      console.error(`Error unsaving article ${articleId}:`, err);
      Alert.alert(
        "Error",
        "There was a problem removing this article from your saved list. Please try again.",
        [{ text: "OK" }]
      );
    }
  };

  const handleSubscribe = () => {
    console.log('User clicked subscribe from Weekly Picks tab');
    showCustomPaywall();
  };

  // Helper function to format category names
  const formatCategoryName = (category) => {
    switch(category) {
      case 'economicIndicators': return 'Economy';
      case 'centralBank': return 'Central Bank';
      case 'earnings': return 'Earnings';
      case 'corporateActions': return 'Corporate';
      case 'globalGeopolitical': return 'Geopolitical';
      case 'recent': return 'Recent';
      default: return category.charAt(0).toUpperCase() + category.slice(1);
    }
  };

  // Helper function to get category color
  const getCategoryColor = (category) => {
    switch(category) {
      case 'economicIndicators': return '#4CAF50';  // Green 
      case 'centralBank': return '#2196F3';         // Blue
      case 'earnings': return '#FF9800';            // Orange
      case 'corporateActions': return '#9C27B0';    // Purple
      case 'globalGeopolitical': return '#F44336';  // Red
      case 'recent': return '#607D8B';              // Blue Gray
      default: return '#9E9E9E';                    // Gray
    }
  };

  // Custom renderer for articles with category badges
  const renderItem = ({ item, index }) => {
    // Check if it's a weekly pick with categories
    const hasCategories = activeTab === 'weekly' && 
                         item.weekly_pick_categories && 
                         item.weekly_pick_categories.length > 0;
    
    return (
      <View style={styles.articleContainer}>
        {hasCategories && (
          <View style={styles.categoryContainer}>
            {item.weekly_pick_categories.map((category, idx) => (
              <View 
                key={idx} 
                style={[
                  styles.categoryBadge, 
                  { backgroundColor: getCategoryColor(category) }
                ]}
              >
                <Text style={styles.categoryText}>{formatCategoryName(category)}</Text>
              </View>
            ))}
          </View>
        )}
        <NewsCard 
          article={item}
          onPress={() => handleArticlePress(item)}
          index={index}
          isSavedScreen={activeTab === 'saved'}
          onSaveToggle={() => handleUnsaveArticle(item.id)}
        />
      </View>
    );
  };

  if (!user) {
    return (
      <View style={styles.notLoggedInContainer}>
        <GridBackground />
        <View style={styles.notLoggedInContent}>
          <Text style={styles.notLoggedInTitle}>My Articles</Text>
          <Text style={styles.notLoggedInText}>
            Sign in to save articles and access your personalized content.
          </Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => navigation.navigate('Welcome')}
          >
            <Text style={styles.loginButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Determine which data to show based on active tab
  const isCurrentLoading = activeTab === 'saved' ? isLoading : weeklyPicksLoading;
  const currentError = activeTab === 'saved' ? error : weeklyPicksError;
  const currentArticles = activeTab === 'saved' ? savedArticles : weeklyPicks;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Grid Background */}
      <GridBackground />
      
      {/* Header */}
      <Animated.View 
        style={[
          styles.header, 
          { opacity: headerOpacity }
        ]}
      >
        <Text style={styles.headerTitle}>
          My Articles
        </Text>
        <TabSelector activeTab={activeTab} onTabChange={handleTabChange} />
      </Animated.View>

      {isCurrentLoading && !refreshing ? (
        <LoadingSpinner />
      ) : currentError ? (
        <ErrorView error={currentError} onRetry={handleRetry} />
      ) : currentArticles.length === 0 ? (
        <EmptyStateView 
          isSavedTab={activeTab === 'saved'} 
          isSubscribed={isSubscribed}
          onSubscribe={handleSubscribe} 
        />
      ) : (
        <FlatList
          data={currentArticles}
          renderItem={renderItem}
          keyExtractor={(item) => item.id || String(item.title)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh}
              colors={['#000000']}
              tintColor="#000000"
            />
          }
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  header: {
    height: 60,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    justifyContent: 'center',
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter-SemiBold',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666666',
    fontFamily: 'Inter-Regular',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 12,
    color: '#000000',
    fontFamily: 'Inter-SemiBold',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666666',
    marginBottom: 20,
    fontFamily: 'Inter-Regular',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#000000',
    paddingHorizontal: 16,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
    fontFamily: 'Inter-SemiBold',
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666666',
    fontFamily: 'Inter-Regular',
  },
  notLoggedInContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  notLoggedInContent: {
    padding: 32,
    alignItems: 'center',
    maxWidth: 320,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  notLoggedInTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#000000',
    fontFamily: 'Inter-Bold',
  },
  notLoggedInText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666666',
    marginBottom: 8,
    fontFamily: 'Inter-Regular',
  },
  loginButton: {
    marginTop: 24,
    backgroundColor: '#000000',
    paddingHorizontal: 48,
    paddingVertical: 12,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  tabSelector: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 10,
  },
  tab: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  tabText: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'Inter-Regular',
  },
  activeTabText: {
    color: '#000000',
    fontWeight: 'bold',
    fontFamily: 'Inter-SemiBold',
  },
  articleContainer: {
    marginBottom: 16,
    zIndex: 1,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 8,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 2,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  tabContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumBadge: {
    backgroundColor: '#FFD700',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginLeft: 6,
  },
  premiumText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
  },
  subscribeButton: {
    marginTop: 24,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFD700',
  },
  subscribeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
});

export default SavedScreen; 