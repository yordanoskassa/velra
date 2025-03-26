import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, Easing, TouchableOpacity } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { getStockPrices } from '../api/stockService';

const StockTicker = () => {
  const theme = useTheme();
  const [visibleStocks, setVisibleStocks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  const [stocks, setStocks] = useState([
    { symbol: 'AAPL', name: 'Apple', price: 0, change: 0, change_percent: 0 },
    { symbol: 'MSFT', name: 'Microsoft', price: 0, change: 0, change_percent: 0 },
    { symbol: 'GOOGL', name: 'Alphabet', price: 0, change: 0, change_percent: 0 },
    { symbol: 'AMZN', name: 'Amazon', price: 0, change: 0, change_percent: 0 },
    { symbol: 'META', name: 'Meta', price: 0, change: 0, change_percent: 0 },
    { symbol: 'TSLA', name: 'Tesla', price: 0, change: 0, change_percent: 0 },
    { symbol: 'NVDA', name: 'NVIDIA', price: 0, change: 0, change_percent: 0 },
    { symbol: 'JPM', name: 'JPMorgan', price: 0, change: 0, change_percent: 0 },
    { symbol: 'V', name: 'Visa', price: 0, change: 0, change_percent: 0 },
    { symbol: 'DIS', name: 'Disney', price: 0, change: 0, change_percent: 0 },
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch real stock data from API
  const fetchStockData = async () => {
    setLoading(true);
    try {
      const stockData = await getStockPrices();
      
      if (stockData && stockData.length > 0) {
        setStocks(stockData);
        setError(null);
      } else {
        setError('No stock data available');
      }
      
      setLoading(false);
      
      // Initialize visible stocks
      updateVisibleStocks(0, stockData);
    } catch (error) {
      console.error('Error fetching stock data:', error);
      setError(error.message || 'Failed to fetch stock data');
      setLoading(false);
      
      // Use fallback data if API fails
      updateVisibleStocks(0, stocks);
    }
  };

  // Update which stocks are visible
  const updateVisibleStocks = (index, stocksData) => {
    if (!stocksData || stocksData.length === 0) return;
    
    // Calculate how many stocks can fit in the container (approximately 3-4)
    const visibleCount = 4;
    const stocksToShow = [];
    
    for (let i = 0; i < visibleCount; i++) {
      const stockIndex = (index + i) % stocksData.length;
      stocksToShow.push(stocksData[stockIndex]);
    }
    
    setVisibleStocks(stocksToShow);
  };

  // Rotate through stocks with fade animation
  useEffect(() => {
    if (loading || stocks.length === 0) return;
    
    const rotateStocks = () => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        // Update stocks
        const nextIndex = (currentIndex + 1) % stocks.length;
        setCurrentIndex(nextIndex);
        updateVisibleStocks(nextIndex, stocks);
        
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      });
    };
    
    // Rotate stocks every 5 seconds
    const interval = setInterval(rotateStocks, 5000);
    
    return () => clearInterval(interval);
  }, [currentIndex, loading, stocks]);

  // Fetch stock data on component mount
  useEffect(() => {
    fetchStockData();
    
    // Refresh stock data every 60 seconds
    const refreshInterval = setInterval(fetchStockData, 60000);
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, []);

  const handleRefresh = () => {
    fetchStockData();
  };

  const renderStockItem = (stock, index) => {
    const isPositive = stock.change > 0 || stock.change_percent > 0;
    const isNegative = stock.change < 0 || stock.change_percent < 0;
    const changeColor = isPositive ? '#4CAF50' : isNegative ? '#F44336' : theme.colors.text;
    
    // Use change_percent from API if available, otherwise use change
    const changeValue = stock.change_percent !== undefined ? stock.change_percent : stock.change;
    
    return (
      <View key={stock.symbol} style={styles.stockItem}>
        <Text style={styles.stockSymbol}>{stock.symbol}</Text>
        <Text style={styles.stockPrice}>${parseFloat(stock.price).toLocaleString()}</Text>
        <View style={styles.changeContainer}>
          {isPositive && <MaterialIcons name="arrow-upward" size={12} color={changeColor} />}
          {isNegative && <MaterialIcons name="arrow-downward" size={12} color={changeColor} />}
          <Text style={[styles.stockChange, { color: changeColor }]}>
            {changeValue > 0 ? '+' : ''}{changeValue.toFixed(2)}%
          </Text>
        </View>
        {index < visibleStocks.length - 1 && <Text style={styles.separator}>|</Text>}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <Text style={styles.loadingText}>Loading market data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity onPress={handleRefresh} style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.colors.error }]}>Error: {error}</Text>
          <MaterialIcons name="refresh" size={16} color={theme.colors.error} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View 
      style={[
        styles.container, 
        { 
          backgroundColor: theme.colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(0, 0, 0, 0.1)',
        }
      ]}
    >
      <Animated.View 
        style={[
          styles.tickerContent,
          { opacity: fadeAnim }
        ]}
      >
        {visibleStocks.map((stock, index) => renderStockItem(stock, index))}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 40,
    width: '100%',
    justifyContent: 'center',
    zIndex: 10,
  },
  tickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  stockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  stockSymbol: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
    marginRight: 4,
  },
  stockPrice: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    marginRight: 4,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stockChange: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
  },
  separator: {
    marginHorizontal: 8,
    color: 'rgba(0, 0, 0, 0.3)',
  },
  loadingText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    textAlign: 'center',
    color: 'rgba(0, 0, 0, 0.5)',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    marginRight: 8,
  },
});

export default StockTicker; 