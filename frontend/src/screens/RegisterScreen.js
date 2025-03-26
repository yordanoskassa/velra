import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Motion } from '@legendapp/motion';
import { Checkbox } from 'react-native-paper';

const RegisterScreen = () => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [disclaimerError, setDisclaimerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { register, isLoading } = useAuth();
  const navigation = useNavigation();

  const validateName = () => {
    if (!name.trim()) {
      setNameError('Please enter your name');
      return false;
    } else {
      setNameError('');
      return true;
    }
  };

  const validateEmail = () => {
    if (!email.includes('@')) {
      setEmailError('Please enter a valid email');
      return false;
    } else {
      setEmailError('');
      return true;
    }
  };

  const validatePassword = () => {
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return false;
    } else {
      setPasswordError('');
      return true;
    }
  };

  const validateDisclaimer = () => {
    if (!disclaimerAccepted) {
      setDisclaimerError('You must accept the disclaimer to continue');
      return false;
    } else {
      setDisclaimerError('');
      return true;
    }
  };

  const handleRegister = async () => {
    console.log(`Current step: ${step}`);
    
    // Validate current step
    if (step === 3 && !validatePassword()) {
      console.log('Password validation failed');
      return;
    }
    
    if (step === 4 && !validateDisclaimer()) {
      console.log('Disclaimer validation failed');
      return;
    }
    
    // Move to next step if not on final step
    if (step < 4) {
      console.log(`Moving to step ${step + 1}`);
      setStep(step + 1);
      return;
    }
    
    // Final step - submit registration
    console.log('On final step, submitting registration');
    
    try {
      console.log('Registration data:', { name, email, password: '***', disclaimerAccepted });
      
      // Show loading indicator
      setIsSubmitting(true);
      
      // Call register function
      const userData = await register(name, email, password, disclaimerAccepted);
      
      console.log('Registration successful, user data received:', userData);
      
      // Show success message
      Alert.alert(
        'Registration Successful',
        'Your account has been created successfully.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Registration failed in component:', error);
      
      // Show error message
      Alert.alert(
        'Registration Failed',
        error.message || 'An error occurred during registration. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.backgroundOverlay} />
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* Back Button */}
          <Motion.View
            animate={{
              opacity: 1,
              y: 0,
            }}
            initial={{
              opacity: 0,
              y: -20,
            }}
            transition={{
              type: 'spring',
              damping: 20,
              stiffness: 300,
            }}
            style={styles.backButtonContainer}
          >
            <TouchableOpacity onPress={goBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#000000" />
            </TouchableOpacity>
          </Motion.View>

          {/* Logo - Removed */}

          {/* Header */}
          <Motion.View
            animate={{
              opacity: 1,
              y: 0,
            }}
            initial={{
              opacity: 0,
              y: -30,
            }}
            transition={{
              type: 'spring',
              damping: 20,
              stiffness: 300,
              delay: 0.1,
            }}
            style={styles.headerContainer}
          >
            <Text style={styles.welcomeText}>Create Account</Text>
            <Text style={styles.headerText}>
              {step === 1 
                ? "What's your name?" 
                : step === 2 
                  ? "What's your email?" 
                : step === 3
                  ? "Create a password"
                  : "Important Disclaimer"}
            </Text>
            <Text style={styles.subHeaderText}>
              {step === 1 
                ? "Let's get to know you" 
                : step === 2 
                  ? "We'll use this for your account" 
                : step === 3
                  ? "Make sure it's secure"
                  : "Please read and accept"}
            </Text>
          </Motion.View>

          {/* Step 1: Name */}
          {step === 1 && (
            <Motion.View
              animate={{
                opacity: 1,
                x: 0,
              }}
              initial={{
                opacity: 0,
                x: -100,
              }}
              exit={{
                opacity: 0,
                x: -100,
              }}
              transition={{
                type: 'spring',
                damping: 20,
                stiffness: 300,
                delay: 0.2,
              }}
              style={styles.inputContainer}
            >
              <TextInput
                style={styles.input}
                placeholder="Your full name"
                placeholderTextColor="#666"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoFocus
              />
              {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
            </Motion.View>
          )}

          {/* Step 2: Email */}
          {step === 2 && (
            <Motion.View
              animate={{
                opacity: 1,
                x: 0,
              }}
              initial={{
                opacity: 0,
                x: -100,
              }}
              exit={{
                opacity: 0,
                x: -100,
              }}
              transition={{
                type: 'spring',
                damping: 20,
                stiffness: 300,
                delay: 0.2,
              }}
              style={styles.inputContainer}
            >
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor="#666"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoFocus
              />
              {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
            </Motion.View>
          )}

          {/* Step 3: Password */}
          {step === 3 && (
            <Motion.View
              animate={{
                opacity: 1,
                x: 0,
              }}
              initial={{
                opacity: 0,
                x: 100,
              }}
              exit={{
                opacity: 0,
                x: 100,
              }}
              transition={{
                type: 'spring',
                damping: 20,
                stiffness: 300,
                delay: 0.2,
              }}
              style={styles.inputContainer}
            >
              <TextInput
                style={styles.input}
                placeholder="Password (min 8 characters)"
                placeholderTextColor="#666"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoFocus
              />
              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
            </Motion.View>
          )}

          {/* Step 4: Disclaimer */}
          {step === 4 && (
            <Motion.View
              animate={{
                opacity: 1,
                x: 0,
              }}
              initial={{
                opacity: 0,
                x: 100,
              }}
              exit={{
                opacity: 0,
                x: 100,
              }}
              transition={{
                type: 'spring',
                damping: 20,
                stiffness: 300,
                delay: 0.2,
              }}
              style={styles.disclaimerContainer}
            >
              <View style={styles.disclaimerBox}>
                <Text style={styles.disclaimerTitle}>Financial Disclaimer</Text>
                <Text style={styles.disclaimerText}>
                  This application does not provide financial advice. The information presented is for informational purposes only and should not be considered as investment advice. Market data, news, and insights are provided as-is without any guarantees of accuracy or reliability. Always consult with a qualified financial advisor before making investment decisions.
                </Text>
                <View style={styles.checkboxContainer}>
                  <Checkbox
                    status={disclaimerAccepted ? 'checked' : 'unchecked'}
                    onPress={() => setDisclaimerAccepted(!disclaimerAccepted)}
                    color="#000000"
                    style={styles.checkbox}
                  />
                  <Text style={styles.checkboxLabel}>
                    I understand and agree that this app does not provide financial advice
                  </Text>
                </View>
                {disclaimerError ? <Text style={styles.errorText}>{disclaimerError}</Text> : null}
              </View>
            </Motion.View>
          )}

          {/* Next/Register Button */}
          <Motion.View
            animate={{
              opacity: 1,
              y: 0,
            }}
            initial={{
              opacity: 0,
              y: 50,
            }}
            transition={{
              type: 'spring',
              damping: 20,
              stiffness: 300,
              delay: 0.3,
            }}
            style={styles.buttonContainer}
          >
            <TouchableOpacity
              style={[
                styles.button,
                (isLoading || isSubmitting) ? styles.buttonDisabled : null,
              ]}
              onPress={() => {
                if (isLoading || isSubmitting) return;
                
                if (step === 1 && validateName()) {
                  setStep(2);
                } else if (step === 2 && validateEmail()) {
                  setStep(3);
                } else if (step === 3 && validatePassword()) {
                  setStep(4);
                } else if (step === 4) {
                  handleRegister();
                }
              }}
              disabled={
                (step === 1 && !name.trim()) || 
                (step === 2 && !email.trim()) || 
                (step === 3 && !password.trim()) ||
                (step === 4 && !disclaimerAccepted) || 
                isLoading ||
                isSubmitting
              }
            >
              {isLoading || isSubmitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.buttonText}>
                  {step < 4 ? 'Continue' : 'Sign Up'}
                </Text>
              )}
            </TouchableOpacity>
          </Motion.View>

          {/* Login Link */}
          <Motion.View
            animate={{
              opacity: 1,
            }}
            initial={{
              opacity: 0,
            }}
            transition={{
              duration: 0.5,
              delay: 0.5,
            }}
            style={styles.loginContainer}
          >
            <Text style={styles.loginText}>
              Already have an account?{' '}
              <Text 
                style={styles.loginLink}
                onPress={() => navigation.navigate('Login')}
              >
                Log In
              </Text>
            </Text>
          </Motion.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    zIndex: 0,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 60,
  },
  backButtonContainer: {
    alignItems: 'flex-start',
    marginBottom: 20,
    marginTop: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 245, 245, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerContainer: {
    marginBottom: 40,
    marginTop: 10,
  },
  welcomeText: {
    fontSize: 18,
    color: '#000000',
    fontWeight: '600',
    marginBottom: 8,
  },
  headerText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
  },
  subHeaderText: {
    fontSize: 16,
    color: '#555555',
    lineHeight: 22,
    opacity: 0.9,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: 'rgba(245, 245, 245, 0.9)',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#333333',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  errorText: {
    color: '#FF3B30',
    marginTop: 5,
    fontSize: 14,
  },
  buttonContainer: {
    marginTop: 20,
  },
  button: {
    backgroundColor: '#000000',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
  loginContainer: {
    marginTop: 30,
    alignItems: 'center',
  },
  loginText: {
    color: '#333333',
    fontSize: 14,
  },
  loginLink: {
    color: '#000000',
    fontWeight: 'bold',
  },
  disclaimerContainer: {
    width: '100%',
    marginTop: 20,
  },
  disclaimerBox: {
    backgroundColor: 'rgba(245, 245, 245, 0.9)',
    borderRadius: 8,
    padding: 24,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  disclaimerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#000000',
  },
  disclaimerText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#444444',
    marginBottom: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#000000',
  },
  checkboxLabel: {
    fontSize: 15,
    color: '#333',
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
  checkbox: {
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 3,
  },
});

export default RegisterScreen; 