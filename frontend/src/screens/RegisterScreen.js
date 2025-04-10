import React, { useState, useEffect } from 'react';
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
  Dimensions,
  Animated,
  Linking
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Motion } from '@legendapp/motion';
import { Checkbox } from 'react-native-paper';
import AppleButton, { ButtonType, ButtonStyle } from '../components/AppleButton';
import * as AppleAuthentication from 'expo-apple-authentication';

const RegisterScreen = ({ route, navigation: propNavigation }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { register, appleLogin, isLoading: authLoading, error } = useAuth();
  const navigation = propNavigation || useNavigation();
  const [isLoading, setIsLoading] = useState(false);

  // Check if Apple Authentication is available on this device
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  useEffect(() => {
    // Check if Apple Authentication is available
    if (Platform.OS === 'ios') {
      try {
        setAppleAuthAvailable(appleAuth.isSupported);
        console.log('Apple Sign In available:', appleAuth.isSupported);
      } catch (error) {
        console.log('Error checking Apple Sign In availability:', error);
        setAppleAuthAvailable(false);
      }
    }
  }, []);

  const handleAppleLogin = async () => {
    try {
      setIsLoading(true);
      console.log('Starting Apple Sign In process...');
      
      // Check if Apple Authentication is available on this device
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      
      if (!isAvailable) {
        console.log('Apple Sign In is not available on this device');
        Alert.alert('Not Supported', 'Apple Sign In is not available on this device');
        setIsLoading(false);
        return;
      }
      
      // Perform the Apple sign-in request using Expo's AppleAuthentication
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      
      console.log('Apple Sign In credential received:', {
        identityToken: credential.identityToken ? credential.identityToken.substring(0, 20) + '...' : 'null',
        fullName: credential.fullName,
        user: credential.user,
        email: credential.email,
      });
      
      // Ensure we have an identity token
      if (!credential.identityToken) {
        console.error('Apple Sign In failed - no identity token returned');
        Alert.alert('Authentication Error', 'Failed to get authentication data from Apple.');
        return;
      }
      
      // Send the credential to your backend
      try {
        const success = await appleLogin(credential.identityToken, credential.fullName);
        console.log('Apple Sign In successful');

        if (success) {
          // Check if there's a redirection request in the route params
          const { redirectAfterLogin, redirectRoute, articleData } = route.params || {};
          
          if (redirectAfterLogin && redirectRoute) {
            console.log(`Redirecting to ${redirectRoute} after successful login`);
            
            // Handle different redirection scenarios
            if (redirectRoute === 'ArticleDetails' && articleData) {
              navigation.navigate(redirectRoute, { article: articleData });
            } else if (redirectRoute === 'BackToArticle' || redirectRoute === 'BackToSource') {
              navigation.goBack();
            } else {
              navigation.navigate(redirectRoute);
            }
          }
          // Otherwise AuthContext will handle default navigation
        }
      } catch (apiError) {
        console.error('API error during Apple Sign In:', apiError);
        Alert.alert(
          'Login Failed', 
          `Server couldn't process Apple login: ${apiError.message}`
        );
      }
      
    } catch (error) {
      console.log('Apple Sign In error:', error);
      
      if (error.code === AppleAuthentication.AppleAuthenticationError.CANCELED) {
        console.log('User canceled Apple Sign In');
      } else {
        Alert.alert(
          'Apple Login Failed', 
          `Error: ${error.message || 'Unknown error'}`
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Render Apple Sign In button if available
  const renderAppleSignInButton = () => {
    // Always show the button on iOS
    if (Platform.OS === 'ios') {
      return (
        <AppleButton
          buttonType={ButtonType.SIGN_UP}
          buttonStyle={ButtonStyle.BLACK}
          style={styles.appleSignInButton}
          onPress={handleAppleLogin}
          disabled={isLoading}
        />
      );
    }
    
    return null;
  };

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

  const validateConfirmPassword = () => {
    if (confirmPassword !== password) {
      setConfirmPasswordError('Passwords do not match');
      return false;
    } else {
      setConfirmPasswordError('');
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
    
    // Move to next step if not on final step
    if (step < 4) {
      console.log(`Moving to step ${step + 1}`);
      setStep(step + 1);
      return;
    }
    
    // Final step - submit registration
    console.log('On final step, submitting registration');
    
    try {
      console.log('Registration data:', { name, email, password: '***' });
      
      // Show loading indicator
      setIsSubmitting(true);
      
      // Call register function
      const userData = await register(name, email, password);
      
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

  // Add functions to open Terms and Privacy URLs
  const openTermsOfService = async () => {
    const termsUrl = 'https://mazebuilders.com/velraterms';
    const canOpen = await Linking.canOpenURL(termsUrl);
    if (canOpen) {
      await Linking.openURL(termsUrl);
    } else {
      console.error('Cannot open URL:', termsUrl);
      Alert.alert('Error', 'Could not open the terms of service. Please try again later.');
    }
  };

  const openPrivacyPolicy = async () => {
    const privacyPolicyUrl = 'https://mazebuilders.com/velraprivacy';
    const canOpen = await Linking.canOpenURL(privacyPolicyUrl);
    if (canOpen) {
      await Linking.openURL(privacyPolicyUrl);
    } else {
      console.error('Cannot open URL:', privacyPolicyUrl);
      Alert.alert('Error', 'Could not open the privacy policy. Please try again later.');
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.backgroundOvelray} />
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
            <Text style={styles.headerText}>
              {step === 1 
                ? "Name" 
                : step === 2 
                  ? "Email" 
                : step === 3
                  ? "Password"
                  : "Confirm Password"}
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

          {/* Step 4: Confirm Password */}
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
              style={styles.inputContainer}
            >
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor="#666"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoFocus
              />
              {confirmPasswordError ? <Text style={styles.errorText}>{confirmPasswordError}</Text> : null}
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
                } else if (step === 4 && validateConfirmPassword()) {
                  handleRegister();
                }
              }}
              disabled={
                (step === 1 && !name.trim()) || 
                (step === 2 && !email.trim()) || 
                (step === 3 && !password.trim()) ||
                (step === 4 && !confirmPassword.trim()) ||
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

          {/* Add Apple Sign In button after the form */}
          {Platform.OS === 'ios' && (
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
          )}

          {/* Apple Sign In Button */}
          {Platform.OS === 'ios' && (
            <Motion.View
              animate={{
                opacity: 1,
                y: 0,
              }}
              initial={{
                opacity: 0,
                y: 20,
              }}
              transition={{
                type: 'spring',
                damping: 20,
                stiffness: 300,
                delay: 0.4,
              }}
              style={styles.socialButtonsContainer}
            >
              {renderAppleSignInButton()}
            </Motion.View>
          )}
          
          {/* Login Link - moved below Apple Sign In */}
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
    backgroundColor: '#F8F5E9',
  },
  backgroundOvelray: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    zIndex: 0,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 80,
  },
  backButtonContainer: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#c1ff72',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  headerContainer: {
    marginBottom: 30,
    marginTop: 20,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 5,
    fontFamily: 'Syne',
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333333',
    borderWidth: 1,
    borderColor: '#E0DCD0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    fontFamily: 'System',
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
    backgroundColor: '#c1ff72',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#222222',
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
    fontFamily: 'System',
  },
  loginLink: {
    color: '#000000',
    fontWeight: 'bold',
    fontFamily: 'System',
  },
  disclaimerContainer: {
    width: '100%',
    marginTop: 20,
  },
  disclaimerBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E0DCD0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  disclaimerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333333',
  },
  disclaimerText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333333',
    marginBottom: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#F0EDE5',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E0DCD0',
  },
  checkboxLabel: {
    fontSize: 15,
    color: '#333333',
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
  checkbox: {
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 3,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0DCD0',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#333333',
    fontSize: 14,
  },
  socialButtonsContainer: {
    width: '100%',
    marginTop: 20,
  },
  appleSignInButton: {
    width: '100%',
    marginBottom: 12,
    height: 54,
    borderRadius: 12,
  },
  registerButton: {
    backgroundColor: '#c1ff72',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 10,
  },
  appleButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#452c63',
    borderRadius: 0,
    marginBottom: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  legalContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    marginTop: 'auto',
    marginBottom: 16,
    alignItems: 'center',
  },
  legalText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#666666',
    lineHeight: 18,
  },
  legalLink: {
    color: '#444444',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});

export default RegisterScreen; 