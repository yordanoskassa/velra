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
  Animated
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Motion } from '@legendapp/motion';
import * as Google from 'expo-auth-session/providers/google';

const LoginScreen = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [backButtonPressed, setBackButtonPressed] = useState(false);
  const backButtonScale = new Animated.Value(1);
  
  const { login, googleLogin, resetPassword, isLoading, error } = useAuth();
  const navigation = useNavigation();

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: '960956410891-k6imbmuqgd40hiurti4mes5kp78gvggq.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      handleGoogleLogin(authentication?.accessToken || '');
    }
  }, [response]);

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
        await login(email, password);
        // The login function in AuthContext will handle navigation
      } catch (error) {
        Alert.alert('Login Failed', error.message);
      }
    }
  };

  const handleGoogleLogin = async (token) => {
    try {
      await googleLogin(token);
      // The googleLogin function in AuthContext will handle navigation
    } catch (error) {
      Alert.alert('Google Login Failed', error.message);
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

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
            </Animated.View>
          </Motion.View>

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
                  ? "Login to your account" 
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
              <Ionicons name="checkmark-circle" size={60} color="#FFFFFF" />
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
                          ? "Continue" 
                          : "Log In"}
                    </Text>
                  )}
                </TouchableOpacity>
              </Motion.View>

              {/* Google Login (only on first step) */}
              {step === 1 && !isResettingPassword && (
                <Motion.View
                  animate={{
                    opacity: 1,
                  }}
                  initial={{
                    opacity: 0,
                  }}
                  transition={{
                    duration: 0.5,
                    delay: 0.4,
                  }}
                  style={styles.socialLoginContainer}
                >
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </View>
                  
                  <TouchableOpacity
                    style={styles.googleButton}
                    onPress={() => promptAsync()}
                    disabled={!request}
                  >
                    <Ionicons name="logo-google" size={20} color="#000" />
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </TouchableOpacity>
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
    backgroundColor: '#000000',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  backButtonContainer: {
    alignItems: 'flex-start',
    marginBottom: 20,
    position: 'absolute',
    top: 25,
    left: 10,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  backButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerContainer: {
    marginBottom: 30,
    marginTop: 75,
  },
  headerText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subHeaderText: {
    fontSize: 16,
    color: '#CCCCCC',
    opacity: 0.8,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  errorText: {
    color: '#FFFFFF',
    marginTop: 5,
    fontSize: 14,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  buttonContainer: {
    marginTop: 20,
  },
  button: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  socialLoginContainer: {
    marginTop: 30,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dividerText: {
    color: '#FFFFFF',
    paddingHorizontal: 10,
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 10,
  },
  signupContainer: {
    marginTop: 30,
    alignItems: 'center',
  },
  signupText: {
    color: '#CCCCCC',
    fontSize: 14,
  },
  signupLink: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  successMessage: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  successText: {
    color: '#FFFFFF',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  backToLoginButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  backToLoginText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backToLoginLinkContainer: {
    alignItems: 'flex-start',
    marginTop: 15,
  },
  backToLoginLink: {
    color: '#FFFFFF',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});

export default LoginScreen; 