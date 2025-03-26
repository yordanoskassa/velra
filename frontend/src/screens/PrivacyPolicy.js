import React from 'react';
import { ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import GridBackground from '../components/GridBackground';

const PrivacyPolicy = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      {/* Grid Background */}
      <GridBackground />
      
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text variant="headlineMedium" style={styles.title}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>
      
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>DECODR</Text>
      </View>
      
      <ScrollView style={styles.content}>
        <Text variant="titleMedium" style={styles.sectionTitle}>1. Information We Collect</Text>
        <Text style={styles.paragraph}>
          DECODR collects information that you provide directly to us, such as when you create an account, 
          subscribe to our services, or contact us for support.
        </Text>

        <Text variant="titleMedium" style={styles.sectionTitle}>2. How We Use Your Information</Text>
        <Text style={styles.paragraph}>
          We use the information we collect to provide, maintain, and improve our services, 
          to communicate with you, and to personalize your experience.
        </Text>

        <Text variant="titleMedium" style={styles.sectionTitle}>3. Information Sharing</Text>
        <Text style={styles.paragraph}>
          We do not share your personal information with third parties except as described in this privacy policy.
        </Text>

        <Text variant="titleMedium" style={styles.sectionTitle}>4. Data Security</Text>
        <Text style={styles.paragraph}>
          We take reasonable measures to help protect your personal information from loss, theft, misuse, 
          unauthorized access, disclosure, alteration, and destruction.
        </Text>

        <Text variant="titleMedium" style={styles.sectionTitle}>5. Your Choices</Text>
        <Text style={styles.paragraph}>
          You can access, update, or delete your account information at any time through the application settings.
        </Text>

        <Text variant="titleMedium" style={styles.sectionTitle}>6. Changes to This Policy</Text>
        <Text style={styles.paragraph}>
          We may update this privacy policy from time to time. We will notify you of any changes by posting 
          the new privacy policy on this page.
        </Text>

        <Text variant="titleMedium" style={styles.sectionTitle}>7. Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have any questions about this privacy policy, please contact us at support@decodr.com.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
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
  logoContainer: {
    alignItems: 'center',
    marginVertical: 10,
    zIndex: 1,
  },
  logoText: {
    fontFamily: 'OldEnglish',
    fontSize: 24,
    color: '#000000',
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    padding: 16,
    zIndex: 1,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
    fontSize: 14,
  },
  paragraph: {
    marginBottom: 16,
    lineHeight: 22,
    fontSize: 12,
  }
});

export default PrivacyPolicy; 