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
  Share,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { Ionicons } from '@expo/vector-icons';
import { Motion } from '@legendapp/motion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme, Button, Divider } from 'react-native-paper';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppInfo from '../../package.json';
import theme from '../theme';
import { useSavedArticles } from '../context/SavedArticlesContext';
import { 
  Newsreader_400Regular,
  Newsreader_600SemiBold,
  useFonts 
} from '@expo-google-fonts/newsreader';
import * as SplashScreen from 'expo-splash-screen';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => {
  /* reloading the app might trigger some race conditions, ignore them */
});

const ProfileScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, logout, isLoading } = useAuth();
  const { 
    isSubscribed, 
    isLoading: subscriptionLoading,
    showCustomPaywall,
  } = useSubscription();
  
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Load the Newsreader fonts
  const [fontsLoaded] = useFonts({
    'Newsreader_400Regular': Newsreader_400Regular,
    'Newsreader_600SemiBold': Newsreader_600SemiBold,
  });

  // Hide splash screen once fonts are loaded
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(console.warn);
    }
  }, [fontsLoaded]);

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

  if (isLoading || subscriptionLoading || isDeleting || !fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#444444" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: 0 }]}>
      <View style={{ height: insets.top, backgroundColor: '#F5F2EA' }} />
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
        style={[styles.header]}
      >
        <Text style={styles.headerTitle}></Text>

        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Ionicons name="settings-outline" size={24} color="#444444" />
          </TouchableOpacity>
        </View>
      </Motion.View>

      <View style={styles.mainContent}>
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
              <Text style={styles.nameText}>{user ? (user.name || 'User') : 'Not Logged In'}</Text>
              <Text style={styles.emailText}>{user ? user.email : 'Login to access your profile'}</Text>
              
              {/* User Tier Badge - Only show if logged in and subscribed */}
              {user && isSubscribed && (
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
                    <View style={[styles.badge, { backgroundColor: '#444444' }]}>
                      <Ionicons 
                        name="star" 
                        size={14} 
                        color="#FFFFFF" 
                        style={styles.badgeIcon} 
                      />
                      <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>
                        velra PRO
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
                    <View style={[styles.badge, { backgroundColor: "#333333" }]}>
                      <Ionicons name="person-outline" size={14} color="#FFFFFF" style={styles.badgeIcon} />
                      <Text style={styles.badgeText}>Not Logged In</Text>
                    </View>
                  </Motion.View>
                </View>
              )}
            </View>
          </Motion.View>
          
          
      </View>

      <View style={[styles.bottomButtonsContainer, { 
        paddingBottom: insets.bottom > 0 ? insets.bottom : 20 
      }]}>
        {/* Premium Subscription Button - Show for non-subscribers */}
        {!isSubscribed && (
          <TouchableOpacity
            style={styles.premiumButton}
            onPress={handlePremiumUpgrade}
          >
            <Ionicons name="star" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.premiumButtonText}>Upgrade to Velra PRO</Text>
          </TouchableOpacity>
        )}
        
        {/* Show Premium Status if Subscribed */}
        {isSubscribed && user && (
          <View style={styles.premiumStatusContainer}>
            <Ionicons name="checkmark-circle" size={20} color="#444444" style={{ marginRight: 8 }} />
            <Text style={styles.premiumStatusText}>velra PRO Subscription Active</Text>
          </View>
        )}
        
        {/* Logout Button */}
        {user && (
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#444444" style={{ marginRight: 8 }} />
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2EA', // Cream background
    position: 'relative',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F2EA', // Cream background
  },
  loadingText: {
    marginTop: 10,
    color: '#444444', // Dark gray
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F5F2EA', // Cream background
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#444444', // Dark gray
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
  },
  mainContent: {
    flex: 1,
  },
  profileContainer: {
    flex: 1,
    padding: 24,
    paddingTop: 0,
    backgroundColor: 'transparent',
  },
  avatarContainer: {
    alignItems: 'flex-start',
    marginBottom: 24,
    marginTop: -10,
    paddingLeft: 10,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#444444', // Dark gray
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#F5F2EA', // Cream text for contrast on dark background
  },
  infoContainer: {
    alignItems: 'flex-start',
    marginBottom: 30,
    paddingLeft: 10,
  },
  nameText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#444444', // Dark gray
    marginBottom: 8,
    fontFamily: 'Syne',
  },
  emailText: {
    fontSize: 16,
    color: '#666666', // Medium gray
    marginBottom: 12,
    textAlign: 'left',
    fontFamily: 'Newsreader_400Regular',
  },
  badgeContainer: {
    marginTop: 16,
    alignSelf: 'flex-start',
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
  disclaimerContainer: {
    display: 'none',
  },
  disclaimerText: {
    display: 'none',
  },
  bottomButtonsContainer: {
    padding: 20,
    backgroundColor: '#F5F2EA',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  premiumButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: '#444444',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowOpacity: 0,
    elevation: 0,
    marginBottom: 16,
  },
  premiumButtonText: {
    color: '#c1ff72', // Changed to neon green
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  premiumStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222222',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  premiumStatusText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inter-SemiBold',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: '#222222',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  logoutButtonText: {
    color: '#fffff0',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Syne',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#444444',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowOpacity: 0,
    elevation: 0,
    marginBottom: 16,
  },
  loginButtonText: {
    color: '#FFFFFF', // Changed to white
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  statsContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F5F2EA',
    borderRadius: 8,
    marginHorizontal: 16,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#444444',
    marginBottom: 16,
    fontFamily: 'Syne',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statIcon: {
    marginRight: 12,
  },
  statTextContainer: {
    flex: 1,
  },
  statLabel: {
    fontSize: 16,
    color: '#444444',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#444444',
  },
  statSubValue: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 4,
  },
});

export default ProfileScreen;
