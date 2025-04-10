import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Platform, Image } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

const NotificationPrompt = ({ visible, onClose, onEnable }) => {
  const handleEnableNotifications = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        onEnable();
        onClose();
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
    }
  };

  const handleNotNow = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleNotNow}
    >
      <View style={styles.modalOvelray}>
        <View style={styles.modalContent}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="notifications-active" size={48} color="#452c63" />
          </View>
          
          <Text style={styles.title}>Stay Updated with VELRA</Text>
          <Text style={styles.description}>
            Get notified about new virtual try-on features, outfit suggestions, and personalized fashion updates. Never miss the chance to try on trending styles!
          </Text>
          
          <View style={styles.buttonContainer}>
            <Button
              mode="contained"
              onPress={handleEnableNotifications}
              style={styles.enableButton}
              labelStyle={styles.buttonLabel}
            >
              Enable Notifications
            </Button>
            
            <TouchableOpacity
              onPress={handleNotNow}
              style={styles.notNowButton}
            >
              <Text style={styles.notNowText}>Not Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOvelray: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Raleway-Bold',
  },
  description: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
    fontFamily: 'Raleway-Regular',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  enableButton: {
    width: '100%',
    backgroundColor: '#452c63',
    marginBottom: 12,
    borderRadius: 30,
  },
  buttonLabel: {
    fontSize: 16,
    fontFamily: 'Raleway-SemiBold',
    color: '#000000',
  },
  notNowButton: {
    padding: 12,
  },
  notNowText: {
    color: '#666666',
    fontSize: 16,
    fontFamily: 'Raleway-Medium',
  },
});

export default NotificationPrompt; 