import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const PrivacyPolicy = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>Privacy Policy</Text>
      </View>
      <ScrollView style={styles.content}>
        <Text variant="titleMedium" style={styles.sectionTitle}>1. Information We Collect</Text>
        <Text style={styles.paragraph}>
          We collect information you provide directly to us when you create an account, such as your name, email address, 
          and password. We may also collect information about your use of the application, including your reading preferences 
          and interaction with content.
        </Text>

        <Text variant="titleMedium" style={styles.sectionTitle}>2. How We Use Your Information</Text>
        <Text style={styles.paragraph}>
          We use the information we collect to provide, maintain, and improve our services, to develop new features, 
          and to protect Market Breakdown and our users. We may also use the information to communicate with you about 
          products, services, and updates.
        </Text>

        <Text variant="titleMedium" style={styles.sectionTitle}>3. Information Sharing</Text>
        <Text style={styles.paragraph}>
          We do not share your personal information with companies, organizations, or individuals outside of Market Breakdown 
          except in the following cases:
        </Text>
        <Text style={styles.bulletPoint}>• With your consent</Text>
        <Text style={styles.bulletPoint}>• For legal reasons</Text>
        <Text style={styles.bulletPoint}>• With our service providers</Text>

        <Text variant="titleMedium" style={styles.sectionTitle}>4. Data Security</Text>
        <Text style={styles.paragraph}>
          We take reasonable measures to help protect your personal information from loss, theft, misuse, unauthorized access, 
          disclosure, alteration, and destruction.
        </Text>

        <Text variant="titleMedium" style={styles.sectionTitle}>5. Your Choices</Text>
        <Text style={styles.paragraph}>
          You can access, update, or delete your account information at any time through the application settings. 
          You can also choose to opt out of certain communications.
        </Text>

        <Text variant="titleMedium" style={styles.sectionTitle}>6. Cookies and Similar Technologies</Text>
        <Text style={styles.paragraph}>
          We use cookies and similar technologies to collect information about your activity, browser, and device. 
          You can control or block these technologies through your browser settings.
        </Text>

        <Text variant="titleMedium" style={styles.sectionTitle}>7. Children's Privacy</Text>
        <Text style={styles.paragraph}>
          Our services are not directed to children under the age of 13, and we do not knowingly collect personal 
          information from children under 13.
        </Text>

        <Text variant="titleMedium" style={styles.sectionTitle}>8. Changes to This Policy</Text>
        <Text style={styles.paragraph}>
          We may update this privacy policy from time to time. We will notify you of any changes by posting the new 
          policy on this page and updating the effective date.
        </Text>

        <Text variant="titleMedium" style={styles.sectionTitle}>9. Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have any questions about this privacy policy, please contact us at privacy@marketbreakdown.com.
        </Text>

        <View style={styles.buttonContainer}>
          <Button 
            mode="contained" 
            onPress={() => navigation.goBack()}
            style={styles.button}
          >
            Back to Settings
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
  },
  paragraph: {
    marginBottom: 16,
    lineHeight: 22,
  },
  bulletPoint: {
    marginLeft: 16,
    marginBottom: 8,
    lineHeight: 22,
  },
  buttonContainer: {
    marginTop: 24,
    marginBottom: 40,
  },
  button: {
    padding: 4,
  }
});

export default PrivacyPolicy; 