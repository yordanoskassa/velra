import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getNewsApiUrl } from './config';

// Helper function to extract impact values from raw text
const extractImpactValue = (impactText, assetType) => {
  if (!impactText) return "Impact analysis unavailable";
  
  const regex = new RegExp(`["']?${assetType}["']?\\s*:\\s*["']([^"']+)["']`, 'i');
  const match = impactText.match(regex);
  
  return match ? match[1] : "Impact analysis unavailable";
};

// Helper function to create fallback insights when parsing fails
const createFallbackInsights = () => {
  console.log('Creating fallback insights');
  return {
    key_points: [
      "Unable to generate insights for this article.",
      "Please read the full article for more information."
    ],
    potential_impact: {
      stocks: {
        description: "Without full analysis, we cannot determine specific impacts on stock markets.",
        impact_level: "low"
      },
      commodities: {
        description: "Without full analysis, we cannot determine specific impacts on commodity markets.",
        impact_level: "low"
      },
      forex: {
        description: "Without full analysis, we cannot determine specific impacts on forex markets.",
        impact_level: "low"
      }
    },
    recommended_actions: [
      "Read the full article for more details",
      "Consider the broader market context when evaluating this news"
    ],
    confidence_score: 20,
    fallback: true
  };
};

// Create an Axios instance with the API URL
const api = axios.create({
  baseURL: getNewsApiUrl(),
});

// Add request interceptor for authentication and logging
api.interceptors.request.use(
  async config => {
    // Add JWT token to Authorization header if available
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('Adding auth token to request');
    } else {
      console.log('No auth token available');
    }
    
    console.log(`API Request: ${config.method.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  error => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for logging and handling auth errors
api.interceptors.response.use(
  response => {
    console.log(`API Response: ${response.status} ${response.config.method.toUpperCase()} ${response.config.url}`);
    return response;
  },
  error => {
    if (error.response) {
      console.error(`API Error Response: ${error.response.status} ${error.config.method.toUpperCase()} ${error.config.url}`);
      
      // If we get a 401 Unauthorized, the token might have expired
      if (error.response.status === 401) {
        console.log('Received 401 Unauthorized - token may have expired');
        // We could trigger a logout or token refresh here
        // For now, we'll just clear the token from storage
        AsyncStorage.removeItem('token').then(() => {
          console.log('Cleared expired token from storage');
        });
      }
    } else if (error.request) {
      console.error('API No Response:', error.request);
    } else {
      console.error('API Error:', error.message);
    }
    return Promise.reject(error);
  }
);

/**
 * Get news headlines
 * @param {Object} params - Query parameters
 * @returns {Promise} - Promise with news headlines
 */
export const getNewsHeadlines = async (params = {}) => {
  try {
    console.log('Fetching news headlines from:', getNewsApiUrl());
    console.log('Full URL:', `${getNewsApiUrl()}/api/news`);
    
    // The baseURL already includes '/news', so we just need '/api/news'
    const response = await api.get('/api/news', { params });
    console.log('News API response status:', response.status);
    console.log('News API response data:', response.data);
    
    // Process the response to ensure it's in the expected format
    let processedData = response.data;
    
    // If the response is an object with an 'articles' property (standard NewsAPI format)
    if (processedData && processedData.articles) {
      console.log('Standard NewsAPI format detected');
      return processedData;
    }
    
    // If the response is an array, wrap it in an object with 'articles' property
    if (Array.isArray(processedData)) {
      console.log('Array format detected, wrapping in articles object');
      return { articles: processedData };
    }
    
    // If the response is an object but not in the expected format
    if (processedData && typeof processedData === 'object') {
      console.log('Object format detected, looking for articles array');
      
      // Try to find an array property that might contain the articles
      const possibleArrayProps = Object.keys(processedData).filter(key => 
        Array.isArray(processedData[key]) && processedData[key].length > 0
      );
      
      if (possibleArrayProps.length > 0) {
        // Use the first array property found
        const arrayProp = possibleArrayProps[0];
        console.log(`Using data from '${arrayProp}' property`);
        return { articles: processedData[arrayProp] };
      }
    }
    
    // If we couldn't process the data, return it as is
    console.log('Could not process data into standard format, returning as is');
    return processedData;
  } catch (error) {
    console.error('Error fetching news headlines:', error);
    
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      console.error('Error response headers:', error.response.headers);
      throw new Error(error.response.data.detail || 'Failed to fetch news headlines');
    } else if (error.request) {
      console.error('No response received:', error.request);
      throw new Error('No response from server. Please check your internet connection.');
    } else {
      console.error('Error setting up request:', error.message);
      throw new Error('Error setting up request: ' + error.message);
    }
  }
};

/**
 * Get market insights for an article
 * @param {Object|string} article - Article object or ID
 * @returns {Promise} - Promise with market insights
 */
export const getMarketInsights = async (article) => {
  // Maximum number of retries
  const MAX_RETRIES = 3;
  let retryCount = 0;
  
  // Function to add a delay between retries
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Retry loop
  while (retryCount < MAX_RETRIES) {
    try {
      console.log(`Getting market insights for article (attempt ${retryCount + 1}/${MAX_RETRIES}):`, 
        typeof article === 'object' ? article.title : article);
      
      // If article is a string, assume it's an ID
      if (typeof article === 'string') {
        console.log('Article is an ID, fetching insights by ID');
        // The baseURL already includes '/news', so we just need '/api/insights/{article}'
        const response = await api.get(`/api/insights/${article}`);
        console.log('API response for article ID:', response.data);
        return response.data;
      }
      
      // Ensure article content is not empty and has minimum length
      if (!article.content || article.content.trim().length < 100) {
        console.log('Article content is too short, adding default content');
        const defaultContent = 
          "This article discusses important market trends and financial news that could impact investment decisions. " +
          "The content provides analysis of current economic conditions and potential future developments. " +
          "Readers should consider this information as part of their broader research process.";
        
        if (!article.content) {
          article.content = defaultContent;
        } else {
          // Append to existing content if it's too short
          article.content = article.content + " " + defaultContent;
        }
      }
      
      // If article is an object, send it to the insights endpoint
      console.log('Article is an object, sending to insights endpoint');
      console.log('Content length:', article.content.length);
      console.log('Article data being sent:', {
        title: article.title,
        contentLength: article.content.length,
        source: article.source,
        publishedAt: article.publishedAt
      });
      
      // The baseURL already includes '/news', so we just need '/api/market-insights/article'
      const response = await api.post('/api/market-insights/article', article);
      
      console.log('Raw API response:', typeof response.data, response.data ? 'Has data' : 'No data');
      
      // If we received null or undefined, create a fallback
      if (!response.data) {
        console.error('Received null or undefined response from API');
        if (retryCount < MAX_RETRIES - 1) {
          retryCount++;
          console.log(`Retrying due to null response (${retryCount}/${MAX_RETRIES})...`);
          await delay(1000 * retryCount);
          continue;
        }
        return createFallbackInsights();
      }
      
      // Check if the response contains valid insights
      if (response.data && response.data.key_points) {
        console.log('Received valid insights from API with key_points');
        return response.data;
      }
      
      // If the response has an error field, log it
      if (response.data && response.data.error) {
        console.error('API returned an error:', response.data.error);
        
        // If the error response contains key_points, it's still usable
        if (response.data.key_points && Array.isArray(response.data.key_points)) {
          console.log('Using error response with key_points as fallback');
          return response.data;
        }
        
        // Try to parse the raw response if available
        if (response.data.raw_response) {
          console.log('Attempting to extract insights from raw_response');
          try {
            // Try to extract JSON from the raw response
            const jsonMatch = response.data.raw_response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const extractedJson = JSON.parse(jsonMatch[0]);
              console.log('Successfully extracted JSON from raw response');
              if (extractedJson.key_points) {
                return extractedJson;
              }
            }
          } catch (parseError) {
            console.error('Failed to parse raw response:', parseError);
          }
        }
      }
      
      // Additional logging for unexpected response formats
      console.error('Unexpected response format:', JSON.stringify(response.data, null, 2));
      
      // If we got a response but it doesn't have valid insights, retry
      if (retryCount < MAX_RETRIES - 1) {
        retryCount++;
        console.log(`Retrying insights generation (${retryCount}/${MAX_RETRIES})...`);
        await delay(1000 * retryCount); // Exponential backoff
        continue;
      }
      
      // If all retries failed, return fallback insights
      console.log('All retries failed, creating fallback insights');
      return createFallbackInsights();
      
    } catch (error) {
      console.error(`Error getting market insights (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error);
      
      if (error.response) {
        console.error('Error response status:', error.response.status);
        console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
      }
      
      // If we still have retries left, try again
      if (retryCount < MAX_RETRIES - 1) {
        retryCount++;
        const retryDelay = 1000 * retryCount; // Exponential backoff
        console.log(`Retrying after error in ${retryDelay}ms (${retryCount}/${MAX_RETRIES})...`);
        await delay(retryDelay);
        continue;
      }
      
      // If all retries failed, return fallback insights
      console.log('All retries failed after error, creating fallback insights');
      return createFallbackInsights();
    }
  }
  
  // This should never be reached, but just in case
  return createFallbackInsights();
};

/**
 * Save an article for the current user
 * @param {string} articleId - ID of the article to save
 * @returns {Promise} - Promise with the result of the operation
 */
export const saveArticle = async (articleId) => {
  try {
    console.log(`API: Saving article with ID: ${articleId}`);
    
    // Check if the article ID is valid
    if (!articleId) {
      console.error('Cannot save article: Invalid article ID');
      throw new Error('Cannot save article with an invalid ID');
    }
    
    // Get auth token for logging purposes
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      console.error('API: No authentication token available');
      throw new Error('Authentication required. Please log in again.');
    }
    
    console.log(`API: Auth token available, proceeding with save`);
    
    // Make the request to save the article
    const response = await api.post(`/api/save-article/${articleId}`);
    console.log(`API: Save article response status: ${response.status}`);
    console.log(`API: Save article response data:`, response.data);
    
    return response.data;
  } catch (error) {
    console.error(`API: Error saving article ${articleId}:`, error);
    
    // Log detailed error information for debugging
    if (error.response) {
      console.error(`API: Error response:`, error.response.data);
      console.error(`API: Error status:`, error.response.status);
    } else if (error.request) {
      console.error(`API: No response received:`, error.request);
    } else {
      console.error(`API: Error setting up request:`, error.message);
    }
    
    // Provide more detailed error messages
    if (error.response) {
      if (error.response.status === 401) {
        throw new Error('Authentication required. Please log in again.');
      } else if (error.response.status === 404) {
        throw new Error('Article not found. It may have been removed.');
      } else {
        throw new Error(error.response.data?.detail || `Error ${error.response.status}: Failed to save article`);
      }
    }
    
    throw error;
  }
};

/**
 * Unsave (remove) an article for the current user
 * @param {string} articleId - ID of the article to unsave
 * @returns {Promise} - Promise with the result of the operation
 */
export const unsaveArticle = async (articleId) => {
  try {
    console.log(`API: Unsaving article with ID: ${articleId}`);
    
    // Check if the article ID is valid
    if (!articleId) {
      console.error('Cannot unsave article: Invalid article ID');
      throw new Error('Cannot unsave article with an invalid ID');
    }
    
    // Get auth token for logging purposes
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      console.error('API: No authentication token available');
      throw new Error('Authentication required. Please log in again.');
    }
    
    console.log(`API: Auth token available, proceeding with unsave`);
    
    // Make the request to unsave the article
    const response = await api.delete(`/api/save-article/${articleId}`);
    console.log(`API: Unsave article response status: ${response.status}`);
    console.log(`API: Unsave article response data:`, response.data);
    
    return response.data;
  } catch (error) {
    console.error(`API: Error unsaving article ${articleId}:`, error);
    
    // Log detailed error information for debugging
    if (error.response) {
      console.error(`API: Error response:`, error.response.data);
      console.error(`API: Error status:`, error.response.status);
    } else if (error.request) {
      console.error(`API: No response received:`, error.request);
    } else {
      console.error(`API: Error setting up request:`, error.message);
    }
    
    // Provide more detailed error messages
    if (error.response) {
      if (error.response.status === 401) {
        throw new Error('Authentication required. Please log in again.');
      } else {
        throw new Error(error.response.data?.detail || `Error ${error.response.status}: Failed to unsave article`);
      }
    }
    
    throw error;
  }
};

/**
 * Get all saved articles for the current user
 * @returns {Promise} - Promise with saved articles
 */
export const getSavedArticles = async () => {
  try {
    console.log('Fetching saved articles...');
    const token = await AsyncStorage.getItem('token');
    
    if (!token) {
      console.error('No authentication token available');
      throw new Error('You must be logged in to view saved articles');
    }
    
    // Log the complete URL and headers being used
    console.log('Request URL:', `${getNewsApiUrl()}/api/saved-articles`);
    console.log('Auth token available:', !!token);
    
    const response = await api.get('/api/saved-articles');
    console.log('Saved articles response status:', response.status);
    console.log('Article count:', response.data?.articles?.length || 0);
    
    return response.data;
  } catch (error) {
    console.error('Error getting saved articles:', error);
    
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      
      // Handle specific error cases
      if (error.response.status === 401) {
        throw new Error('Your session has expired. Please log in again.');
      } else if (error.response.status === 404) {
        throw new Error('Saved articles feature is not available.');
      } else {
        throw new Error(error.response.data.detail || 'Failed to load saved articles');
      }
    } else if (error.request) {
      console.error('No response received:', error.request);
      throw new Error('No response from server. Please check your internet connection.');
    } else {
      console.error('Error setting up request:', error.message);
      throw error;
    }
  }
};

/**
 * Check if an article is saved by the current user
 * @param {string} articleId - ID of the article to check
 * @returns {Promise<boolean>} - Promise with boolean indicating if the article is saved
 */
export const isArticleSaved = async (articleId) => {
  try {
    console.log(`API: Checking if article with ID ${articleId} is saved`);
    
    // Check if the article ID is valid
    if (!articleId) {
      console.warn('Cannot check saved status: Invalid article ID');
      return false;
    }
    
    // Get auth token for logging purposes
    const token = await AsyncStorage.getItem('token');
    console.log(`API: Auth token available: ${!!token}`);
    
    // If no token, the article can't be saved
    if (!token) {
      console.log('API: No authentication token available, article cannot be saved');
      return false;
    }
    
    // Make the request to check if the article is saved
    const response = await api.get(`/api/article-saved/${articleId}`);
    console.log(`API: Article saved check response status: ${response.status}`);
    console.log(`API: Article saved status: ${response.data.is_saved}`);
    
    return response.data.is_saved;
  } catch (error) {
    console.error(`API: Error checking if article ${articleId} is saved:`, error);
    console.log(`API: Error response:`, error.response?.data);
    console.log(`API: Error status:`, error.response?.status);
    
    // Log but don't throw errors for this function - just return false
    return false;
  }
};

/**
 * Get weekly picks from the backend
 * @returns {Promise} - Promise with weekly picks articles
 */
export const getWeeklyPicks = async () => {
  try {
    console.log('Fetching weekly picks from backend...');
    const response = await api.get('/api/news/weekly-picks');
    console.log('Weekly picks response status:', response.status);
    console.log('Weekly picks count:', response.data?.articles?.length || 0);
    
    // If no articles are returned, check if we need to use a different path
    if (!response.data?.articles || response.data.articles.length === 0) {
      try {
        console.log('Trying alternate path for weekly picks...');
        const altResponse = await api.get('/news/api/news/weekly-picks');
        console.log('Alternate weekly picks response status:', altResponse.status);
        console.log('Alternate weekly picks count:', altResponse.data?.articles?.length || 0);
        return altResponse.data;
      } catch (altError) {
        console.log('Alternate path also failed:', altError);
        // Continue with original response if alternate fails
      }
    }
    
    return response.data;
  } catch (error) {
    console.error('Error fetching weekly picks:', error);
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error response status:', error.response.status);
      
      // Try alternate path if first attempt fails
      try {
        console.log('First path failed, trying alternate path for weekly picks...');
        const altResponse = await api.get('/news/api/news/weekly-picks');
        console.log('Alternate weekly picks response status:', altResponse.status);
        console.log('Alternate weekly picks count:', altResponse.data?.articles?.length || 0);
        return altResponse.data;
      } catch (altError) {
        console.log('Alternate path also failed:', altError);
        throw new Error(error.response.data.detail || 'Failed to fetch weekly picks');
      }
    }
    throw error;
  }
};
