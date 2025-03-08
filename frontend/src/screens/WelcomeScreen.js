import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  ImageBackground
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Motion } from '@legendapp/motion';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const WelcomeScreen = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#121212', '#1E3A8A', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
      >
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
            <View style={styles.underline} />
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
                <LinearGradient
                  colors={['#FFFFFF', '#F0F0F0']}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.loginButtonText}>Log In</Text>
                </LinearGradient>
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
                <View style={styles.buttonUnderline} />
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
          </Motion.View>
        </View>
      </LinearGradient>
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
  },
  overlay: {
    flex: 1,
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
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  decoderText: {
    fontSize: 34,
    fontFamily: 'Courier New',
    fontWeight: '400',
    color: '#CCCCCC',
    letterSpacing: 4,
    marginTop: -5,
  },
  underline: {
    height: 2,
    width: 100,
    backgroundColor: '#4F46E5',
    marginTop: 15,
    borderRadius: 2,
  },
  taglineContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  taglineText: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 26,
    letterSpacing: 0.5,
  },
  buttonContainer: {
    marginBottom: 40,
  },
  loginButton: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonGradient: {
    padding: 16,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonUnderline: {
    height: 2,
    width: 40,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    borderRadius: 2,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    fontSize: 12,
    letterSpacing: 0.5,
  },
});

export default WelcomeScreen; 