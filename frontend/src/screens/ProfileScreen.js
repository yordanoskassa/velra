import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { Ionicons } from '@expo/vector-icons';
import { Motion } from '@legendapp/motion';
import GridBackground from '../components/GridBackground';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ProfileScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, logout, isLoading } = useAuth();
  const { 
    isSubscribed, 
    isLoading: subscriptionLoading,
    showCustomPaywall,
  } = useSubscription();
  
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Handle opening the premium paywall
  const handlePremiumUpgrade = async () => {
    try {
      if (!user) {
        // If user is not logged in, redirect to login first
        navigation.navigate('Login', {
          message: 'Please log in to access premium features',
          redirectAfterLogin: true,
          redirectRoute: 'Profile'
        });
        return;
      }
      
      // If user is logged in, show paywall
      await showCustomPaywall(navigation);
    } catch (error) {
      console.error('Error upgrading to Premium:', error);
      Alert.alert(
        'Error',
        'There was a problem processing your subscription. Please try again later.'
      );
    }
  };

  const handleLogout = async () => {
    await logout();
    // Navigate to Welcome screen
    navigation.reset({
      index: 0,
      routes: [{ name: 'Welcome' }],
    });
  };

  if (isLoading || subscriptionLoading || isDeleting) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000000" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{flexGrow: 1}}>
      <GridBackground />
      
      <Motion.View
        animate={{
          opacity: 1,
          y: 0,
        }}
        initial={{
          opacity: 0,
          y: -20,
        }}
        transition={{
          type: 'spring',
          damping: 20,
          stiffness: 300,
        }}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <Text style={styles.headerTitle}>Profile</Text>

        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Ionicons name="settings-outline" size={24} color="#000000" />
          </TouchableOpacity>
        </View>
      </Motion.View>

      <Motion.View
        animate={{
          opacity: 1,
          y: 0,
        }}
        initial={{
          opacity: 0,
          y: 30,
        }}
        transition={{
          type: 'spring',
          damping: 20,
          stiffness: 300,
          delay: 0.1,
        }}
        style={styles.profileContainer}
      >
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user ? (user.name?.charAt(0) || user.email?.charAt(0)) : "N"}
            </Text>
          </View>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.nameText}>{user ? (user.name || 'User') : 'Not logged in yet'}</Text>
          <Text style={styles.emailText}>{user ? user.email : 'Login to access your profile'}</Text>
          
          {/* Stats Row */}
          <View style={styles.statsContainer}>
            {/* Activity Stats */}
            <View style={styles.statItem}>
              <View style={styles.statIconContainer}>
                <Ionicons name="bar-chart-outline" size={18} color="#4F46E5" />
              </View>
              <View style={styles.statTextContainer}>
                <Text style={styles.statValue}>Active</Text>
                <Text style={styles.statLabel}>Status</Text>
              </View>
            </View>

            {/* Membership Badge */}
            <View style={styles.statItem}>
              <View style={[styles.statIconContainer, {backgroundColor: isSubscribed ? '#FFF9E0' : '#E8E8FF'}]}>
                <Ionicons name={isSubscribed ? 'star' : 'diamond-outline'} size={18} color={isSubscribed ? '#FFD700' : '#4F46E5'} />
              </View>
              <View style={styles.statTextContainer}>
                <Text style={[styles.statValue, {color: isSubscribed ? '#FFD700' : '#4F46E5'}]}>
                  {isSubscribed ? 'Premium' : 'Free'}
                </Text>
                <Text style={styles.statLabel}>Membership</Text>
              </View>
            </View>
          </View>
          
          {/* User Tier Badge - Only show if logged in */}
          {user && (
            <View style={styles.badgeContainer}>
              <Motion.View
                animate={{
                  scale: 1,
                  opacity: 1,
                }}
                initial={{
                  scale: 0.8,
                  opacity: 0,
                }}
                transition={{
                  type: 'spring',
                  damping: 20,
                  stiffness: 300,
                  delay: 0.3,
                }}
              >
                <View style={[styles.badge, { backgroundColor: isSubscribed ? '#FFD700' : '#4F46E5' }]}>
                  <Ionicons 
                    name={isSubscribed ? 'star' : 'diamond-outline'} 
                    size={14} 
                    color="#FFFFFF" 
                    style={styles.badgeIcon} 
                  />
                  <Text style={styles.badgeText}>
                    {isSubscribed ? 'PREMIUM' : 'FREE TIER'}
                  </Text>
                </View>
              </Motion.View>
            </View>
          )}
          
          {/* Guest Badge - Show when not logged in */}
          {!user && (
            <View style={styles.badgeContainer}>
              <Motion.View
                animate={{
                  scale: 1,
                  opacity: 1,
                }}
                initial={{
                  scale: 0.8,
                  opacity: 0,
                }}
                transition={{
                  type: 'spring',
                  damping: 20,
                  stiffness: 300,
                  delay: 0.3,
                }}
              >
                <View style={[styles.badge, { backgroundColor: "#9E9E9E" }]}>
                  <Ionicons name="person-outline" size={14} color="#FFFFFF" style={styles.badgeIcon} />
                  <Text style={styles.badgeText}>NOT LOGGED IN</Text>
                </View>
              </Motion.View>
            </View>
          )}
        </View>

        <View style={styles.actionsContainer}>
          {/* Premium Subscription Button - Show for non-subscribers */}
          {!isSubscribed && (
            <TouchableOpacity
              style={styles.premiumButton}
              onPress={handlePremiumUpgrade}
            >
              <Ionicons name="star" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.premiumButtonText}>Upgrade to Premium</Text>
            </TouchableOpacity>
          )}
          
          {/* Show Premium Status if Subscribed */}
          {isSubscribed && (
            <View style={styles.premiumStatusContainer}>
              <Ionicons name="checkmark-circle" size={20} color="#FFD700" style={{ marginRight: 8 }} />
              <Text style={styles.premiumStatusText}>Premium Subscription Active</Text>
            </View>
          )}
          
          {/* Logout Button */}
          {user && (
            <TouchableOpacity 
              style={styles.logoutButton} 
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={20} color="#000000" style={{ marginRight: 8 }} />
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          )}
          
          {/* Login Button for Non-Logged In Users */}
          {!user && (
            <TouchableOpacity 
              style={styles.loginButton} 
              onPress={() => navigation.navigate('Login')}
            >
              <Ionicons name="log-in-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.loginButtonText}>Login / Create Account</Text>
            </TouchableOpacity>
          )}
        </View>
      </Motion.View>

      <Motion.View
        animate={{
          opacity: 1,
        }}
        initial={{
          opacity: 0,
        }}
        transition={{
          duration: 0.5,
          delay: 0.3,
        }}
        style={styles.disclaimerContainer}
      >
        <Text style={styles.disclaimerText}>
          All content in this app is for informational purposes only and should not be considered as financial advice.
        </Text>
      </Motion.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter-Bold',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
  },
  profileContainer: {
    flex: 1,
    padding: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  infoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  nameText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
  },
  emailText: {
    fontSize: 16,
    color: '#666666',
    fontFamily: 'Inter-Regular',
    marginBottom: 12,
  },
  badgeContainer: {
    marginTop: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeIcon: {
    marginRight: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
    fontFamily: 'Inter-Bold',
  },
  actionsContainer: {
    marginTop: 8,
  },
  premiumButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingVertical: 14,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 16,
  },
  premiumButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  premiumStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9F7F0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 24,
  },
  premiumStatusText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inter-SemiBold',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
  },
  logoutButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 16,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  disclaimerContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 8,
    width: '100%',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8E8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  statTextContainer: {
    flexDirection: 'column',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4F46E5',
    fontFamily: 'Inter-Bold',
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    fontFamily: 'Inter-Regular',
  }
});

export default ProfileScreen;
