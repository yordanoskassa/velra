import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Image, ActivityIndicator, Linking } from 'react-native';
import { Appbar, Text, Button, Divider, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import InsightCard from '../components/InsightCard';
import { getMarketInsights } from '../api/newsService';

const ArticleDetailsScreen = ({ route, navigation }) => {
  const { article } = route.params;
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageError, setImageError] = useState(false);

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
        
        // Transform the response data into the format expected by InsightCard
        if (response && response.key_points && Array.isArray(response.key_points)) {
          // Create three insight cards from the key points
          const formattedInsights = response.key_points.slice(0, 3).map((point, index) => {
            // Determine impact level based on index or other factors
            const impactLevels = ['high', 'medium', 'low'];
            const impactLevel = impactLevels[index % impactLevels.length];
            
            return {
              title: `Key Insight ${index + 1}`,
              description: point,
              impact_level: impactLevel,
              confidence: response.confidence_score || 75,
              affected_assets: []
            };
          });
          
          setInsights(formattedInsights);
        } else {
          setInsights([]);
        }
      } catch (err) {
        console.error("Error fetching insights:", err);
        setError("Failed to load market insights. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
  
    if (article?.content) {
      fetchInsights(); // ✅ Ensure article has content before fetching insights
    } else {
      setError("No content available for insights.");
      setLoading(false);
    }
  }, [article]); // ✅ Use `article` as dependency instead of `articleId`
  

  const handleOpenArticle = () => {
    if (article.url) {
      Linking.openURL(article.url);
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

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Article Details" />
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
          <View style={styles.sourceContainer}>
            <Text style={styles.source}>{article.source?.name || 'Unknown source'}</Text>
            <Text style={styles.date}>{formatDate(article.publishedAt)}</Text>
          </View>
          <Text style={styles.description}>{article.description}</Text>
          <Text style={styles.content}>{article.content || 'No content available'}</Text>
          
          <Button 
            mode="contained" 
            style={styles.readMoreButton}
            onPress={handleOpenArticle}
          >
            Read Full Article
          </Button>
        </View>

        <Divider style={styles.divider} />

        {/* Market Insights Section */}
        <View style={styles.insightsContainer}>
          <Text style={styles.insightsTitle}>Market Insights</Text>
          <Text style={styles.insightsSubtitle}>
            How this news might affect the stock market
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Analyzing market impact...</Text>
            </View>
          ) : error ? (
            <Card style={styles.errorCard}>
              <Card.Content>
                <Text style={styles.errorText}>{error}</Text>
              </Card.Content>
            </Card>
          ) : (
            insights.map((insight, index) => (
              <InsightCard key={index} insight={insight} index={index} />
            ))
          )}
        </View>
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
  content: {
    fontSize: 16,
    lineHeight: 24,
    color: '#444',
    marginBottom: 20,
  },
  readMoreButton: {
    marginTop: 8,
    backgroundColor: '#007AFF',
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
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#555',
  },
  errorCard: {
    marginTop: 16,
    backgroundColor: '#ffebee',
  },
  errorText: {
    color: '#d32f2f',
    textAlign: 'center',
  },
});

export default ArticleDetailsScreen;
