import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, FlatList, View, ActivityIndicator, RefreshControl, Linking, Animated, Easing, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import NewsCard from '../components/NewsCard';
import StockTicker from '../components/StockTicker';
import { getNewsHeadlines } from '../api/newsService';
import { getNewsApiUrl } from '../api/config';
import GridBackground from '../components/GridBackground';
import WeeklyInsightsBlock from '../components/WeeklyInsightsBlock';

// Test function to check API connectivity
const testApiConnection = async () => {
  try {
    console.log('Testing API connection to:', getNewsApiUrl());
    const response = await fetch(`${getNewsApiUrl()}`);
    const data = await response.json();
    console.log('API test response:', data);
    return true;
  } catch (error) {
    console.error('API connection test failed:', error);
    return false;
  }
};

const { width, height } = Dimensions.get('window');

const LoadingSpinner = () => {
  const spinValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleValue, {
          toValue: 1.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleValue, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    spin.start();
    pulse.start();

    return () => {
      spin.stop();
      pulse.stop();
    };
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.spinnerContainer}>
      <Animated.View
        style={[
          styles.spinnerOuter,
          {
            transform: [{ rotate: spin }, { scale: scaleValue }],
          },
        ]}
      >
        <View style={styles.spinnerInner} />
      </Animated.View>
      <Text style={styles.loadingText}>Loading news...</Text>
    </View>
  );
};

const NewsScreen = ({ navigation }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [scrollY] = useState(new Animated.Value(0));

  // Animation values
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [1, 0.98],
    extrapolate: 'clamp',
  });

  const fetchNews = async () => {
    try {
      setError(null);
      const response = await getNewsHeadlines();
      console.log('News data received:', response);
      
      // Check if response has the expected structure
      let newsData = [];
      
      if (response && response.articles) {
        // If response has articles property (standard NewsAPI format)
        newsData = response.articles;
      } else if (Array.isArray(response)) {
        // If response is already an array
        newsData = response;
      } else if (response && typeof response === 'object') {
        // If response is an object but not in the expected format
        console.log('Unexpected response format, trying to extract articles');
        // Try to find an array property that might contain the articles
        const possibleArrayProps = Object.keys(response).filter(key => 
          Array.isArray(response[key]) && response[key].length > 0
        );
        
        if (possibleArrayProps.length > 0) {
          // Use the first array property found
          newsData = response[possibleArrayProps[0]];
          console.log(`Using data from '${possibleArrayProps[0]}' property`);
        } else {
          // No array found, create a single item from the response
          console.log('No array found in response, creating a single item');
          newsData = [response];
        }
      }
      
      console.log('Processed news data:', newsData);
      
      // Ensure each article has an ID
      const articlesWithIds = newsData.map((article, index) => ({
        ...article,
        id: article.id || article._id || `article-${index}`,
        animationDelay: index * 100,
      }));
      
      setNews(articlesWithIds);
    } catch (err) {
      console.error('Error fetching news:', err);
      setError('Failed to load news. Please try again later.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Test API connection first
    testApiConnection().then(isConnected => {
      if (isConnected) {
        console.log('API connection successful, fetching news...');
        fetchNews();
      } else {
        console.error('API connection failed, not fetching news');
        setError('Failed to connect to the API. Please check your internet connection and try again.');
        setLoading(false);
      }
    });
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNews();
  };

  const handleArticlePress = (article) => {
    // Open the article directly in the device's browser
    if (article.url) {
      console.log('Opening URL in browser:', article.url);
      Linking.openURL(article.url).catch(err => {
        console.error('Error opening URL:', err);
        Alert.alert('Error', 'Could not open the article link. Please try again later.');
      });
    } else {
      console.log('No URL available for article:', article.title);
    }
  };

  const handleCloseBrowser = () => {
    setBrowserVisible(false);
  };

  const renderItem = ({ item, index }) => (
    <NewsCard
      article={item}
      onPress={() => handleArticlePress(item)}
      index={index}
    />
  );

  const renderListItem = ({ item, index }) => {
    // Insert the weekly insights block after the third article
    if (index === 3) {
      return (
        <>
          <NewsCard
            article={item}
            onPress={() => handleArticlePress(item)}
            index={index}
          />
          {/* Weekly Insights with explicit check for user premium status */}
          <WeeklyInsightsBlock />
        </>
      );
    }
    
    return (
      <NewsCard
        article={item}
        onPress={() => handleArticlePress(item)}
        index={index}
      />
    );
  };

  return (
    <View style={[
      styles.container, 
      { 
        paddingTop: Math.max(insets.top - 10, 0),
        // Remove bottom padding from container to prevent double padding
        paddingBottom: 0
      }
    ]}>
      {/* Grid Background */}
      <GridBackground />
      
      <Animated.View
        style={[
          styles.headerContainer,
          {
            opacity: headerOpacity,
          }
        ]}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.headlineText}>DECODR</Text>
        </View>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <View style={styles.avatarContainer}>
            {user ? (
              <Text style={styles.avatarText}>
                {user.name?.charAt(0) || user.email?.charAt(0)}
              </Text>
            ) : (
              <Text style={styles.avatarText}>N</Text>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
      
      <StockTicker />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Unable to load news</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchNews}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={news}
          renderItem={renderListItem}
          keyExtractor={(item) => item.id || item.title}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 50 } // Adjusted padding for FlatList content
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
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
  },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
    zIndex: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  headlineText: {
    fontFamily: 'OldEnglish',
    fontSize: 24,
    color: '#000000',
    letterSpacing: 1,
  },
  profileButton: {
    padding: 5,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 0, // Sharp edges
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Raleway-Regular',
    color: '#666666',
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
    paddingTop: 8,
    zIndex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
    fontFamily: 'Raleway-Medium',
    position: 'absolute',
    bottom: 0,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1,
  },
  errorTitle: {
    fontSize: 18,
    color: '#FF3B30',
    textAlign: 'center',
    fontFamily: 'Raleway-Regular',
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    fontFamily: 'Raleway-Regular',
  },
  retryButton: {
    padding: 10,
    borderRadius: 0, // Sharp edges
    backgroundColor: '#f0f0f0',
    marginTop: 10,
  },
  retryText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
    fontFamily: 'Raleway-Medium',
  },
  spinnerContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  spinnerOuter: {
    width: 60,
    height: 60,
    borderRadius: 30, // Circular shape
    borderWidth: 4,
    borderColor: '#000000',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerInner: {
    width: 20,
    height: 20,
    borderRadius: 10, // Circular shape
    backgroundColor: '#000000',
  },
  refreshButton: {
    padding: 10,
    borderRadius: 0, // Sharp edges
    backgroundColor: '#f0f0f0',
    marginLeft: 'auto',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
});

export default NewsScreen;
