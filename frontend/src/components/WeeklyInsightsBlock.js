import React, { useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Text, Surface, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';

const WeeklyInsightsBlock = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { isSubscribed, showCustomPaywall } = useSubscription();

  // Force check subscription status on mount
  useEffect(() => {
    // If user taps the component and they're not subscribed, show paywall
    console.log("WeeklyInsightsBlock - User:", user?.email, "isSubscribed:", isSubscribed);
    if (!isSubscribed) {
      console.log("User is not subscribed, weekly insights should be locked");
    }
  }, [isSubscribed, user]);

  const handleViewMore = () => {
    // If subscribed, navigate to weekly insights detail
    // If not subscribed, show paywall
    if (isSubscribed) {
      // In a real app, navigate to full report
      // navigation.navigate('WeeklyInsightsDetail');
      console.log("Navigate to full weekly report - subscribed user");
    } else {
      // Show the real DECODR PRO paywall when non-subscribed user tries to access premium content
      console.log("Non-subscribed user attempting to view full weekly report, showing DECODR PRO paywall");
      showCustomPaywall();
    }
  };

  const handleSubscribe = () => {
    if (!user) {
      navigation.navigate('Welcome');
    } else {
      // Show the real DECODR PRO paywall
      showCustomPaywall();
    }
  };

  // For subscribed users, show the actual weekly insights
  if (isSubscribed) {
    return (
      <Surface style={styles.container}>
        <View style={styles.headerRow}>
          <MaterialCommunityIcons name="star-circle" size={24} color="#000000" />
          <Text style={styles.title}>Weekly Market Insights</Text>
        </View>
        
        <View style={styles.contentContainer}>
          <Text style={styles.subtitle}>This Week's Market Roundup</Text>
          
          <View style={styles.insightRow}>
            <MaterialCommunityIcons name="trending-up" size={20} color="#4CAF50" />
            <Text style={styles.insightText}>
              Tech stocks continue to outperform with AI sector leading gains
            </Text>
          </View>
          
          <View style={styles.insightRow}>
            <MaterialCommunityIcons name="chart-timeline-variant" size={20} color="#2196F3" />
            <Text style={styles.insightText}>
              Federal Reserve signals potential rate cuts in upcoming months
            </Text>
          </View>
          
          <View style={styles.insightRow}>
            <MaterialCommunityIcons name="trending-down" size={20} color="#F44336" />
            <Text style={styles.insightText}>
              Energy sector faces pressure amid renewable energy push
            </Text>
          </View>
          
          <View style={styles.insightRow}>
            <MaterialCommunityIcons name="chart-bar" size={20} color="#FF9800" />
            <Text style={styles.insightText}>
              Commodities see mixed performance with gold reaching new highs
            </Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.viewMoreButton} onPress={handleViewMore}>
          <Text style={styles.viewMoreText}>View Full Weekly Report</Text>
          <MaterialCommunityIcons name="arrow-right" size={16} color="#000000" />
        </TouchableOpacity>
      </Surface>
    );
  }
  
  // For non-subscribed users, show a locked version with upgrade prompt
  return (
    <TouchableOpacity 
      style={styles.lockedContainer} 
      activeOpacity={0.8}
      onPress={() => {
        console.log("Non-subscribed user clicked weekly insights, showing DECODR PRO paywall");
        showCustomPaywall();
      }}
    >
      <View style={styles.lockIconContainer}>
        <MaterialCommunityIcons name="lock" size={32} color="#000000" />
      </View>
      
      <Text style={styles.lockedTitle}>Weekly Market Insights</Text>
      <Text style={styles.lockedDescription}>
        Unlock our premium weekly market analysis, curated by financial experts to help you make informed decisions.
      </Text>
      
      <Button 
        mode="contained" 
        style={styles.upgradeButton} 
        labelStyle={styles.upgradeButtonText}
        onPress={handleSubscribe}
      >
        {user ? "Upgrade to Premium" : "Sign In to Unlock"}
      </Button>
      
      <View style={styles.featuresContainer}>
        <View style={styles.featureRow}>
          <MaterialCommunityIcons name="check-circle" size={16} color="#000000" />
          <Text style={styles.featureText}>Top market movers of the week</Text>
        </View>
        <View style={styles.featureRow}>
          <MaterialCommunityIcons name="check-circle" size={16} color="#000000" />
          <Text style={styles.featureText}>Expert analysis and predictions</Text>
        </View>
        <View style={styles.featureRow}>
          <MaterialCommunityIcons name="check-circle" size={16} color="#000000" />
          <Text style={styles.featureText}>Sector performance breakdown</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    backgroundColor: '#FFFFFF',
  },
  lockedContainer: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
    fontFamily: 'Inter-Bold',
  },
  contentContainer: {
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    fontFamily: 'Inter-SemiBold',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  insightText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
    fontFamily: 'Inter-Regular',
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingVertical: 8,
  },
  viewMoreText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
    fontFamily: 'Inter-SemiBold',
  },
  lockIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  lockedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    fontFamily: 'Inter-Bold',
  },
  lockedDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    color: '#666666',
    fontFamily: 'Inter-Regular',
  },
  upgradeButton: {
    marginBottom: 16,
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  upgradeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  featuresContainer: {
    width: '100%',
    marginTop: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666666',
    fontFamily: 'Inter-Regular',
  },
});

export default WeeklyInsightsBlock; 