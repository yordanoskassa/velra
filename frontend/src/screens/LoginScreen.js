import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  Alert,
  ScrollView,
  Animated,
  Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Motion } from '@legendapp/motion';
import AppleButton, { ButtonType, ButtonStyle } from '../components/AppleButton';
import * as AppleAuthentication from 'expo-apple-authentication';

const LoginScreen = ({ route, navigation: propNavigation }) => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [backButtonPressed, setBackButtonPressed] = useState(false);
  const backButtonScale = new Animated.Value(1);
  
  const { login, appleLogin, resetPassword, isLoading: authLoading, error } = useAuth();
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

  useEffect(() => {
    if (error) {
      Alert.alert('Login Error', error);
    }
  }, [error]);

  // Display message from route params if available
  useEffect(() => {
    if (route?.params?.message) {
      Alert.alert('Login Required', route.params.message);
    }
  }, [route?.params?.message]);

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

  const handleLogin = async () => {
    if (validatePassword()) {
      try {
        const success = await login(email, password);
        
        if (success) {
          // Check if there's a redirection request in the route params
          const { redirectAfterLogin, redirectRoute, articleData, message } = route.params || {};
          
          if (redirectAfterLogin && redirectRoute) {
            console.log(`Redirecting to ${redirectRoute} after successful login`);
            
            // Handle different redirection scenarios
            if (redirectRoute === 'ArticleDetails' && articleData) {
              navigation.navigate(redirectRoute, { article: articleData });
            } else if (redirectRoute === 'BackToArticle') {
              navigation.goBack();
            } else if (redirectRoute === 'BackToSource') {
              navigation.goBack();
            } else {
              navigation.navigate(redirectRoute);
            }
          }
          // Otherwise AuthContext will handle default navigation
        }
      } catch (error) {
        Alert.alert('Login Failed', error.message);
      }
    }
  };

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

  const handleResetPassword = async () => {
    if (!email.includes('@')) {
      setEmailError('Please enter a valid email');
      return;
    }
    
    setIsResettingPassword(true);
    
    try {
      await resetPassword(email);
      setResetEmailSent(true);
    } catch (error) {
      Alert.alert('Reset Password Failed', error.message);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const goBack = () => {
    if (isResettingPassword) {
      setIsResettingPassword(false);
      setResetEmailSent(false);
    } else if (step > 1) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleBackButtonPress = () => {
    // Visual feedback
    setBackButtonPressed(true);
    Animated.sequence([
      Animated.timing(backButtonScale, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(backButtonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true
      })
    ]).start(() => {
      setBackButtonPressed(false);
      goBack();
    });
  };

  // Render Apple Sign In button if available
  const renderAppleSignInButton = () => {
    // Always show the button on iOS
    if (Platform.OS === 'ios') {
      return (
        <AppleButton
          buttonType={ButtonType.CONTINUE}
          buttonStyle={ButtonStyle.BLACK}
          style={styles.appleSignInButton}
          onPress={handleAppleLogin}
          disabled={isLoading}
        />
      );
    }
    
    return null;
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
            <Animated.View style={{ transform: [{ scale: backButtonScale }] }}>
              <TouchableOpacity 
                onPress={handleBackButtonPress} 
                style={[
                  styles.backButton,
                  backButtonPressed && styles.backButtonPressed
                ]}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={24} color="#000000" />
              </TouchableOpacity>
            </Animated.View>
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
              delay:.1,
            }}
            style={styles.headerContainer}
          >
            <Text style={styles.welcomeText}>Welcome</Text>
            <Text style={styles.headerText}>
              {isResettingPassword 
                ? "Reset Password" 
                : step === 1 
                  ? "What's your email?" 
                  : "Enter your password"}
            </Text>
            <Text style={styles.subHeaderText}>
              {isResettingPassword 
                ? "We'll send you a reset link" 
                : step === 1 
                  ? "Login to your account or use Apple Sign In" 
                  : "Make sure it's secure"}
            </Text>
          </Motion.View>

          {/* Reset Password Success Message */}
          {resetEmailSent && (
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
              }}
              style={styles.successMessage}
            >
              <Ionicons name="checkmark-circle" size={60} color="#000000" />
              <Text style={styles.successText}>
                Reset link sent! Check your email.
              </Text>
              <TouchableOpacity
                style={styles.backToLoginButton}
                onPress={() => {
                  setResetEmailSent(false);
                  setIsResettingPassword(false);
                }}
              >
                <Text style={styles.backToLoginText}>Back to Login</Text>
              </TouchableOpacity>
            </Motion.View>
          )}

          {!resetEmailSent && (
            <>
              {/* Step 1: Email */}
              {step === 1 && !isResettingPassword && (
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

              {/* Reset Password Email Input */}
              {isResettingPassword && !resetEmailSent && (
                <Motion.View
                  animate={{
                    opacity: 1,
                    x: 0,
                  }}
                  initial={{
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
                  <TouchableOpacity 
                    style={styles.backToLoginLinkContainer}
                    onPress={() => setIsResettingPassword(false)}
                  >
                    <Text style={styles.backToLoginLink}>Back to Login</Text>
                  </TouchableOpacity>
                </Motion.View>
              )}

              {/* Step 2: Password */}
              {step === 2 && !isResettingPassword && (
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
                    placeholder="Password"
                    placeholderTextColor="#666"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoFocus
                  />
                  {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
                  <TouchableOpacity 
                    style={styles.forgotPasswordContainer}
                    onPress={() => setIsResettingPassword(true)}
                  >
                    <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                  </TouchableOpacity>
                </Motion.View>
              )}

              {/* Next/Login/Reset Button */}
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
                    isLoading ? styles.buttonDisabled : null,
                  ]}
                  onPress={() => {
                    if (isResettingPassword) {
                      handleResetPassword();
                    } else if (step === 1 && validateEmail()) {
                      setStep(2);
                    } else if (step === 2) {
                      handleLogin();
                    }
                  }}
                  disabled={
                    (step === 1 && !email.trim()) || 
                    (step === 2 && !password.trim()) || 
                    isLoading
                  }
                >
                  {isLoading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.buttonText}>
                      {isResettingPassword 
                        ? "Send Reset Link" 
                        : step === 1 
                          ? "Login" 
                          : "Log In"}
                    </Text>
                  )}
                </TouchableOpacity>
              </Motion.View>

              {/* Divider */}
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

              {/* Sign Up Link */}
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
                style={styles.signupContainer}
              >
                <Text style={styles.signupText}>
                  Don't have an account?{' '}
                  <Text 
                    style={styles.signupLink}
                    onPress={() => navigation.navigate('Register')}
                  >
                    Sign Up
                  </Text>
                </Text>
              </Motion.View>
            </>
          )}
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
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 0,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPressed: {
    backgroundColor: 'rgba(180, 180, 180, 0.7)',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 100,
    marginBottom: 20,
  },
  logoText: {
    fontFamily: 'Times New Roman',
    fontSize: 36,
    fontWeight: 'bold',
    color: '#000000',
    letterSpacing: 2,
  },
  headerContainer: {
    marginTop: 20,
    marginBottom: 40,
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
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#000000',
    fontSize: 14,
    marginTop: 8,
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
  socialButtonsContainer: {
    width: '100%',
    marginTop: 20,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    width: '100%',
    minHeight: 54,
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  appleButtonText: {
    color: '#FFFFFF',
  },
  appleSignInButton: {
    width: '100%',
    marginBottom: 12,
    height: 54,
    borderRadius: 12,
  },
  socialIcon: {
    marginRight: 10,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  signupContainer: {
    marginTop: 30,
    alignItems: 'center',
  },
  signupText: {
    color: '#333333',
    fontSize: 14,
  },
  signupLink: {
    color: '#000000',
    fontWeight: 'bold',
  },
  successMessage: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  successText: {
    color: '#000000',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  backToLoginButton: {
    backgroundColor: '#000000',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  backToLoginText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backToLoginLinkContainer: {
    alignItems: 'flex-start',
    marginTop: 15,
  },
  backToLoginLink: {
    color: '#000000',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#DDDDDD',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#777777',
    fontSize: 14,
  },
  appleSignUpContainer: {
    marginTop: 16,
    width: '100%',
  },
  appleSignUpButton: {
    width: '100%',
    height: 44,
    borderRadius: 8,
  },
});

export default LoginScreen; 