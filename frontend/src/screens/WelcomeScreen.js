import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  LinearGradient
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Motion } from '@legendapp/motion';
import { Ionicons } from '@expo/vector-icons';
// Remove @env import and use hardcoded values
// import { GOOGLE_CLIENT_ID, FRONTEND_URL } from '@env';

// Hardcoded values for development
const GOOGLE_CLIENT_ID = "960956410891-k6imbmuqgd40hiurti4mes5kp78gvggq.apps.googleusercontent.com";
const FRONTEND_URL = "http://localhost:3000";

const { width, height } = Dimensions.get('window');

const WelcomeScreen = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.background}>
        <View style={styles.overlay}>
          <Motion.View
            animate={{
              opacity: 1,
              y: 0,
            }}
            initial={{
              opacity: 0,
              y: -50,
            }}
            transition={{
              type: 'spring',
              damping: 20,
              stiffness: 300,
            }}
            style={styles.logoContainer}
          >
            <Text style={styles.headlineText}>HEADLINE</Text>
            <Text style={styles.decoderText}>DECODER</Text>
          </Motion.View>

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
              delay: 0.2,
            }}
            style={styles.taglineContainer}
          >
            <Text style={styles.taglineText}>
              Decode the noise. Understand the markets.
            </Text>
          </Motion.View>

          <View style={styles.buttonContainer}>
            <Motion.View
              animate={{
                opacity: 1,
                y: 0,
              }}
              initial={{
                opacity: 0,
                y: 100,
              }}
              transition={{
                type: 'spring',
                damping: 20,
                stiffness: 300,
                delay: 0.4,
              }}
            >
              <TouchableOpacity
                style={styles.loginButton}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.loginButtonText}>Log In</Text>
              </TouchableOpacity>
            </Motion.View>

            <Motion.View
              animate={{
                opacity: 1,
                y: 0,
              }}
              initial={{
                opacity: 0,
                y: 100,
              }}
              transition={{
                type: 'spring',
                damping: 20,
                stiffness: 300,
                delay: 0.5,
              }}
            >
              <TouchableOpacity
                style={styles.registerButton}
                onPress={() => navigation.navigate('Register')}
              >
                <Text style={styles.registerButtonText}>Sign Up</Text>
              </TouchableOpacity>
            </Motion.View>
          </View>

          <Motion.View
            animate={{
              opacity: 1,
            }}
            initial={{
              opacity: 0,
            }}
            transition={{
              duration: 1,
              delay: 0.8,
            }}
            style={styles.footer}
          >
            <Text style={styles.footerText}>
              By continuing, you agree to our Terms of Service and Privacy Policy
            </Text>
            <Text style={styles.footerText}>
              Client ID: {GOOGLE_CLIENT_ID}
            </Text>
            <Text style={styles.footerText}>
              Frontend URL: {FRONTEND_URL}
            </Text>
          </Motion.View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    width: width,
    height: height,
    backgroundColor: '#000000',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 20,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  headlineText: {
    fontSize: 40,
    fontFamily: 'Times New Roman',
    fontWeight: 'bold',
    color: '#000000',
    letterSpacing: 2,
  },
  decoderText: {
    fontSize: 34,
    fontFamily: 'Courier New',
    fontWeight: '400',
    color: '#ffffff',
    letterSpacing: 4,
    marginTop: -5,
  },
  taglineContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  taglineText: {
    fontSize: 18,
    color: '#000000',
    textAlign: 'center',
    lineHeight: 26,
  },
  buttonContainer: {
    marginBottom: 40,
  },
  loginButton: {
    backgroundColor: '#4fc3f7',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerButton: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4fc3f7',
  },
  registerButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(0, 0, 0, 0.6)',
    textAlign: 'center',
    fontSize: 12,
  },
});

export default WelcomeScreen; 