import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, FlatList, View, ActivityIndicator, RefreshControl, Linking, Animated, Easing } from 'react-native';
import { Appbar, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NewsCard from '../components/NewsCard';
import { getNewsHeadlines } from '../api/newsService';

const LoadingSpinner = () => {
  const spinValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const spin = Animated.loop(
      Animated.sequence([
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleValue, {
          toValue: 1.2,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleValue, {
          toValue: 1,
          duration: 1000,
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
    </View>
  );
};

const NewsScreen = ({ navigation }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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
      const newsData = await getNewsHeadlines();
      console.log('News data received:', newsData);
      
      // Add animation delay to each item
      // The getNewsHeadlines function now ensures each article has an ID
      const articlesWithDelay = (newsData || []).map((article, index) => ({
        ...article,
        animationDelay: index * 100,
      }));
      
      setNews(articlesWithDelay);
    } catch (err) {
      console.error('Error fetching news:', err);
      setError('Failed to load news. Please try again later.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNews();
  };

  const handleArticlePress = (article) => {
    // Open the full article in the browser
    if (article.url) {
      console.log('Opening URL:', article.url);
      Linking.openURL(article.url).catch(err => {
        console.error('Error opening URL:', err);
        // Show a fallback message if URL can't be opened
        alert('Could not open the article link. Please try again later.');
      });
    } else {
      console.log('No URL available for article:', article.title);
    }
  };

  const renderItem = ({ item, index }) => (
    <Animated.View
      style={{
        opacity: 1,
        transform: [{ 
          translateY: 0 
        }],
        marginBottom: 16,
      }}
    >
      <NewsCard 
        article={item} 
        onPress={() => handleArticlePress(item)}
        index={index}
      />
    </Animated.View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Animated.View
        style={[
          styles.headerContainer,
          {
            opacity: headerOpacity,
          }
        ]}
      >
        <Text style={styles.headlineText}>HEADLINE</Text>
        <Text style={styles.decoderText}>DECODER</Text>
      </Animated.View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
          <Text style={styles.loadingText}>Loading latest news...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <Animated.FlatList
          data={news}
          renderItem={renderItem}
          keyExtractor={(item, index) => `news-${index}-${item.title}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
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
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  headlineText: {
    fontFamily: 'Times New Roman',
    fontSize: 28,
    color: '#000000',
    letterSpacing: 1,
  },
  decoderText: {
    fontFamily: 'Courier',
    fontSize: 28,
    color: '#666666',
    letterSpacing: 2,
    marginLeft: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#666666',
    marginTop: 4,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loader: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
    fontFamily: 'Inter_400Regular',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  spinnerContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerOuter: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: '#000000',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#000000',
  },
});

export default NewsScreen;
