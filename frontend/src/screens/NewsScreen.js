import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Share,
  Animated,
  Easing
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Title, Paragraph } from 'react-native-paper';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Motion } from '@legendapp/motion';
import { startVirtualTryOn, checkTryOnStatus, pollTryOnStatus, startVirtualTryOnDirectTest, getTryOnUsage } from '../api/tryon';
import { 
  Newsreader_400Regular,
  Newsreader_600SemiBold,
  useFonts 
} from '@expo-google-fonts/newsreader';
import * as SplashScreen from 'expo-splash-screen';
import { MaterialIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => {
  /* reloading the app might trigger some race conditions, ignore them */
});

const StepIndicator = ({ currentStep, totalSteps }) => {
  return (
    <Motion.View 
      style={styles.stepIndicatorContainer}
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <View style={styles.stepDotsContainer}>
        {Array.from({ length: totalSteps }).map((_, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <View 
                style={[
                  styles.stepConnector,
                  currentStep > index && styles.stepConnectorActive,
                  currentStep === index && styles.stepConnectorHalf
                ]} 
              />
            )}
            <Motion.View 
              style={[
                styles.stepDot,
                currentStep >= index + 1 && styles.stepDotActive,
              ]}
              animate={{ 
                scale: currentStep === index + 1 ? 1.2 : 1,
                backgroundColor: currentStep >= index + 1 ? '#c1ff72' : '#BBBBBB' 
              }}
              transition={{ duration: 0.3 }}
            />
          </React.Fragment>
        ))}
      </View>
      <Text style={styles.stepText}>
        Step {currentStep} of {totalSteps}
      </Text>
    </Motion.View>
  );
};

// Move styles outside of component
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2EA', // Cream color
    paddingHorizontal: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    padding: 20,
    height: '100%',
    width: '100%',
  },
  stepTitle: {
    fontSize: 24,
    fontFamily: 'Newsreader_600SemiBold',
    marginBottom: 10,
    color: '#444444',
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
    color: '#444444',
  },
  header: {
    backgroundColor: '#F5F2EA', // Cream color
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1,
    borderBottomWidth: 0,
    borderBottomColor: '#E0E0E0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headlineText: {
    fontFamily: 'OldEnglish',
    fontSize: 26,
    color: '#444444',
    letterSpacing: 1,
  },
  profileButton: {
    padding: 8,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#444444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  avatarText: {
    color: '#c1ff72',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingBottom: 20,
    backgroundColor: '#F5F2EA', // Cream color
  },
  titleContainer: {
    marginBottom: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#CCCCCC',
    textAlign: 'center',
    marginBottom: 16,
  },
  stepIndicatorContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  stepDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
  },
  stepDotActive: {
    backgroundColor: '#c1ff72',
  },
  stepConnector: {
    height: 2,
    width: 40,
    backgroundColor: '#E0E0E0',
    position: 'absolute',
    top: 5,
    left: 16,
    zIndex: -1,
  },
  stepConnectorActive: {
    backgroundColor: '#c1ff72',
  },
  stepConnectorHalf: {
    backgroundColor: '#c1ff72',
  },
  stepText: {
    fontSize: 14,
    color: '#444444',
    marginTop: 8,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'space-between',
    height: '100%',
  },
  stepContentArea: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 0,
    width: '100%',
  },
  imagePlaceholder: {
    aspectRatio: 1,
    height: undefined,
    width: '100%',
    maxHeight: height * 0.6,
    borderWidth: 0,
    borderRadius: 30,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
    alignSelf: 'center',
    shadowColor: '#c1ff72',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
    borderColor: '#c1ff72',
    borderWidth: 2,
    overflow: 'hidden',
  },
  imageSelected: {
    borderStyle: 'solid',
    borderColor: '#c1ff72',
    backgroundColor: '#333333',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    resizeMode: 'cover',
  },
  placeholderText: {
    marginTop: 10,
    color: '#444444',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#F5F2EA',
    paddingVertical: 8,
    borderRadius: 8,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 'auto',
  },
  nextButton: {
    backgroundColor: '#c1ff72',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    minHeight: 56,
    shadowColor: '#c1ff72',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  nextButtonText: {
    color: '#222222',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    backgroundColor: '#333333',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48%',
    minHeight: 50,
  },
  backButtonText: {
    color: '#999999',
    fontSize: 16,
    fontWeight: 'bold',
  },
  processButton: {
    backgroundColor: '#c1ff72',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48%',
    minHeight: 50,
    shadowColor: '#c1ff72',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  processButtonText: {
    color: '#222222',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#333333',
    opacity: 0.7,
  },
  restartButton: {
    backgroundColor: '#c1ff72',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48%',
    minHeight: 50,
  },
  restartButtonText: {
    color: '#222222',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultImageContainer: {
    width: '100%',
    flex: 1,
    borderWidth: 2,
    borderRadius: 30,
    backgroundColor: '#333333',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#c1ff72',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
    borderColor: '#c1ff72',
    marginHorizontal: 0,
    marginVertical: 10,
  },
  spinnerContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  spinnerRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 6,
    borderColor: '#c1ff72',
    borderTopColor: 'transparent',
    borderRightColor: 'rgba(193, 255, 114, 0.5)',
    borderLeftColor: 'rgba(193, 255, 114, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerCore: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#c1ff72',
  },
  progressBar: {
    width: '80%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginTop: 24,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#c1ff72',
    borderRadius: 2,
  },
  loadingText: {
    marginTop: 20,
    color: '#FFFFFF',
    fontSize: 20,
    textAlign: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 16,
    fontWeight: '500',
    textShadowColor: 'rgba(193, 255, 114, 0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  removeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 4,
    zIndex: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  noResultContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  resultActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'absolute',
    bottom: 15,
    left: 15,
    right: 15,
    zIndex: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F2EA', // Cream color to match background
    borderRadius: 30,
    width: 50,
    height: 50,
    marginLeft: 0,
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  actionButtonText: {
    color: '#333333',
    fontWeight: '600',
    marginLeft: 4,
    fontSize: 13,
  },
  shareButton: {
    backgroundColor: 'transparent',
  },
  shareButtonText: {
    color: '#444444',
  },
  imageFrame: {
    display: 'none',
  },
  imageDisplayContainer: {
    display: 'none',
  },
  imageDisplay: {
    width: '100%',
    height: '100%',
    backgroundColor: '#222222',
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: '#c1ff72',
    position: 'relative',
  },
  centeredImage: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#c1ff72',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#c1ff72',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
  },
  loadingIconInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(193, 255, 114, 0.3)',
    borderWidth: 2,
    borderColor: '#c1ff72',
  },
  orbitDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(193, 255, 114, 0.8)',
    shadowColor: '#c1ff72',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 5,
  },
  orbitDot2: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(193, 255, 114, 0.6)',
  },
  orbitDot3: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
});

const VirtualTryOnScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isSubscribed, openPaywall } = useSubscription();
  
  // Load fonts
  const [fontsLoaded] = useFonts({
    'Newsreader_400Regular': Newsreader_400Regular,
    'Newsreader_600SemiBold': Newsreader_600SemiBold,
  });

  // State declarations
  const [selfieImage, setSelfieImage] = useState(null);
  const [clothingImage, setClothingImage] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selfieLoading, setSelfieLoading] = useState(false);
  const [clothingLoading, setClothingLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [predictionId, setPredictionId] = useState(null);
  const [processingStatus, setProcessingStatus] = useState('');
  const [hasMediaPermission, setHasMediaPermission] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [spinValue] = useState(new Animated.Value(0));
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [orbit1] = useState(new Animated.Value(0));
  const [orbit2] = useState(new Animated.Value(0));
  const [orbit3] = useState(new Animated.Value(0));
  const [tryOnLimitReached, setTryOnLimitReached] = useState(false);

  const totalSteps = 3;
  const loadingPhrases = [
    "Analyzing your picture...",
    "Mapping garment dimensions...",
    "Adjusting fit to your body...",
    "Applying fabric textures...",
    "Blending garment colors...",
    "Adding realistic shadows...",
    "Enhancing details...",
    "Perfecting the fit...",
    "Rendering final image...",
    "Finalizing your virtual look..."
  ];

  // Hide splash screen once fonts are loaded
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(console.warn);
    }
  }, [fontsLoaded]);

  // Media permissions effect
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (libraryStatus !== 'granted') {
          Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to make this work!');
        }
        
        const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
        setHasMediaPermission(mediaStatus === 'granted');
      }
    })();
  }, []);

  // Start animations when loading state changes
  useEffect(() => {
    if (loading) {
      // Pulse animation for main icon
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          })
        ])
      ).start();
      
      // Orbit animations for the dots
      Animated.loop(
        Animated.timing(orbit1, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true
        })
      ).start();
      
      Animated.loop(
        Animated.timing(orbit2, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true
        })
      ).start();
      
      Animated.loop(
        Animated.timing(orbit3, {
          toValue: 1,
          duration: 2500,
          easing: Easing.linear,
          useNativeDriver: true
        })
      ).start();
    } else {
      // Stop all animations
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      orbit1.stopAnimation();
      orbit1.setValue(0);
      orbit2.stopAnimation();
      orbit2.setValue(0);
      orbit3.stopAnimation();
      orbit3.setValue(0);
    }
  }, [loading]);

  if (!fontsLoaded) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#444444" />
      </View>
    );
  }

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const orbit1X = orbit1.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, 40]
  });

  const orbit1Y = orbit1.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, 40, 0, -40, 0]
  });

  const orbit2X = orbit2.interpolate({
    inputRange: [0, 1],
    outputRange: [-50, 50]
  });

  const orbit2Y = orbit2.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, -50, 0, 50, 0]
  });

  const orbit3X = orbit3.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 60]
  });

  const orbit3Y = orbit3.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, -60, 0, 60, 0]
  });

  const nextStep = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true
    }).start(() => {
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
      }
      
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true
      }).start();
    });
  };

  const prevStep = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true
    }).start(() => {
      if (currentStep > 1) {
        setCurrentStep(currentStep - 1);
      }
      
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true
      }).start();
    });
  };

  const pickSelfieImage = async () => {
    try {
      setSelfieLoading(true);
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      console.log('Image picker result:', result);

      if ((result.canceled === false || result.cancelled === false) && result.assets && result.assets.length > 0) {
        // Small delay to allow animation to show
        setTimeout(() => {
          setSelfieImage(result.assets[0].uri);
          setResultImage(null); // Clear any previous result
          setSelfieLoading(false);
        }, 300);
      } else {
        setSelfieLoading(false);
      }
    } catch (error) {
      console.error('Error picking selfie image:', error);
      setSelfieLoading(false);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const pickClothingImage = async () => {
    try {
      setClothingLoading(true);
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      console.log('Image picker result:', result);

      if ((result.canceled === false || result.cancelled === false) && result.assets && result.assets.length > 0) {
        // Small delay to allow animation to show
        setTimeout(() => {
          setClothingImage(result.assets[0].uri);
          setResultImage(null); // Clear any previous result
          setClothingLoading(false);
        }, 300);
      } else {
        setClothingLoading(false);
      }
    } catch (error) {
      console.error('Error picking clothing image:', error);
      setClothingLoading(false);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const processImages = async () => {
    if (!user) {
      Alert.alert(
        "Login Required",
        "Please login to use the virtual try-on feature",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Login", onPress: () => navigation.navigate('Login') }
        ]
      );
      return;
    }

    if (!selfieImage || !clothingImage) {
      Alert.alert('Missing Images', 'Please select both a photo and a clothing item.');
      return;
    }
    
    // Check try-on usage for non-subscribed users
    if (!isSubscribed) {
      try {
        // Fetch user's try-on usage from the API
        const usageData = await getTryOnUsage();
        console.log('Try-on usage data:', usageData);
        
        // Check monthly limit (40 per month)
        if (usageData.monthly_count >= 40) {
          console.log('Monthly try-on limit reached');
          
          // Show message about monthly limit reached
          Alert.alert(
            'Monthly Limit Reached',
            'You\'ve reached your monthly limit of 40 virtual try-ons. Your limit will reset at the beginning of next month, or upgrade to Premium for unlimited try-ons!',
            [
              { text: 'OK', style: 'cancel' },
              { text: 'Upgrade Now', onPress: () => openPaywall() }
            ]
          );
          return;
        }
        
        // Check daily limit (1 per day) for free users
        if (usageData.daily_count >= 1) {
          console.log('Daily try-on limit reached');
          
          // Show more informative alert before opening paywall
          Alert.alert(
            'Daily Limit Reached',
            'Free accounts are limited to 1 virtual try-on per day. Upgrade to Premium for unlimited try-ons!',
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Upgrade Now', onPress: () => openPaywall() }
            ]
          );
          return;
        }
      } catch (error) {
        console.error('Error checking try-on usage:', error);
        // Continue anyway to give user the benefit of the doubt
      }
    }

    setLoading(true);
    setProcessingStatus(loadingPhrases[0]);
    setLoadingPhase(0);
    
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true
      })
    ).start();
    
    const phaseInterval = setInterval(() => {
      setLoadingPhase(prev => {
        const nextPhase = (prev + 1) % loadingPhrases.length;
        setProcessingStatus(loadingPhrases[nextPhase]);
        return nextPhase;
      });
    }, 2200);
    
    try {
      // Log out image details for debugging
      console.log('Processing selfie image:', selfieImage);
      console.log('Processing clothing image:', clothingImage);
      
      // Check file type - if it's an SVG, show an error
      if (selfieImage.toLowerCase().endsWith('.svg') || clothingImage.toLowerCase().endsWith('.svg')) {
        clearInterval(phaseInterval);
        spinValue.stopAnimation();
        setLoading(false);
        setProcessingStatus('');
        Alert.alert(
          'Unsupported Image Format', 
          'SVG images are not supported. Please use JPG or PNG images instead.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Try the direct URL method first (how the test page works)
      console.log('Trying direct URL method first...');
      let result;
      
      try {
        // For file URIs, we can't use them directly as URLs
        // So we'll fall back to the file upload method below
        if (!selfieImage.startsWith('http') || !clothingImage.startsWith('http')) {
          console.log('Local files detected, can\'t use direct URL method');
          throw new Error('Local files need to use the file upload method');
        }
        
        // If they're real URLs, try the URL method
        result = await startVirtualTryOnDirectTest(selfieImage, clothingImage, {
          category: 'auto',
          mode: 'balanced'
        });
        console.log('Direct URL method worked!');
      } catch (urlError) {
        console.log('Direct URL method failed, trying file upload method...', urlError);
        // Fall back to regular file upload method
        result = await startVirtualTryOn(selfieImage, clothingImage, {
          category: 'auto',
          mode: 'balanced'
        });
      }
      
      if (result.id) {
        setPredictionId(result.id);
        
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true
        }).start(() => {
          setCurrentStep(3);
          
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true
          }).start();
        });
        
        pollTryOnStatus(
          result.id,
          (statusUpdate) => {
            console.log('Status update:', statusUpdate);
            
            if (statusUpdate.status === 'processing') {
              // Continue showing cycling processing messages
            } else if (statusUpdate.status === 'completed') {
              clearInterval(phaseInterval);
              spinValue.stopAnimation();
              setProcessingStatus('');
              setLoading(false);
              
              if (statusUpdate.result_url) {
                if (Array.isArray(statusUpdate.result_url)) {
                  console.log('Result URL is an array:', statusUpdate.result_url);
                  setResultImage(statusUpdate.result_url[0]);
                } else {
                  console.log('Result URL is a string:', statusUpdate.result_url);
                  setResultImage(statusUpdate.result_url);
                }
              } else if (statusUpdate.output && statusUpdate.output.length > 0) {
                console.log('Using output field:', statusUpdate.output);
                setResultImage(statusUpdate.output[0]);
              } else {
                console.error('No result image URL found in the response:', statusUpdate);
                Alert.alert('Error', 'Failed to get result image URL. Please try again.');
              }
            } else if (statusUpdate.status === 'failed') {
              clearInterval(phaseInterval);
              spinValue.stopAnimation();
              setProcessingStatus('');
              setLoading(false);
              
              // Handle common error types
              if (statusUpdate.error) {
                const errorMessage = typeof statusUpdate.error === 'string' 
                  ? statusUpdate.error 
                  : statusUpdate.error.message || 'Unknown error';
                  
                if (errorMessage.includes('PoseError') || errorMessage.includes('body pose')) {
                  Alert.alert(
                    'Body Detection Error', 
                    'Could not detect a full body in your photo. Please use a clear, front-facing photo showing your full body.',
                    [{ text: 'OK' }]
                  );
                } else if (errorMessage.includes('ImageLoadError') || errorMessage.includes('image format')) {
                  Alert.alert(
                    'Image Format Error', 
                    'There was an issue with one of your images. Please try using JPG or PNG images.',
                    [{ text: 'OK' }]
                  );
                } else {
                  Alert.alert('Error', errorMessage || 'Failed to process images. Please try again.');
                }
              } else {
                Alert.alert('Error', 'Failed to process images. Please try again.');
              }
            }
          },
          2000,
          60000
        ).catch(error => {
          clearInterval(phaseInterval);
          spinValue.stopAnimation();
          console.error('Polling error:', error);
          setLoading(false);
          setProcessingStatus('');
          Alert.alert('Error', 'Try-on process timed out. Please try again.');
        });
      } else {
        clearInterval(phaseInterval);
        spinValue.stopAnimation();
        throw new Error('No prediction ID returned');
      }
    } catch (error) {
      clearInterval(phaseInterval);
      spinValue.stopAnimation();
      console.error('Error processing images:', error);
      setLoading(false);
      setProcessingStatus('');
      
      // Provide more specific error message for the user
      const errorMessage = error.response?.data?.detail || error.message;
      if (errorMessage.includes('FASHN API') || errorMessage.includes('temporarily unavailable')) {
        Alert.alert(
          'Service Temporarily Unavailable',
          'The virtual try-on service is currently experiencing technical difficulties. Please try again later.',
          [
            { text: 'OK', onPress: () => console.log('OK Pressed') }
          ]
        );
      } else if (errorMessage.includes('Unauthorized') || errorMessage.includes('API key')) {
        Alert.alert(
          'Service Configuration Error',
          'The virtual try-on service is not properly configured. Please contact support.',
          [
            { text: 'OK' }
          ]
        );
      } else if (errorMessage.includes('Connection') || errorMessage.includes('ECONNREFUSED') || 
                errorMessage.includes('timeout') || errorMessage.includes('Network Error')) {
        Alert.alert(
          'Connection Error',
          'Could not connect to the virtual try-on service. Please check your internet connection and try again.',
          [
            { text: 'OK' }
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to process images. Please try again.');
      }
    }
  };

  const removeSelfieImage = () => {
    setSelfieImage(null);
  };

  const removeClothingImage = () => {
    setClothingImage(null);
  };

  const saveToGallery = async () => {
    if (!resultImage) {
      Alert.alert('No Image', 'There is no image to save.');
      return;
    }

    if (!hasMediaPermission) {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Sorry, we need permission to save images to your gallery.');
        return;
      }
      setHasMediaPermission(status === 'granted');
    }

    try {
      setSaving(true);
      
      const fileUri = `${FileSystem.cacheDirectory}tryon-result-${Date.now()}.jpg`;
      
      if (resultImage.startsWith('http')) {
        const downloadResult = await FileSystem.downloadAsync(resultImage, fileUri);
        console.log('Downloaded image to:', downloadResult.uri);
        
        const asset = await MediaLibrary.saveToLibraryAsync(downloadResult.uri);
        console.log('Saved to gallery:', asset);
      } else {
        const asset = await MediaLibrary.saveToLibraryAsync(resultImage);
        console.log('Saved local file to gallery:', asset);
      }
      
      Alert.alert('Success', 'Image saved to your photo gallery!');
    } catch (error) {
      console.error('Error saving image to gallery:', error);
      Alert.alert('Error', 'Failed to save image to your gallery. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const shareImage = async () => {
    if (!resultImage) {
      Alert.alert('No Image', 'There is no image to share.');
      return;
    }

    try {
      setSaving(true);
      
      let localUri = resultImage;
      
      if (resultImage.startsWith('http')) {
        const fileUri = `${FileSystem.cacheDirectory}tryon-share-${Date.now()}.jpg`;
        const downloadResult = await FileSystem.downloadAsync(resultImage, fileUri);
        localUri = downloadResult.uri;
      }
      
      const shareResult = await Share.share({
        url: localUri,
        message: 'Check out my virtual try-on from VELRA!'
      });
      
      console.log('Share result:', shareResult);
    } catch (error) {
      console.error('Error sharing image:', error);
      Alert.alert('Error', 'Failed to share image. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderStepContent = () => {
    const content = (() => {
      switch (currentStep) {
        case 1:
          return (
            <Motion.View
              key="step1"
              animate={{ opacity: 1, x: 0 }}
              initial={{ opacity: 0, x: -20 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              style={styles.stepContainer}
            >
              <View style={styles.stepContentArea}>
                <Text style={styles.stepTitle}>Select Your Picture</Text>
                
                <TouchableOpacity
                  style={[styles.imagePlaceholder, selfieImage && styles.imageSelected]}
                  onPress={pickSelfieImage}
                  disabled={selfieLoading}
                >
                  {selfieImage ? (
                    <View style={styles.imageContainer}>
                      <Motion.Image 
                        source={{ uri: selfieImage }} 
                        style={styles.previewImage}
                        animate={{
                          opacity: 1,
                          scale: 1,
                        }}
                        initial={{
                          opacity: 0,
                          scale: 0.9,
                        }}
                        transition={{
                          type: 'spring',
                          damping: 20,
                          stiffness: 300,
                        }}
                      />
                      <TouchableOpacity 
                        style={styles.removeButton}
                        onPress={removeSelfieImage}
                      >
                        <Ionicons name="close-circle" size={28} color="#444444" />
                      </TouchableOpacity>
                    </View>
                  ) : selfieLoading ? (
                    <Motion.View
                      animate={{ opacity: 1, rotate: '0deg' }}
                      transition={{ repeat: Infinity, duration: 1, repeatType: 'loop' }}
                      style={{ alignItems: 'center', justifyContent: 'center' }}
                    >
                      <ActivityIndicator color="#FFFFFF" size="large" />
                      <Text style={[styles.placeholderText, { color: '#FFFFFF', backgroundColor: 'transparent' }]}>Selecting...</Text>
                    </Motion.View>
                  ) : (
                    <>
                      <MaterialIcons name="add-a-photo" size={64} color="#c1ff72" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
              
              <View style={styles.navigationButtons}>
                <TouchableOpacity
                  style={[styles.nextButton, !selfieImage && styles.disabledButton]}
                  onPress={nextStep}
                  disabled={!selfieImage}
                >
                  <Text style={styles.nextButtonText}>Next</Text>
                  <Ionicons name="arrow-forward" size={18} color="#222222" style={{ marginLeft: 5 }} />
                </TouchableOpacity>
              </View>
            </Motion.View>
          );
        
        case 2:
          return (
            <Motion.View
              key="step2"
              animate={{ opacity: 1, x: 0 }}
              initial={{ opacity: 0, x: 20 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              style={styles.stepContainer}
            >
              <View style={styles.stepContentArea}>
                <Text style={styles.stepTitle}>Select Clothing Item</Text>
                
                <TouchableOpacity
                  style={[styles.imagePlaceholder, clothingImage && styles.imageSelected]}
                  onPress={pickClothingImage}
                  disabled={clothingLoading}
                >
                  {clothingImage ? (
                    <View style={styles.imageContainer}>
                      <Motion.Image 
                        source={{ uri: clothingImage }} 
                        style={styles.previewImage}
                        animate={{
                          opacity: 1,
                          scale: 1,
                        }}
                        initial={{
                          opacity: 0,
                          scale: 0.9,
                        }}
                        transition={{
                          type: 'spring',
                          damping: 20,
                          stiffness: 300,
                        }}
                      />
                      <TouchableOpacity 
                        style={styles.removeButton}
                        onPress={removeClothingImage}
                      >
                        <Ionicons name="close-circle" size={28} color="#444444" />
                      </TouchableOpacity>
                    </View>
                  ) : clothingLoading ? (
                    <Motion.View
                      animate={{ opacity: 1, rotate: '0deg' }}
                      transition={{ repeat: Infinity, duration: 1, repeatType: 'loop' }}
                      style={{ alignItems: 'center', justifyContent: 'center' }}
                    >
                      <ActivityIndicator color="#FFFFFF" size="large" />
                      <Text style={[styles.placeholderText, { color: '#FFFFFF', backgroundColor: 'transparent' }]}>Selecting...</Text>
                    </Motion.View>
                  ) : (
                    <>
                      <MaterialCommunityIcons name="hanger" size={64} color="#c1ff72" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
              
              <View style={styles.navigationButtons}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={prevStep}
                >
                  <Ionicons name="arrow-back" size={18} color="#999999" style={{ marginRight: 5 }} />
                  <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.processButton, !clothingImage && styles.disabledButton]}
                  onPress={processImages}
                  disabled={!clothingImage || loading}
                >
                  {loading ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <ActivityIndicator size="small" color="#222222" />
                      <Text style={[styles.processButtonText, { marginLeft: 8 }]}>Processing...</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.processButtonText}>Try It On</Text>
                      <Ionicons name="arrow-forward" size={18} color="#222222" style={{ marginLeft: 5 }} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </Motion.View>
          );
        
        case 3:
          return (
            <Motion.View
              key="step3"
              animate={{ opacity: 1, x: 0 }}
              initial={{ opacity: 0, x: 20 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              style={styles.stepContainer}
            >
              <View style={styles.stepContentArea}>
                <Text style={styles.stepTitle}>Your Result</Text>
                
                <View style={styles.resultImageContainer}>
                  {loading ? (
                    <Motion.View
                      style={[styles.loadingContainer, {backgroundColor: 'transparent'}]}
                      animate={{ opacity: 1 }}
                      initial={{ opacity: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      <View style={{position: 'relative', width: 160, height: 160, alignItems: 'center', justifyContent: 'center'}}>
                        {/* Orbiting dots */}
                        <Animated.View style={[
                          styles.orbitDot,
                          {
                            transform: [
                              { translateX: orbit1X },
                              { translateY: orbit1Y }
                            ]
                          }
                        ]} />
                        
                        <Animated.View style={[
                          styles.orbitDot,
                          styles.orbitDot2,
                          {
                            transform: [
                              { translateX: orbit2X },
                              { translateY: orbit2Y }
                            ]
                          }
                        ]} />
                        
                        <Animated.View style={[
                          styles.orbitDot,
                          styles.orbitDot3,
                          {
                            transform: [
                              { translateX: orbit3X },
                              { translateY: orbit3Y }
                            ]
                          }
                        ]} />
                        
                        {/* Main pulsing icon */}
                        <Animated.View style={{
                          transform: [{ scale: pulseAnim }],
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <View style={styles.loadingIcon}>
                            <View style={styles.loadingIconInner} />
                          </View>
                        </Animated.View>
                      </View>
                      
                      <Animated.Text style={styles.loadingText}>{processingStatus}</Animated.Text>
                    </Motion.View>
                  ) : resultImage ? (
                    <View style={{flex: 1, width: '100%', height: '100%'}}>
                      <View style={styles.imageDisplay}>
                        <Image 
                          source={{ uri: resultImage }}
                          style={styles.centeredImage}
                          resizeMode="contain"
                          onError={(e) => {
                            console.error('Error loading result image:', e.nativeEvent.error);
                            Alert.alert('Image Loading Error', 'Could not load the resulting image. Please try again.');
                          }}
                        />
                      </View>
                      
                      <View style={styles.resultActions}>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={saveToGallery}
                          disabled={saving}
                        >
                          {saving ? (
                            <ActivityIndicator size="small" color="#333333" />
                          ) : (
                            <Ionicons name="save-outline" size={26} color="#222222" />
                          )}
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={shareImage}
                          disabled={saving}
                        >
                          <Ionicons name="share-social-outline" size={26} color="#222222" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.noResultContainer}>
                      <MaterialCommunityIcons name="image-off" size={48} color="#666666" />
                      <Text style={styles.noResultText}>No result available</Text>
                    </View>
                  )}
                </View>
              </View>
              
              <View style={styles.navigationButtons}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={prevStep}
                >
                  <Ionicons name="arrow-back" size={18} color="#999999" style={{ marginRight: 5 }} />
                  <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.restartButton}
                  onPress={() => {
                    setCurrentStep(1);
                    setResultImage(null);
                    setPredictionId(null);
                    setProcessingStatus('');
                  }}
                >
                  <Ionicons name="refresh" size={18} color="#222222" style={{ marginRight: 5 }} />
                  <Text style={styles.restartButtonText}>Start Over</Text>
                </TouchableOpacity>
              </View>
            </Motion.View>
          );
        
        default:
          return null;
      }
    })();
    
    return (
      <Animated.View style={{flex: 1, opacity: fadeAnim}}>
        {content}
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container]}>
      <View style={{ height: insets.top, backgroundColor: '#F5F2EA' }} />
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
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.headlineText}>velra</Text>
        </View>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {user ? user.name?.charAt(0).toUpperCase() || 'G' : 'G'}
            </Text>
          </View>
        </TouchableOpacity>
      </Motion.View>
      
      <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />
      
      <View style={styles.content}>
        {renderStepContent()}
      </View>
    </View>
  );
};

export default VirtualTryOnScreen;
