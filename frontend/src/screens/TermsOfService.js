import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const TermsOfService = () => {
  const navigation = useNavigation();
  const termsUrl = 'https://mazebuilders.com/velraterms';

  useEffect(() => {
    // Open the terms of service in the browser when the component mounts
    const openTermsOfService = async () => {
      const canOpen = await Linking.canOpenURL(termsUrl);
      if (canOpen) {
        await Linking.openURL(termsUrl);
        // Navigate back after opening the URL
        navigation.goBack();
      } else {
        console.error('Cannot open URL:', termsUrl);
      }
    };

    openTermsOfService();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#A0C090" />
        </TouchableOpacity>
        <Text style={styles.title}>Terms of Service</Text>
        <View style={styles.placeholder} />
      </View>
      
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#c1ff72" />
        <Text style={styles.redirectText}>
          Redirecting to Terms of Service...
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
    padding: 16,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redirectText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333333',
    textAlign: 'center',
  }
});

export default TermsOfService; 