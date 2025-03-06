import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Easing } from 'react-native';
import { Card, Text, useTheme, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const InsightCard = ({ insight, index }) => {
  const theme = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(20)).current;
  
  useEffect(() => {
    // Stagger the animation based on index
    const delay = index * 150;
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
      Animated.timing(translateYAnim, {
        toValue: 0,
        duration: 400,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }),
    ]).start();
  }, [index]);

  // Check if insight is valid
  if (!insight) {
    return (
      <Animated.View
        style={[
          styles.animatedContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: translateYAnim }],
          },
        ]}
      >
        <Card style={[styles.card, { backgroundColor: '#F5F5F5' }]}>
          <Card.Content>
            <Text style={styles.errorText}>Invalid insight data</Text>
          </Card.Content>
        </Card>
      </Animated.View>
    );
  }

  // Determine card color based on impact level
  const getCardColor = () => {
    // New format from backend
    const impactLevel = insight.impact_level;
    
    if (!impactLevel) {
      return '#F5F5F5';
    }
    
    // Colors based on impact level
    switch (impactLevel) {
      case 'high':
        return '#E8F5E9'; // Light green for high impact
      case 'medium':
        return '#E3F2FD'; // Light blue for medium impact
      case 'low':
        return '#F5F5F5'; // Light grey for low impact
      default:
        return '#F5F5F5';
    }
  };

  // Get border color based on impact level
  const getBorderColor = () => {
    const impactLevel = insight.impact_level;
    
    if (!impactLevel) {
      return '#9E9E9E';
    }
    
    switch (impactLevel) {
      case 'high':
        return '#4CAF50'; // Green for high impact
      case 'medium':
        return '#2196F3'; // Blue for medium impact
      case 'low':
        return '#9E9E9E'; // Grey for low impact
      default:
        return '#9E9E9E';
    }
  };

  // Get impact label
  const getImpactLabel = () => {
    const impactLevel = insight.impact_level;
    if (!impactLevel) return null;
    
    return impactLevel.charAt(0).toUpperCase() + impactLevel.slice(1);
  };

  // Get confidence percentage
  const getConfidence = () => {
    return insight.confidence || 75;
  };

  return (
    <Animated.View
      style={[
        styles.animatedContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: translateYAnim }],
        },
      ]}
    >
      <View style={[
        styles.card, 
        { 
          backgroundColor: getCardColor(),
          borderLeftColor: getBorderColor()
        }
      ]}>
        <View style={styles.cardContent}>
          <Text style={styles.insightTitle}>{insight.title}</Text>
          <Text style={styles.insightText}>{insight.description}</Text>
          
          {insight.affected_assets && insight.affected_assets.length > 0 && (
            <View style={styles.assetsContainer}>
              <Text style={styles.assetsLabel}>Affected Assets:</Text>
              <View style={styles.chipContainer}>
                {insight.affected_assets.map((asset, i) => (
                  <Chip 
                    key={i} 
                    style={styles.chip}
                    textStyle={styles.chipText}
                  >
                    {asset}
                  </Chip>
                ))}
              </View>
            </View>
          )}
          
          <View style={styles.metadataContainer}>
            {getImpactLabel() && (
              <View style={styles.impactContainer}>
                <MaterialCommunityIcons 
                  name="alert-circle-outline" 
                  size={14} 
                  color={getBorderColor()} 
                  style={styles.impactIcon}
                />
                <Text style={[styles.impactLabel, { color: getBorderColor() }]}>
                  {getImpactLabel()} Impact
                </Text>
              </View>
            )}
            
            <View style={styles.confidenceContainer}>
              <MaterialCommunityIcons 
                name="check-circle-outline" 
                size={14} 
                color="#666666" 
                style={styles.confidenceIcon}
              />
              <Text style={styles.confidenceLabel}>
                {getConfidence()}% Confidence
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  animatedContainer: {
    marginBottom: 12,
  },
  card: {
    borderRadius: 8,
    overflow: 'hidden',
    borderLeftWidth: 4,
  },
  cardContent: {
    padding: 16,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  insightText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    color: '#000000',
  },
  assetsContainer: {
    marginBottom: 12,
  },
  assetsLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#666666',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    margin: 2,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  chipText: {
    fontSize: 10,
  },
  metadataContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  impactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  impactIcon: {
    marginRight: 4,
  },
  impactLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceIcon: {
    marginRight: 4,
  },
  confidenceLabel: {
    fontSize: 12,
    color: '#666666',
  },
  errorText: {
    fontSize: 14,
    color: '#666666',
  },
});

export default InsightCard; 