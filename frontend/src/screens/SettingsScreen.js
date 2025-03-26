import React, { useState, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, ActivityIndicator, Animated, Linking, TextInput } from 'react-native';
import { Text, Divider, List } from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { Ionicons } from '@expo/vector-icons';
import GridBackground from '../components/GridBackground';
import { useUsage } from '../context/UsageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackInsightUsage } from '../api/userService';
import { MaterialIcons } from '@expo/vector-icons';

const SettingsScreen = () => {
  const navigation = useNavigation();
  const { logout, deleteAccount, user, token } = useAuth();
  const { isSubscribed, cancelSubscription, restorePurchases, isLoading: subscriptionLoading, setManualSubscriptionStatus } = useSubscription();
  
  // Safely try to use the usage context, but handle case when it's not available
  let usageContext = null;
  try {
    usageContext = useUsage();
  } catch (error) {
    console.log('UsageContext not available in Settings:', error.message);
  }
  
  const insightsViewed = usageContext?.insightsViewed || 0;
  
  const [deleteLoading, setDeleteLoading] = useState(false);
  const insets = useSafeAreaInsets();
  
  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Logout",
          onPress: async () => {
            try {
              await logout();
              // Navigate back to welcome screen
              navigation.reset({
                index: 0,
                routes: [{ name: 'Welcome' }],
              });
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Logout Failed', 'An error occurred during logout.');
            }
          }
        }
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          onPress: confirmDeleteAccount,
          style: "destructive"
        }
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    try {
      setDeleteLoading(true);
      console.log('Starting account deletion process from SettingsScreen...');
      await deleteAccount();
      console.log('Account deleted successfully from SettingsScreen');
      
      // Navigate back to welcome screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'Welcome' }],
      });
    } catch (error) {
      console.error('Delete account error in SettingsScreen:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      Alert.alert('Error', error.message || 'Failed to delete account. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    Alert.alert(
      "Cancel Subscription",
      "Are you sure you want to cancel your subscription? You'll still have access until the end of your current billing period.",
      [
        {
          text: "No, Keep Subscription",
          style: "cancel"
        },
        {
          text: "Cancel Subscription",
          onPress: async () => {
            try {
              await cancelSubscription();
            } catch (error) {
              console.error('Error canceling subscription:', error);
              Alert.alert('Error', 'Failed to cancel subscription. Please try again later.');
            }
          },
          style: "destructive"
        }
      ]
    );
  };

  const handleRestorePurchases = async () => {
    try {
      await restorePurchases();
    } catch (error) {
      console.error('Error restoring purchases:', error);
      Alert.alert('Error', 'Failed to restore purchases. Please try again later.');
    }
  };

  const resetInsightCounter = async () => {
    try {
      // Reset local storage
      await AsyncStorage.setItem('insightsViewed', '0');
      
      // Reset server-side if logged in
      if (user && token) {
        await trackInsightUsage(token, { reset: true });
      }
      
      // Show confirmation
      Alert.alert(
        "Reset Complete",
        "Your insight counter has been reset to 0.",
        [{ text: "OK" }]
      );
      
      // Update local state if usage context is available
      if (usageContext && typeof usageContext.setInsightsViewed === 'function') {
        usageContext.setInsightsViewed(0);
      }
    } catch (error) {
      console.error('Error resetting insight counter:', error);
      Alert.alert(
        "Reset Failed",
        "There was a problem resetting your insight counter.",
        [{ text: "OK" }]
      );
    }
  };

  const renderDebugSection = () => {
    // Development options have been removed
    return null;
  };

  if (deleteLoading || subscriptionLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000000" />
        <Text style={styles.loadingText}>
          {deleteLoading ? 'Deleting account...' : 'Processing subscription...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Grid Background */}
      <GridBackground />
      
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <View style={styles.sectionWrapper}>
            <List.Item
              title="Terms of Service"
              titleStyle={styles.listItemTitle}
              left={props => <List.Icon {...props} icon="file-document" color="#000000" />}
              onPress={() => navigation.navigate('TermsOfService')}
              style={styles.listItem}
            />
            <Divider style={styles.divider} />
            <List.Item
              title="Privacy Policy"
              titleStyle={styles.listItemTitle}
              left={props => <List.Icon {...props} icon="shield-account" color="#000000" />}
              onPress={() => navigation.navigate('PrivacyPolicy')}
              style={styles.listItem}
            />
          </View>
        </View>
        
        {/* Subscription Management Section - Only visible if subscribed */}
        {isSubscribed && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Subscription Management</Text>
            <View style={styles.sectionWrapper}>
              <List.Item
                title="Manage Subscription"
                titleStyle={styles.listItemTitle}
                description="Cancel or change your subscription"
                descriptionStyle={styles.listItemDescription}
                left={props => <List.Icon {...props} icon="star" color="#FFD700" />}
                onPress={handleCancelSubscription}
                style={styles.listItem}
              />
              <Divider style={styles.divider} />
              <List.Item
                title="Restore Purchases"
                titleStyle={styles.listItemTitle}
                description="Restore previously purchased subscriptions"
                descriptionStyle={styles.listItemDescription}
                left={props => <List.Icon {...props} icon="restore" color="#000000" />}
                onPress={handleRestorePurchases}
                style={styles.listItem}
              />
            </View>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleDeleteAccount}
          >
            <Ionicons name="trash-outline" size={20} color="#000000" />
            <Text style={styles.buttonText}>Delete Account</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#000000" />
            <Text style={styles.buttonText}>Logout</Text>
          </TouchableOpacity>
        </View>
        
        {renderDebugSection()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#000000',
    fontFamily: 'Raleway-Regular',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    zIndex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
    zIndex: 1,
  },
  section: {
    marginBottom: 24,
    zIndex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    fontFamily: 'Raleway-SemiBold',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
    fontFamily: 'Raleway-Regular',
  },
  sectionWrapper: {
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  listItem: {
    paddingVertical: 8,
  },
  listItemTitle: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Raleway-Medium',
  },
  listItemDescription: {
    color: '#666666',
    fontSize: 12,
    fontFamily: 'Raleway-Regular',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  buttonContainer: {
    marginTop: 24,
    marginBottom: 32,
    zIndex: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 0,
    marginBottom: 16,
  },
  buttonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Raleway-Medium',
  },
  settingValue: {
    color: '#666666',
    fontSize: 12,
    fontFamily: 'Raleway-Regular',
  },
  settingInput: {
    flex: 1,
    padding: 8,
  },
});

export default SettingsScreen; 