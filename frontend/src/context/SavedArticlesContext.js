import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getSavedArticles, saveArticle, unsaveArticle, isArticleSaved } from '../api/newsService';

// Create the SavedArticles Context
const SavedArticlesContext = createContext({
  savedArticles: [],
  isLoading: false,
  error: null,
  refreshSavedArticles: async () => {},
  saveArticle: async () => {},
  unsaveArticle: async () => {},
  isArticleSaved: async () => false,
  clearError: () => {},
});

// SavedArticles Provider component
export const SavedArticlesProvider = ({ children }) => {
  const [savedArticles, setSavedArticles] = useState([]);
  const [savedArticleIds, setSavedArticleIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  // Load saved articles when user changes
  useEffect(() => {
    if (user) {
      refreshSavedArticles();
    } else {
      // Clear saved articles when user logs out
      setSavedArticles([]);
      setSavedArticleIds(new Set());
    }
  }, [user]);

  // Refresh saved articles
  const refreshSavedArticles = async () => {
    if (!user) {
      console.log('No user logged in, cannot fetch saved articles');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Fetching saved articles for user:', user.email);
      const response = await getSavedArticles();
      console.log('Saved articles response:', response);
      
      if (response && response.articles) {
        console.log(`Received ${response.articles.length} saved articles`);
        setSavedArticles(response.articles);
        
        // Update the Set of IDs for quick lookups
        const ids = new Set(response.articles.map(article => article.id));
        setSavedArticleIds(ids);
      } else {
        console.warn('Received unexpected response format:', response);
        setSavedArticles([]);
        setSavedArticleIds(new Set());
      }
    } catch (err) {
      console.error('Error fetching saved articles:', err);
      
      // Extract more detailed error information
      let errorMessage = 'An error occurred while fetching saved articles';
      if (err.response) {
        errorMessage = err.response.data?.detail || `Server error: ${err.response.status}`;
        console.error('Server response:', err.response.data);
        console.error('Status code:', err.response.status);
      } else if (err.request) {
        errorMessage = 'No response from server. Please check your internet connection.';
        console.error('No response received from server');
      } else {
        errorMessage = err.message || errorMessage;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Save an article
  const saveArticleToList = async (articleId) => {
    if (!user) {
      console.log('Cannot save article: User not logged in');
      return false;
    }
    
    if (!articleId) {
      console.error('Cannot save article: Invalid article ID (undefined or null)');
      setError('Cannot save article with an invalid ID');
      return false;
    }
    
    console.log(`Attempting to save article with ID: ${articleId}`);
    setError(null);
    
    try {
      // Optimistically update UI
      setSavedArticleIds(prev => new Set([...prev, articleId]));
      console.log(`Added article ID ${articleId} to local saved articles cache`);
      
      // Call API
      const result = await saveArticle(articleId);
      console.log(`API save article result:`, result);
      
      // Refresh the saved articles list to get the latest data
      refreshSavedArticles();
      
      return true;
    } catch (err) {
      // Revert UI on error
      setSavedArticleIds(prev => {
        const newSet = new Set([...prev]);
        newSet.delete(articleId);
        return newSet;
      });
      
      console.error(`Error saving article ${articleId}:`, err);
      const errorMessage = err.response?.data?.detail || err.message || 'An error occurred while saving the article';
      setError(errorMessage);
      return false;
    }
  };

  // Unsave an article
  const unsaveArticleFromList = async (articleId) => {
    if (!user) {
      console.log('Cannot unsave article: User not logged in');
      return false;
    }
    
    if (!articleId) {
      console.error('Cannot unsave article: Invalid article ID (undefined or null)');
      setError('Cannot unsave article with an invalid ID');
      return false;
    }
    
    console.log(`Attempting to unsave article with ID: ${articleId}`);
    setError(null);
    
    try {
      // Optimistically update UI
      setSavedArticleIds(prev => {
        const newSet = new Set([...prev]);
        newSet.delete(articleId);
        return newSet;
      });
      
      setSavedArticles(prev => prev.filter(article => article.id !== articleId));
      console.log(`Removed article ID ${articleId} from local saved articles cache`);
      
      // Call API
      const result = await unsaveArticle(articleId);
      console.log(`API unsave article result:`, result);
      
      return true;
    } catch (err) {
      // Refresh to get correct state on error
      refreshSavedArticles();
      
      console.error(`Error unsaving article ${articleId}:`, err);
      const errorMessage = err.response?.data?.detail || err.message || 'An error occurred while unsaving the article';
      setError(errorMessage);
      return false;
    }
  };

  // Check if an article is saved
  const checkArticleSaved = async (articleId) => {
    if (!user) return false;
    
    // First check local cache
    if (savedArticleIds.has(articleId)) {
      return true;
    }
    
    // If not in cache, check with API
    try {
      const isSaved = await isArticleSaved(articleId);
      
      // Update cache if needed
      if (isSaved && !savedArticleIds.has(articleId)) {
        setSavedArticleIds(prev => new Set([...prev, articleId]));
      }
      
      return isSaved;
    } catch (err) {
      console.error('Error checking if article is saved:', err);
      return false;
    }
  };

  // Clear error
  const clearError = () => {
    setError(null);
  };

  // Context value
  const value = {
    savedArticles,
    isLoading,
    error,
    refreshSavedArticles,
    saveArticle: saveArticleToList,
    unsaveArticle: unsaveArticleFromList,
    isArticleSaved: checkArticleSaved,
    clearError,
  };

  return <SavedArticlesContext.Provider value={value}>{children}</SavedArticlesContext.Provider>;
};

// Custom hook to use the saved articles context
export const useSavedArticles = () => {
  const context = useContext(SavedArticlesContext);
  if (!context) {
    throw new Error('useSavedArticles must be used within a SavedArticlesProvider');
  }
  return context;
};

export default SavedArticlesContext; 