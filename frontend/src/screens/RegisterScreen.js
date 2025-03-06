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
  ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Motion } from '@legendapp/motion';

const RegisterScreen = () => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
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

  const handleRegister = async () => {
    if (!validatePassword()) {
      return;
    }
    
    try {
      await register(name, email, password);
      // The register function in AuthContext will handle navigation
    } catch (error) {
      Alert.alert(
        'Registration Failed',
        error.message || 'An error occurred during registration. Please try again.',
        [{ text: 'OK' }]
      );
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
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
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
              {step === 1 
                ? "What's your name?" 
                : step === 2 
                  ? "What's your email?" 
                  : "Create a password"}
            </Text>
            <Text style={styles.subHeaderText}>
              {step === 1 
                ? "Let's get to know you" 
                : step === 2 
                  ? "We'll use this for your account" 
                  : "Make sure it's secure"}
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
                isLoading ? styles.buttonDisabled : null,
              ]}
              onPress={() => {
                if (step === 1 && validateName()) {
                  setStep(2);
                } else if (step === 2 && validateEmail()) {
                  setStep(3);
                } else if (step === 3) {
                  handleRegister();
                }
              }}
              disabled={
                (step === 1 && !name.trim()) || 
                (step === 2 && !email.trim()) || 
                (step === 3 && !password.trim()) || 
                isLoading
              }
            >
              {isLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.buttonText}>
                  {step < 3 ? 'Continue' : 'Sign Up'}
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
    backgroundColor: '#1a237e',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
  },
  backButtonContainer: {
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContainer: {
    marginBottom: 30,
  },
  headerText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4fc3f7',
    marginBottom: 8,
  },
  subHeaderText: {
    fontSize: 16,
    color: '#ffffff',
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
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  errorText: {
    color: '#ff5252',
    marginTop: 5,
    fontSize: 14,
  },
  buttonContainer: {
    marginTop: 20,
  },
  button: {
    backgroundColor: '#4fc3f7',
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
  loginContainer: {
    marginTop: 30,
    alignItems: 'center',
  },
  loginText: {
    color: '#ffffff',
    fontSize: 14,
  },
  loginLink: {
    color: '#4fc3f7',
    fontWeight: 'bold',
  },
});

export default RegisterScreen; 