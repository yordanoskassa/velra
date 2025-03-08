import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, Button, Divider, List } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const SettingsScreen = () => {
  const navigation = useNavigation();
  const { logout, deleteAccount } = useAuth();
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  if (deleteLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000000" />
        <Text style={styles.loadingText}>Deleting account...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text variant="headlineMedium" style={styles.title}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView>
        <View style={styles.section}>
          <List.Item
            title="Terms of Service"
            titleStyle={styles.listItemTitle}
            left={props => <List.Icon {...props} icon="file-document" color="#000000" />}
            onPress={() => navigation.navigate('TermsOfService')}
          />
          <Divider />
          <List.Item
            title="Privacy Policy"
            titleStyle={styles.listItemTitle}
            left={props => <List.Icon {...props} icon="shield-account" color="#000000" />}
            onPress={() => navigation.navigate('PrivacyPolicy')}
          />
        </View>

        <View style={styles.buttonContainer}>
          <Button 
            mode="contained" 
            buttonColor="#000000"
            onPress={handleDeleteAccount}
            style={styles.deleteButton}
          >
            Delete Account
          </Button>
          <Button 
            mode="contained" 
            buttonColor="#000000"
            onPress={handleLogout}
            style={styles.logoutButton}
          >
            Logout
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    width: 40,
  },
  title: {
    fontWeight: 'bold',
    color: '#000000',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  listItemTitle: {
    color: '#000000',
  },
  buttonContainer: {
    padding: 16,
    marginTop: 16,
    marginBottom: 32,
  },
  deleteButton: {
    marginBottom: 16,
  },
  logoutButton: {
    padding: 4,
  }
});

export default SettingsScreen; 