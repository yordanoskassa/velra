import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Motion } from '@legendapp/motion';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get the API URL from environment variables or use a default
const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:8000';

// For iOS simulator, we need to use localhost instead of 127.0.0.1
const getApiUrl = () => {
  // If we're on iOS simulator, replace localhost with the special IP for simulator
  if (Platform.OS === 'ios' && API_URL.includes('localhost')) {
    return API_URL.replace('localhost', '127.0.0.1');
  }
  return API_URL;
};

const ProfileScreen = ({ navigation }) => {
  const { user, logout, deleteAccount, isLoading } = useAuth();
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Welcome' }],
    });
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDeleteAccount,
        },
      ],
      { cancelable: true }
    );
  };

  const confirmDeleteAccount = async () => {
    try {
      setDeleteLoading(true);
      await deleteAccount();
      
      // Navigate back to welcome screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'Welcome' }],
      });
    } catch (error) {
      console.error('Delete account error:', error);
      Alert.alert('Error', error.message || 'Failed to delete account. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (isLoading || deleteLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
        style={styles.header}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.placeholder} />
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
              {user?.name?.charAt(0) || user?.email?.charAt(0) || '?'}
            </Text>
          </View>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.nameText}>{user?.name || 'User'}</Text>
          <Text style={styles.emailText}>{user?.email || 'No email'}</Text>
        </View>

        <View style={styles.actionsContainer}>
          {/* Remove all the settings options from here */}
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

      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => navigation.navigate('Settings')}
      >
        <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
        <Text style={styles.buttonText}>Settings</Text>
      </TouchableOpacity>
    </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
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
  profileContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  avatarContainer: {
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  infoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  nameText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 5,
  },
  emailText: {
    fontSize: 16,
    color: '#000000',
  },
  actionsContainer: {
    width: '100%',
    marginBottom: 30,
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#333333',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  deleteButton: {
    flexDirection: 'row',
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  disclaimerContainer: {
    padding: 20,
    marginTop: 'auto',
  },
  disclaimerText: {
    fontSize: 12,
    color: '#000000',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 15,
  },
  legalButton: {
    flexDirection: 'row',
    backgroundColor: '#333333',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  helpButton: {
    flexDirection: 'row',
    backgroundColor: '#333333',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    position: 'absolute',
    bottom: 30,
    right: 20,
  },
});

export default ProfileScreen;
