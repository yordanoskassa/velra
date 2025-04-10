import { getStocksApiUrl } from './config';

/**
 * Fetch stock prices for major stocks
 * @returns {Promise<Array>} Array of stock data objects
 */
export const getStockPrices = async () => {
  try {
    const response = await fetch(`${getStocksApiUrl()}/prices`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch stock prices');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching stock prices:', error);
    throw error;
  }
};

/**
 * Fetch stock price for a specific symbol
 * @param {string} symbol - Stock symbol (e.g., AAPL)
 * @returns {Promise<Object>} Stock data object
 */
export const getStockPrice = async (symbol) => {
  try {
    const response = await fetch(`${getStocksApiUrl()}/price/${symbol}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Failed to fetch stock price for ${symbol}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching stock price for ${symbol}:`, error);
    throw error;
  }
};

export default {
  getStockPrices,
  getStockPrice
}; 