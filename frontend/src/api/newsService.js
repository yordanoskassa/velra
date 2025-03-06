import axios from 'axios';

// Helper function to extract impact values from raw text
const extractImpactValue = (impactText, assetType) => {
  if (!impactText) return "Impact analysis unavailable";
  
  const regex = new RegExp(`["']?${assetType}["']?\\s*:\\s*["']([^"']+)["']`, 'i');
  const match = impactText.match(regex);
  
  return match ? match[1] : "Impact analysis unavailable";
};

// Helper function to create fallback insights when parsing fails
const createFallbackInsights = () => {
  return {
    key_points: [
      "Unable to parse detailed insights from the AI response.",
      "Consider reviewing the article manually for market implications.",
      "The system is still learning to analyze this type of content."
    ],
    potential_impact: {
      stocks: "Impact analysis unavailable",
      commodities: "Impact analysis unavailable",
      forex: "Impact analysis unavailable"
    },
    recommended_actions: ["Review article manually"],
    confidence_score: 50
  };
};

// Replace with your backend URL
const API_URL = 'http://localhost:8000';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 10000, // 10 second timeout
});

// Get all news headlines
export const getNewsHeadlines = async () => {
  try {
    const response = await apiClient.get('/api/news');
    console.log('API Response:', response.data);
    
    // Validate response structure
    if (!response.data) {
      throw new Error('Invalid response format from news API');
    }
    
    // Check if response.data has articles property and it's an array
    if (response.data.articles && Array.isArray(response.data.articles)) {
      // Add unique IDs to each article if they don't have one
      const articlesWithIds = response.data.articles.map((article, index) => ({
        ...article,
        id: article.id || article.url || `article-${Date.now()}-${index}`
      }));
      
      return articlesWithIds;
    } else if (Array.isArray(response.data)) {
      // If response.data is already an array, add IDs if needed
      const articlesWithIds = response.data.map((article, index) => ({
        ...article,
        id: article.id || article.url || `article-${Date.now()}-${index}`
      }));
      
      return articlesWithIds;
    } else {
      throw new Error('Invalid response format: expected articles array');
    }
  } catch (error) {
    console.error('News API Error:', error);
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      throw new Error(error.response.data.detail || 'Server error');
    } else if (error.request) {
      // The request was made but no response was received
      throw new Error('No response from server');
    } else {
      // Something happened in setting up the request that triggered an Error
      throw new Error(error.message || 'Failed to fetch news headlines');
    }
  }
};

// Get market insights for a specific article
export const getMarketInsights = async (article) => {
  try {
    console.log('Sending article to insights API:', article);
    
    // Validate article data before sending
    if (!article.title || !article.content) {
      console.error('Invalid article data:', article);
      throw new Error('Article must have title and content');
    }
    
    // Ensure content is at least 100 characters
    if (article.content.length < 100) {
      console.warn('Article content too short, padding content');
      article.content += ' '.repeat(100 - article.content.length);
    }
    
    const response = await apiClient.post(
      `/api/market-insights/article`,
      article,
      {
        timeout: 15000,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    console.log('Insights API response status:', response.status);
    
    if (response.status === 200) {
      // Check if response.data is valid
      if (!response.data) {
        throw new Error('Empty response data');
      }
      
      // Handle case where response.data might contain error information
      if (response.data.error) {
        console.error('API returned error:', response.data.error);
        throw new Error(response.data.error);
      }
      
      // If the response contains raw_response, it means the JSON parsing failed on the backend
      if (response.data.raw_response) {
        console.log('Raw response from API:', response.data.raw_response);
        
        // Try to parse the raw response ourselves
        try {
          // First, try to find JSON-like content in the raw response
          const jsonMatch = response.data.raw_response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsedData = JSON.parse(jsonMatch[0]);
              
              // Validate the parsed data structure
              const validatedData = {
                key_points: Array.isArray(parsedData.key_points) 
                  ? parsedData.key_points 
                  : typeof parsedData.key_points === 'string'
                    ? [parsedData.key_points]
                    : ["No key points available"],
                    
                potential_impact: parsedData.potential_impact || {
                  stocks: "Impact analysis unavailable",
                  commodities: "Impact analysis unavailable",
                  forex: "Impact analysis unavailable"
                },
                
                recommended_actions: Array.isArray(parsedData.recommended_actions)
                  ? parsedData.recommended_actions
                  : typeof parsedData.recommended_actions === 'string'
                    ? [parsedData.recommended_actions]
                    : ["Review article manually"],
                    
                confidence_score: typeof parsedData.confidence_score === 'number'
                  ? parsedData.confidence_score
                  : 50
              };
              
              return validatedData;
            } catch (innerParseError) {
              console.error('Failed to parse extracted JSON:', innerParseError);
              // Continue to fallback
            }
          }
          
          // If we couldn't extract valid JSON, try to parse the content manually
          // Look for key points in the text
          const keyPointsMatch = response.data.raw_response.match(/key_points["\s:]+\[(.*?)\]/s);
          const impactMatch = response.data.raw_response.match(/potential_impact["\s:]+\{(.*?)\}/s);
          const actionsMatch = response.data.raw_response.match(/recommended_actions["\s:]+\[(.*?)\]/s);
          const confidenceMatch = response.data.raw_response.match(/confidence_score["\s:]+(\d+)/);
          
          // Create a structured response from the extracted data
          const extractedData = {
            key_points: keyPointsMatch 
              ? keyPointsMatch[1].split(',').map(point => 
                  point.trim().replace(/^["']|["']$/g, ''))
              : ["Unable to extract key points from the AI response"],
              
            potential_impact: {
              stocks: extractImpactValue(impactMatch ? impactMatch[1] : '', 'stocks'),
              commodities: extractImpactValue(impactMatch ? impactMatch[1] : '', 'commodities'),
              forex: extractImpactValue(impactMatch ? impactMatch[1] : '', 'forex')
            },
            
            recommended_actions: actionsMatch
              ? actionsMatch[1].split(',').map(action => 
                  action.trim().replace(/^["']|["']$/g, ''))
              : ["Review article manually"],
              
            confidence_score: confidenceMatch ? parseInt(confidenceMatch[1], 10) : 50
          };
          
          return extractedData;
        } catch (parseError) {
          console.error('Failed to parse raw response:', parseError);
          
          // Return a fallback structure with key points
          return createFallbackInsights();
        }
      }
      
      // For properly formatted responses, ensure all required fields are present
      return {
        key_points: Array.isArray(response.data.key_points) 
          ? response.data.key_points 
          : typeof response.data.key_points === 'string'
            ? [response.data.key_points]
            : [],
            
        potential_impact: response.data.potential_impact || {
          stocks: "Impact analysis unavailable",
          commodities: "Impact analysis unavailable",
          forex: "Impact analysis unavailable"
        },
        
        recommended_actions: Array.isArray(response.data.recommended_actions)
          ? response.data.recommended_actions
          : typeof response.data.recommended_actions === 'string'
            ? [response.data.recommended_actions]
            : [],
            
        confidence_score: typeof response.data.confidence_score === 'number'
          ? response.data.confidence_score
          : 75
      };
    }

    throw new Error(response.data.detail || 'Failed to generate insights');

  } catch (error) {
    console.error('Insights API Error:', error);
    if (error.response) {
      throw new Error(error.response.data.detail || 'Server error');
    } else if (error.request) {
      throw new Error('No response from insights server');
    } else {
      throw new Error(error.message || 'Insights service unavailable');
    }
  }
};
