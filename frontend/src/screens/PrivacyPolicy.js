import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity, Linking } from 'react-native';
import { Text, Button, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const PrivacyPolicy = () => {
  const navigation = useNavigation();
  const privacyPolicyUrl = 'https://mazebuilders.com/velraprivacy';

  useEffect(() => {
    // Open the privacy policy in the browser when the component mounts
    const openPrivacyPolicy = async () => {
      const canOpen = await Linking.canOpenURL(privacyPolicyUrl);
      if (canOpen) {
        await Linking.openURL(privacyPolicyUrl);
        // Navigate back after opening the URL
        navigation.goBack();
      } else {
        console.error('Cannot open URL:', privacyPolicyUrl);
      }
    };

    openPrivacyPolicy();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#A0C090" />
        </TouchableOpacity>
        <Text variant="headlineMedium" style={styles.title}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>
      
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#c1ff72" />
        <Text style={styles.redirectText}>
          Redirecting to Privacy Policy...
        </Text>
      </View>
    </SafeAreaView>
  );
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
    padding: 16,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  title: {
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  redirectText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333333',
    textAlign: 'center',
  }
});

export default PrivacyPolicy; 