import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import NotificationTester from '../components/NotificationTester';
import { useNotifications } from '../context/NotificationContext';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

const NotificationTestScreen = ({ navigation }) => {
  const { pushToken, sendNewsNotification } = useNotifications();

  const displayEnvironmentInfo = () => {
    const expoInfo = Constants.expoConfig || {};
    const eas = expoInfo.extra?.eas || {};
    
    return (
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Environment Info</Text>
        <Text style={styles.infoText}>App name: {expoInfo.name || 'Unknown'}</Text>
        <Text style={styles.infoText}>Version: {expoInfo.version || 'Unknown'}</Text>
        <Text style={styles.infoText}>EAS Project ID: {eas.projectId || 'Not set - notifications may not work'}</Text>
        <Text style={styles.infoText}>Platform: {Constants.platform?.ios ? 'iOS' : 'Android'}</Text>
        <Text style={styles.infoText}>Is Device: {Constants.isDevice ? 'Yes' : 'No (Simulator)'}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Button icon="arrow-left" onPress={() => navigation.goBack()}>
          Back
        </Button>
        <Text style={styles.headerTitle}>Notification Testing</Text>
        <View style={{ width: 60 }} />
      </View>
      
      <ScrollView style={styles.content}>
        <Text style={styles.description}>
          This screen allows you to test push notifications and diagnose any issues.
        </Text>
        
        {displayEnvironmentInfo()}
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Push Token</Text>
          <Text style={styles.tokenText} selectable>
            {pushToken || 'No token available'}
          </Text>
          
          <Text style={styles.note}>
            Note: Push notifications require a registered Expo project ID and won't work in simulators.
            Local notifications should work on both physical devices and simulators.
          </Text>
        </View>
        
        <NotificationTester />
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>News Notification</Text>
          <Text style={styles.description}>
            Test a realistic news notification with dynamic content.
          </Text>
          <Button
            mode="contained"
            onPress={async () => {
              try {
                const success = await sendNewsNotification();
                if (success) {
                  alert('News notification sent! You should receive it shortly.');
                } else {
                  alert('Failed to send news notification. Check console for details.');
                }
              } catch (error) {
                console.error('Error sending news notification:', error);
                alert(`Error: ${error.message}`);
              }
            }}
            style={styles.newsButton}
            icon="newspaper"
          >
            Send News Notification
          </Button>
        </View>
        
        <View style={styles.troubleshootingSection}>
          <Text style={styles.sectionTitle}>Troubleshooting</Text>
          <Text style={styles.troubleshootingText}>
            1. Ensure notifications are enabled in your device settings
          </Text>
          <Text style={styles.troubleshootingText}>
            2. Check that the app has permission to send notifications
          </Text>
          <Text style={styles.troubleshootingText}>
            3. Restart the app after granting permissions
          </Text>
          <Text style={styles.troubleshootingText}>
            4. For physical devices, you need an EAS project ID configured
          </Text>
          
          <Button 
            mode="outlined" 
            style={styles.settingsButton}
            onPress={() => Notifications.openSettings()}
          >
            Open Notification Settings
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  infoSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  tokenText: {
    fontSize: 14,
    backgroundColor: '#eee',
    padding: 12,
    borderRadius: 4,
    fontFamily: 'monospace',
    marginBottom: 16,
  },
  note: {
    fontStyle: 'italic',
    color: '#666',
    fontSize: 14,
  },
  troubleshootingSection: {
    marginBottom: 32,
    padding: 16,
    backgroundColor: '#fff9c4',
    borderRadius: 8,
  },
  troubleshootingText: {
    fontSize: 14,
    marginBottom: 8,
  },
  settingsButton: {
    marginTop: 16,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 4,
  },
  newsButton: {
    marginTop: 16,
  },
});

export default NotificationTestScreen; 