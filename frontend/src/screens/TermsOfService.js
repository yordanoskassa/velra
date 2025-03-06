import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const TermsOfService = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>Terms of Service</Text>
      </View>
      <ScrollView style={styles.content}>
        <Text variant="titleMedium" style={styles.sectionTitle}>1. Acceptance of Terms</Text>
        <Text style={styles.paragraph}>
          By accessing or using the Market Breakdown application, you agree to be bound by these Terms of Service. 
          If you do not agree to these terms, please do not use the application.
        </Text>

        <Text variant="titleMedium" style={styles.sectionTitle}>2. Description of Service</Text>
        <Text style={styles.paragraph}>
          Market Breakdown provides financial news and market insights. The content is for informational purposes only 
          and should not be considered as financial advice.
        </Text>

        <Text variant="titleMedium" style={styles.sectionTitle}>3. User Accounts</Text>
        <Text style={styles.paragraph}>
          To access certain features of the application, you may be required to create an account. You are responsible 
          for maintaining the confidentiality of your account information and for all activities that occur under your account.
        </Text>

        <Text variant="titleMedium" style={styles.sectionTitle}>4. User Conduct</Text>
        <Text style={styles.paragraph}>
          You agree not to use the application for any unlawful purpose or in any way that could damage, disable, 
          overburden, or impair the service.
        </Text>

        <Text variant="titleMedium" style={styles.sectionTitle}>5. Intellectual Property</Text>
        <Text style={styles.paragraph}>
          All content included in the application, such as text, graphics, logos, and software, is the property of 
          Market Breakdown or its content suppliers and is protected by copyright laws.
        </Text>

        <Text variant="titleMedium" style={styles.sectionTitle}>6. Disclaimer of Warranties</Text>
        <Text style={styles.paragraph}>
          The application is provided "as is" without warranties of any kind, either express or implied. Market Breakdown 
          does not warrant that the application will be error-free or uninterrupted.
        </Text>

        <Text variant="titleMedium" style={styles.sectionTitle}>7. Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          Market Breakdown shall not be liable for any direct, indirect, incidental, special, or consequential damages 
          resulting from the use or inability to use the application.
        </Text>

        <Text variant="titleMedium" style={styles.sectionTitle}>8. Changes to Terms</Text>
        <Text style={styles.paragraph}>
          Market Breakdown reserves the right to modify these terms at any time. Your continued use of the application 
          after such changes constitutes your acceptance of the new terms.
        </Text>

        <Text variant="titleMedium" style={styles.sectionTitle}>9. Governing Law</Text>
        <Text style={styles.paragraph}>
          These terms shall be governed by and construed in accordance with the laws of the jurisdiction in which 
          Market Breakdown operates, without regard to its conflict of law provisions.
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
  buttonContainer: {
    marginTop: 24,
    marginBottom: 40,
  },
  button: {
    padding: 4,
  }
});

export default TermsOfService; 