import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { Text, Button, Divider, Surface } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const SubscriptionScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, isPremium } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const { showCustomPaywall, openPaywall, isLoading } = useSubscription();

  const handleSubscribe = async () => {
    // Use the real subscription functionality
    try {
      // First try our custom paywall
      const success = await showCustomPaywall();
      
      // If that fails, try the RevenueCat paywall
      if (!success) {
        await openPaywall();
      }
      
      // Return to previous screen if the user completes the purchase
      if (isPremium) {
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error during subscription process:', error);
      Alert.alert(
        "Subscription Error",
        "There was a problem processing your request. Please try again later.",
        [{ text: "OK" }]
      );
    }
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Premium Access</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroSection}>
          <MaterialCommunityIcons name="crown" size={64} color="#000000" />
          <Text style={styles.heroTitle}>Upgrade to Premium</Text>
          <Text style={styles.heroSubtitle}>
            Get unlimited insights and superior market analysis
          </Text>
        </View>
        
        <Surface style={styles.planSelector}>
          <TouchableOpacity 
            style={[
              styles.planOption, 
              selectedPlan === 'monthly' && styles.selectedPlan
            ]}
            onPress={() => setSelectedPlan('monthly')}
          >
            <Text style={[
              styles.planText,
              selectedPlan === 'monthly' && styles.selectedPlanText
            ]}>
              Monthly
            </Text>
            <Text style={[
              styles.planPrice,
              selectedPlan === 'monthly' && styles.selectedPlanText
            ]}>
              $9.99
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.planOption, 
              selectedPlan === 'annual' && styles.selectedPlan
            ]}
            onPress={() => setSelectedPlan('annual')}
          >
            <View style={styles.bestValueTag}>
              <Text style={styles.bestValueText}>SAVE 20%</Text>
            </View>
            <Text style={[
              styles.planText,
              selectedPlan === 'annual' && styles.selectedPlanText
            ]}>
              Yearly
            </Text>
            <Text style={[
              styles.planPrice,
              selectedPlan === 'annual' && styles.selectedPlanText
            ]}>
              $99.99
            </Text>
          </TouchableOpacity>
        </Surface>
        
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Premium Benefits</Text>
          
          <View style={styles.featureRow}>
            <MaterialCommunityIcons name="check-circle" size={24} color="#000000" />
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Unlimited Insights</Text>
              <Text style={styles.featureDescription}>
                Get AI-powered market insights for every article, with no daily limits
              </Text>
            </View>
          </View>
          
          <View style={styles.featureRow}>
            <MaterialCommunityIcons name="check-circle" size={24} color="#000000" />
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Unlimited Saves</Text>
              <Text style={styles.featureDescription}>
                Save as many articles as you want for future reference
              </Text>
            </View>
          </View>
          
          <View style={styles.featureRow}>
            <MaterialCommunityIcons name="check-circle" size={24} color="#000000" />
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Ad-Free Experience</Text>
              <Text style={styles.featureDescription}>
                Enjoy the app without any advertisements or interruptions
              </Text>
            </View>
          </View>
          
          <View style={styles.featureRow}>
            <MaterialCommunityIcons name="check-circle" size={24} color="#000000" />
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Portfolio Tracking</Text>
              <Text style={styles.featureDescription}>
                Track your investments and get personalized news based on your holdings
              </Text>
            </View>
          </View>
          
          <View style={styles.featureRow}>
            <MaterialCommunityIcons name="check-circle" size={24} color="#000000" />
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Early Access</Text>
              <Text style={styles.featureDescription}>
                Be the first to access new features and improvements
              </Text>
            </View>
          </View>
        </View>
        
        <Button 
          mode="contained" 
          style={styles.subscribeButton}
          contentStyle={{ padding: 8 }}
          labelStyle={styles.subscribeButtonLabel}
          onPress={handleSubscribe}
          loading={isLoading}
          disabled={isLoading}
        >
          {isLoading ? 'Processing...' : (selectedPlan === 'monthly' ? 'Subscribe for $9.99/month' : 'Subscribe for $99.99/year')}
        </Button>
        
        <Text style={styles.disclaimer}>
          Subscriptions will automatically renew unless auto-renew is turned off at least 24 hours before the end of the current period. You can manage your subscriptions in your account settings.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  placeholder: {
    width: 40,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: 'Inter-Bold',
  },
  heroSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666666',
    marginBottom: 16,
    fontFamily: 'Inter-Regular',
  },
  planSelector: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 32,
    elevation: 2,
  },
  planOption: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    position: 'relative',
  },
  selectedPlan: {
    backgroundColor: '#000000',
  },
  planText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    fontFamily: 'Inter-SemiBold',
  },
  selectedPlanText: {
    color: '#FFFFFF',
  },
  planPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  bestValueTag: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FFD700',
    paddingHorizontal:
8,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
  },
  bestValueText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter-Bold',
  },
  featuresContainer: {
    marginBottom: 32,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    fontFamily: 'Inter-Bold',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  featureTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    fontFamily: 'Inter-SemiBold',
  },
  featureDescription: {
    fontSize: 14,
    color: '#666666',
    fontFamily: 'Inter-Regular',
  },
  subscribeButton: {
    backgroundColor: '#000000',
    marginBottom: 16,
    borderRadius: 6,
  },
  subscribeButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  disclaimer: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
    marginHorizontal: 16,
  },
});

export default SubscriptionScreen; 