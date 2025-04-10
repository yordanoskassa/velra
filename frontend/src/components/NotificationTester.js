import React, { useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useNotifications } from '../context/NotificationContext';
import * as Notifications from 'expo-notifications';

const NotificationTester = () => {
  const { sendTestNotification, isNotificationsEnabled, enableNotifications, error: contextError } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('unknown');

  const checkPermissionStatus = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setPermissionStatus(status);
      return status;
    } catch (error) {
      console.error("Error checking permission:", error);
      setPermissionStatus('error');
      return 'error';
    }
  };

  const handleTestNotification = async () => {
    setLoading(true);
    
    try {
      // First check permissions
      const status = await checkPermissionStatus();
      
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') {
          Alert.alert(
            'Notification Permission Required',
            'Please enable notifications in your device settings to receive updates.',
            [
              { 
                text: 'Open Settings', 
                onPress: () => Notifications.openSettings()
              },
              { text: 'Cancel' }
            ]
          );
          setLoading(false);
          return;
        }
        setPermissionStatus(newStatus);
      }
      
      // Then check app settings
      if (!isNotificationsEnabled) {
        const enabled = await enableNotifications();
        if (!enabled) {
          Alert.alert(
            'App Settings',
            'Notifications are disabled in the app settings. Enable them in the settings screen.',
          );
          setLoading(false);
          return;
        }
      }

      // Try to send the notification
      const success = await sendTestNotification();
      
      if (success) {
        Alert.alert('Success', 'Test notification sent! You should receive it shortly. Check your notification center if it doesn\'t appear as a banner.');
      } else {
        Alert.alert(
          'Error',
          `Failed to send test notification: ${contextError || 'Unknown error'}. Please check your console logs for more details.`
        );
      }
    } catch (error) {
      console.error("Error testing notification:", error);
      Alert.alert('Error', `Exception: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notification Tester</Text>
      <Text style={styles.status}>
        Notifications are currently {isNotificationsEnabled ? 'enabled' : 'disabled'}
      </Text>
      <Text style={styles.permissions}>
        Permission status: {permissionStatus}
      </Text>
      {loading ? (
        <ActivityIndicator size="small" color="#1976D2" style={styles.loader} />
      ) : (
        <Button 
          mode="contained" 
          onPress={handleTestNotification}
          style={styles.button}
        >
          Send Test Notification
        </Button>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    margin: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  status: {
    marginBottom: 8,
  },
  permissions: {
    fontSize: 12,
    marginBottom: 16,
    color: '#666666',
  },
  button: {
    marginTop: 8,
  },
  loader: {
    marginTop: 16,
  },
});

export default NotificationTester; 