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
import GridBackground from '../components/GridBackground';

const { width, height } = Dimensions.get('window');

const WelcomeScreen = () => {
  const navigation = useNavigation();

  // Handle back button press
  const handleBackPress = () => {
    // Check if we can go back in the stack
    if (navigation.canGoBack()) {
      // If possible, go back to the previous screen
      navigation.goBack();
    } else {
      // If there's no previous screen, navigate to MainApp
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainApp' }],
      });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.background}>
        {/* Grid Background */}
        <GridBackground />
        
        <Motion.View
          animate={{
            opacity: 1,
            x: 0,
          }}
          initial={{
            opacity: 0,
            x: -20,
          }}
          transition={{
            type: 'spring',
            damping: 20,
            stiffness: 300,
          }}
          style={styles.backButtonContainer}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackPress}
          >
            <Ionicons name="arrow-back" size={22} color="#888888" />
          </TouchableOpacity>
        </Motion.View>

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
            <Text style={styles.headlineText}>DECODR</Text>
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
                <View style={styles.buttonWrapper}>
                  <LinearGradient
                    colors={['#000000', '#333333']}
                    style={styles.buttonGradient}
                  >
                    <Text style={styles.loginButtonText}>Log In</Text>
                  </LinearGradient>
                </View>
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
          </Motion.View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  background: {
    flex: 1,
    width: width,
    height: height,
    backgroundColor: '#FFFFFF',
  },
  backButtonContainer: {
    position: 'absolute',
    top: 80,
    left: 20,
    zIndex: 10,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 0,
    backgroundColor: 'rgba(200, 200, 200, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    zIndex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  headlineText: {
    fontSize: 40,
    fontFamily: 'OldEnglish',
    fontWeight: 'bold',
    color: '#000000',
    letterSpacing: 2,
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
    letterSpacing: 0.5,
  },
  buttonContainer: {
    marginBottom: 40,
  },
  loginButton: {
    borderRadius: 0,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonWrapper: {
    borderRadius: 0,
    overflow: 'hidden',
  },
  buttonGradient: {
    padding: 16,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerButton: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 16,
    alignItems: 'center',
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
    fontSize: 10,
    letterSpacing: 0.5,
  },
});

export default WelcomeScreen; 