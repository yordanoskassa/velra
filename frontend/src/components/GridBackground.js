import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const GridBackground = ({ gridSize = 20, gridColor = '#F5F5F5' }) => {
  return (
    <View style={styles.gridContainer}>
      {/* Horizontal lines */}
      {Array.from({ length: Math.ceil(height / gridSize) }).map((_, index) => (
        <View 
          key={`h-${index}`} 
          style={[
            styles.gridLine, 
            styles.horizontalLine, 
            { top: index * gridSize, backgroundColor: gridColor }
          ]} 
        />
      ))}
      
      {/* Vertical lines */}
      {Array.from({ length: Math.ceil(width / gridSize) }).map((_, index) => (
        <View 
          key={`v-${index}`} 
          style={[
            styles.gridLine, 
            styles.verticalLine, 
            { left: index * gridSize, backgroundColor: gridColor }
          ]} 
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  gridContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  gridLine: {
    position: 'absolute',
  },
  horizontalLine: {
    left: 0,
    right: 0,
    height: 1,
  },
  verticalLine: {
    top: 0,
    bottom: 0,
    width: 1,
  },
});

export default GridBackground; 