import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Motion } from '@legendapp/motion';

const { width, height } = Dimensions.get('window');

const CustomPaywall = ({ 
  onPurchaseMonthly, 
  onPurchaseAnnual, 
  onRestore, 
  onClose, 
  monthlyPrice = '$9.99',
  annualPrice = '$99.99',
  annualSavingsPercent = '33%'
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [processingPlan, setProcessingPlan] = useState(null); // 'monthly' or 'annual'
  const [cancelMessage, setCancelMessage] = useState(null);
  
  // Add animations for visual effects
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const glowAnim = React.useRef(new Animated.Value(0)).current;
  
  // Animate the glow effect
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: false,
        }),
      ])
    ).start();
    
    // Pulse animation for the PRO badge
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [glowAnim, pulseAnim]);
  
  // Interpolate glow color
  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(193, 255, 114, 0.1)', 'rgba(193, 255, 114, 0.5)']
  });

  // Animation properties for staggered entries
  const getEntranceAnimation = (delay) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: {
      type: 'spring',
      damping: 20,
      stiffness: 300,
      delay,
    },
  });

  const renderFeatureItem = (icon, text, delay = 0) => (
    <Motion.View
      {...getEntranceAnimation(0.3 + delay * 0.1)}
      style={styles.featureItem}
    >
      <View style={styles.featureIconContainer}>
        <Ionicons name={icon} size={20} color="#222222" />
      </View>
      <Text style={styles.featureText}>{text}</Text>
    </Motion.View>
  );

  // Handle monthly purchase with error handling
  const handleMonthlyPurchase = async () => {
    try {
      setIsLoading(true);
      setProcessingPlan('monthly');
      setCancelMessage(null);
      
      const result = await onPurchaseMonthly();
      
      // When user cancels a purchase, don't show any message
      // Just silently return to the subscription options
    } catch (error) {
      console.error('Error during monthly purchase:', error);
    } finally {
      setIsLoading(false);
      setProcessingPlan(null);
    }
  };

  // Handle annual purchase with error handling
  const handleAnnualPurchase = async () => {
    try {
      setIsLoading(true);
      setProcessingPlan('annual');
      setCancelMessage(null);
      
      const result = await onPurchaseAnnual();
      
      // When user cancels a purchase, don't show any message
      // Just silently return to the subscription options
    } catch (error) {
      console.error('Error during annual purchase:', error);
    } finally {
      setIsLoading(false);
      setProcessingPlan(null);
    }
  };

  // Handle restore with loading state
  const handleRestore = async () => {
    try {
      setIsLoading(true);
      setCancelMessage(null);
      
      const result = await onRestore();
      
      if (result === false) {
        setCancelMessage('No active subscriptions found.');
        setTimeout(() => setCancelMessage(null), 3000);
      }
    } catch (error) {
      console.error('Error during restore:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.contentWrapper}>
        {/* Close Button */}
        <TouchableOpacity 
          style={styles.closeButton} 
          onPress={onClose}
          disabled={isLoading}
        >
          <Ionicons name="close" size={28} color="#c1ff72" />
        </TouchableOpacity>

        {/* Header - Only velra text, logo moved closer to notch */}
        <Motion.View {...getEntranceAnimation(0.1)} style={styles.headerContainer}>
          <View style={styles.titleContainer}>
            <Text style={styles.titleDecoder}>velra</Text>
            <Animated.View 
              style={[
                styles.proContainer,
                { transform: [{ scale: pulseAnim }] }
              ]}
            >
              <Text style={styles.titlePro}>PRO</Text>
            </Animated.View>
          </View>
        </Motion.View>

        <Motion.View {...getEntranceAnimation(0.2)}>
          <Text style={styles.subtitle}>
            Premium Virtual Try-On Experience
          </Text>
        </Motion.View>

        {/* Cancellation message */}
        {cancelMessage && (
          <View style={styles.cancelMessageContainer}>
            <Text style={styles.cancelMessageText}>{cancelMessage}</Text>
          </View>
        )}

        {/* Features */}
        <View style={styles.featuresContainer}>
          {renderFeatureItem('shirt', 'Multiple virtual try-ons', 0)}
          {renderFeatureItem('bookmark', 'Save your favorite outfits', 1)}
          {renderFeatureItem('star', 'Premium fabric options', 2)}
          {renderFeatureItem('trending-up', 'Priority access to new styles', 3)}
        </View>

        {/* Subscription Options */}
        <View style={styles.subscriptionOptionsContainer}>
          <Motion.View {...getEntranceAnimation(0.7)}>
            <TouchableOpacity
              style={[
                styles.subscriptionButton, 
                styles.monthlyButton,
                processingPlan === 'monthly' && styles.processingButton
              ]}
              onPress={handleMonthlyPurchase}
              disabled={isLoading}
            >
              {processingPlan === 'monthly' ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#000000" />
                  <Text style={styles.processingText}>Processing...</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.subscriptionButtonTitle}>Monthly</Text>
                  <Text style={styles.subscriptionButtonPrice}>{monthlyPrice}</Text>
                  <Text style={styles.subscriptionButtonPeriod}>per month</Text>
                </>
              )}
            </TouchableOpacity>
          </Motion.View>

          <Motion.View {...getEntranceAnimation(0.8)}>
            <Animated.View style={{
              shadowColor: '#c1ff72',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: glowAnim,
              shadowRadius: 20,
              elevation: 10,
              borderRadius: 16,
            }}>
              <TouchableOpacity
                style={[
                  styles.subscriptionButton, 
                  styles.annualButton,
                  processingPlan === 'annual' && styles.processingButton
                ]}
                onPress={handleAnnualPurchase}
                disabled={isLoading}
              >
                <View style={styles.bestValueBadge}>
                  <Text style={styles.bestValueText}>BEST VALUE</Text>
                </View>
                
                {processingPlan === 'annual' ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#000000" />
                    <Text style={styles.processingText}>Processing...</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.subscriptionButtonTitle}>Annual</Text>
                    <Text style={styles.subscriptionButtonPrice}>{annualPrice}</Text>
                    <Text style={styles.subscriptionButtonPeriod}>per year</Text>
                    <Text style={styles.savingsText}>Save {annualSavingsPercent}</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          </Motion.View>
        </View>

        {/* Footer */}
        <Motion.View {...getEntranceAnimation(0.9)} style={styles.footer}>
          <TouchableOpacity 
            onPress={handleRestore}
            disabled={isLoading}
          >
            <Text style={[
              styles.restoreText,
              isLoading && styles.disabledText
            ]}>
              {isLoading && !processingPlan ? 'Restoring...' : 'Restore Purchases'}
            </Text>
          </TouchableOpacity>
        </Motion.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2EA',
  },
  contentWrapper: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
    justifyContent: 'space-between',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 20,
    zIndex: 10,
    padding: 5,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContainer: {
    marginTop: Platform.OS === 'ios' ? 30 : 40, // Reduced from 60:80 to 30:40
    alignItems: 'center',
    marginBottom: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleDecoder: {
    fontSize: 32,
    fontWeight: '700',
    color: '#444444',
    fontFamily: 'OldEnglish',
    letterSpacing: 1,
  },
  proContainer: {
    backgroundColor: '#c1ff72', // Changed to neon green
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginLeft: 8,
    borderRadius: 4,
  },
  titlePro: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222222',
  },
  subtitle: {
    fontSize: 18,
    color: '#444444',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  cancelMessageContainer: {
    padding: 10,
    backgroundColor: 'rgba(68, 68, 68, 0.2)',
    borderRadius: 8,
    marginVertical: 10,
  },
  cancelMessageText: {
    textAlign: 'center',
    color: '#444444',
  },
  featuresContainer: {
    marginTop: 20,
    marginBottom: 30,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#c1ff72', // Changed to neon green
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    color: '#444444', // Changed to dark gray
    fontSize: 16,
    flex: 1,
  },
  subscriptionOptionsContainer: {
    marginBottom: 40,
  },
  subscriptionButton: {
    backgroundColor: '#F5F2EA', // Changed to cream
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#444444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
    position: 'relative',
    overflow: 'hidden',
  },
  monthlyButton: {
    backgroundColor: '#F5F2EA', // Changed to cream
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  annualButton: {
    backgroundColor: '#F5F2EA', // Changed to cream
    borderWidth: 2,
    borderColor: '#c1ff72', // Changed to neon green
  },
  processingButton: {
    opacity: 0.8,
  },
  bestValueBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#c1ff72',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  bestValueText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#222222',
  },
  subscriptionButtonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#444444', // Changed to dark gray
    marginBottom: 4,
  },
  subscriptionButtonPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#444444',
    marginBottom: 4,
    fontFamily: 'OldEnglish',
  },
  subscriptionButtonPeriod: {
    fontSize: 14,
    color: '#666666', // Changed to medium gray
    marginBottom: 8,
  },
  savingsText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#444444',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
  },
  processingText: {
    color: '#444444', // Changed to dark gray
    marginTop: 10,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  restoreText: {
    color: '#444444',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  disabledText: {
    opacity: 0.5,
  },
});

export default CustomPaywall; 