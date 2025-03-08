import React, { useEffect } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, SafeAreaView, Linking, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button } from 'react-native-paper';

const InAppBrowser = ({ visible, url, onClose, title }) => {
  // Add console logs for debugging
  console.log('InAppBrowser props:', { visible, url, title });
  
  // Use useEffect to show an alert when the modal becomes visible
  useEffect(() => {
    if (visible && url) {
      console.log('Modal is now visible, showing alert');
      Alert.alert(
        title || 'Open Article',
        'Would you like to open this article in your browser?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: onClose
          },
          {
            text: 'Open',
            onPress: () => {
              console.log('Opening URL in browser from alert:', url);
              Linking.openURL(url).catch(err => {
                console.error('Error opening URL:', err);
                Alert.alert('Error', 'Could not open the article link. Please try again later.');
              });
              onClose();
            }
          }
        ],
        { cancelable: true }
      );
    }
  }, [visible, url, title, onClose]);
  
  // Return an empty modal since we're using Alert instead
  return null;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  url: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 32,
    textAlign: 'center',
  },
  openButton: {
    width: '100%',
    marginBottom: 16,
    paddingVertical: 8,
  },
  cancelButton: {
    width: '100%',
    borderColor: '#000000',
  },
});

export default InAppBrowser; 