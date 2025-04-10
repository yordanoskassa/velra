import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, ActivityIndicator, Animated, Linking, TextInput, Platform } from 'react-native';
import { Text, Divider, List, Switch } from 'react-native-paper';
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
import * as Notifications from 'expo-notifications';

const SettingsScreen = () => {
  const navigation = useNavigation();
  const { logout, deleteAccount, user, token } = useAuth();
  const { isSubscribed, cancelSubscription, restorePurchases, isLoading: subscriptionLoading, setManualSubscriptionStatus } = useSubscription();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
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
  
  useEffect(() => {
    checkNotificationStatus();
  }, []);

  const checkNotificationStatus = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      const enabled = existingStatus === 'granted';
      setNotificationsEnabled(enabled);
    } catch (error) {
      console.error('Error checking notification status:', error);
    }
  };

  const toggleNotifications = async () => {
    try {
      if (!notificationsEnabled) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          setNotificationsEnabled(true);
        }
      } else {
        // On iOS, we can't programmatically disable notifications
        // We'll show instructions to the user
        if (Platform.OS === 'ios') {
          Alert.alert(
            "Disable Notifications",
            "To disable notifications, please go to your device's Settings > Notifications > velra and turn them off.",
            [{ text: "OK" }]
          );
        } else {
          // On Android, we can disable notifications
          await Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: false,
              shouldPlaySound: false,
              shouldSetBadge: false,
            }),
          });
          setNotificationsEnabled(false);
        }
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
      Alert.alert('Error', 'Failed to update notification settings. Please try again.');
    }
  };

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

  const openPrivacyPolicy = async () => {
    const privacyPolicyUrl = 'https://mazebuilders.com/velraprivacy';
    const canOpen = await Linking.canOpenURL(privacyPolicyUrl);
    if (canOpen) {
      await Linking.openURL(privacyPolicyUrl);
    } else {
      console.error('Cannot open URL:', privacyPolicyUrl);
      Alert.alert('Error', 'Could not open the privacy policy. Please try again later.');
    }
  };

  const openTermsOfService = async () => {
    const termsUrl = 'https://mazebuilders.com/velraterms';
    const canOpen = await Linking.canOpenURL(termsUrl);
    if (canOpen) {
      await Linking.openURL(termsUrl);
    } else {
      console.error('Cannot open URL:', termsUrl);
      Alert.alert('Error', 'Could not open the terms of service. Please try again later.');
    }
  };

  const renderDebugSection = () => {
    // Development options have been removed
    return null;
  };

  if (deleteLoading || subscriptionLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#c1ff72" />
        <Text style={styles.loadingText}>
          {deleteLoading ? 'Deleting account...' : 'Processing subscription...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#222222" />
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
              left={props => <List.Icon {...props} icon="file-document" color="#333333" />}
              onPress={openTermsOfService}
              style={styles.listItem}
            />
            <Divider style={styles.divider} />
            <List.Item
              title="Privacy Policy"
              titleStyle={styles.listItemTitle}
              left={props => <List.Icon {...props} icon="shield-account" color="#333333" />}
              onPress={openPrivacyPolicy}
              style={styles.listItem}
            />
          </View>
        </View>
        
        {/* Subscription Management Section - Only visible if subscribed */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription Management</Text>
          <View style={styles.sectionWrapper}>
            {isSubscribed ? (
              <List.Item
                title="Manage Subscription"
                titleStyle={styles.listItemTitle}
                description="Cancel or change your subscription"
                descriptionStyle={styles.listItemDescription}
                left={props => <List.Icon {...props} icon="star" color="#333333" />}
                onPress={handleCancelSubscription}
                style={styles.listItem}
              />
            ) : (
              <List.Item
                title="Restore Purchases"
                titleStyle={styles.listItemTitle}
                description="Restore previously purchased subscriptions"
                descriptionStyle={styles.listItemDescription}
                left={props => <List.Icon {...props} icon="restore" color="#333333" />}
                onPress={handleRestorePurchases}
                style={styles.listItem}
              />
            )}
          </View>
        </View>

        {/* Notification Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.sectionWrapper}>
            <List.Item
              title="Push Notifications"
              titleStyle={styles.listItemTitle}
              description={notificationsEnabled ? "Notifications are enabled" : "Receive alerts about hot headlines"}
              descriptionStyle={styles.listItemDescription}
              left={props => <List.Icon {...props} icon="bell" color="#333333" />}
              right={() => (
                <Switch
                  value={notificationsEnabled}
                  onValueChange={toggleNotifications}
                  color="#333333"
                />
              )}
              style={styles.listItem}
            />
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleDeleteAccount}
          >
            <Ionicons name="trash-outline" size={20} color="#333333" />
            <Text style={styles.buttonText}>Delete Account</Text>
          </TouchableOpacity>
          
          {/* Logout button removed */}
        </View>
        
        {renderDebugSection()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f5e9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#e0dcd0',
    backgroundColor: '#f8f5e9',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c1ff72',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    backgroundColor: '#f8f5e9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f5e9',
  },
  loadingText: {
    marginTop: 16,
    color: '#333333',
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#f8f5e9',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    paddingHorizontal: 16,
    color: '#333333',
  },
  sectionWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 16,
    shadowColor: 'transparent', 
    elevation: 0,
  },
  listItem: {
    paddingVertical: 8,
  },
  listItemTitle: {
    color: '#333333',
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
    backgroundColor: 'rgba(0,0,0,0.1)',
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
    shadowColor: 'transparent',
    elevation: 0,
  },
  buttonText: {
    color: '#333333',
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
    color: '#333333',
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
  logoutButton: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    alignItems: 'center',
    shadowColor: 'transparent',
    elevation: 0,
  },
  logoutButtonText: {
    color: '#333333',
    fontWeight: 'bold',
    fontSize: 16,
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    alignItems: 'center',
    shadowColor: 'transparent',
    elevation: 0,
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontWeight: 'bold',
    fontSize: 16,
  },
  restoreButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    alignItems: 'center',
    shadowColor: 'transparent',
    elevation: 0,
  },
  restoreButtonText: {
    color: '#333333',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default SettingsScreen; 