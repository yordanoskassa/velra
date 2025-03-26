import React, { useEffect } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Button, Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PaywallModal = ({ visible, onClose, requireLogin = false }) => {
  const navigation = useNavigation();

  useEffect(() => {
    if (visible) {
      console.log("PaywallModal is now visible, requireLogin:", requireLogin);
    }
  }, [visible, requireLogin]);

  const handleSubscribe = () => {
    onClose();
    // Navigate to subscription screen
    navigation.navigate('Subscription');
  };

  const handleLogin = () => {
    onClose();
    // Navigate to login
    navigation.navigate('Welcome');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <Surface style={styles.container}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <MaterialCommunityIcons name="close" size={24} color="#000000" />
          </TouchableOpacity>
          
          <ScrollView contentContainerStyle={styles.content}>
            <MaterialCommunityIcons name="star-circle" size={72} color="#000000" style={styles.icon} />
            
            <Text style={styles.title}>
              {requireLogin 
                ? 'Sign In Required' 
                : 'Unlock Premium Features'}
            </Text>
            
            <Text style={styles.description}>
              {requireLogin 
                ? 'Please sign in to continue accessing insights and save more articles.' 
                : 'You\'ve reached your daily limit of free insights.'}
            </Text>
            
            {!requireLogin && (
              <View style={styles.featuresContainer}>
                <Text style={styles.featuresTitle}>Premium Benefits:</Text>
                
                <View style={styles.featureRow}>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#000000" />
                  <Text style={styles.featureText}>Unlimited insights analysis</Text>
                </View>
                
                <View style={styles.featureRow}>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#000000" />
                  <Text style={styles.featureText}>Unlimited article saves</Text>
                </View>
                
                <View style={styles.featureRow}>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#000000" />
                  <Text style={styles.featureText}>Weekly market insights report</Text>
                </View>
                
                <View style={styles.featureRow}>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#000000" />
                  <Text style={styles.featureText}>Ad-free experience</Text>
                </View>
                
                <View style={styles.featureRow}>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#000000" />
                  <Text style={styles.featureText}>Portfolio tracking</Text>
                </View>
                
                <View style={styles.priceContainer}>
                  <Text style={styles.price}>$9.99</Text>
                  <Text style={styles.pricePeriod}>/month</Text>
                </View>
              </View>
            )}
            
            <View style={styles.buttonContainer}>
              {requireLogin ? (
                <Button 
                  mode="contained" 
                  style={styles.primaryButton}
                  contentStyle={{ padding: 8 }}
                  labelStyle={styles.buttonLabel}
                  onPress={handleLogin}
                >
                  Sign In
                </Button>
              ) : (
                <Button 
                  mode="contained" 
                  style={styles.primaryButton}
                  contentStyle={{ padding: 8 }}
                  labelStyle={styles.buttonLabel}
                  onPress={handleSubscribe}
                >
                  Subscribe Now
                </Button>
              )}
              
              <Button 
                mode="outlined" 
                style={styles.secondaryButton}
                contentStyle={{ padding: 8 }}
                labelStyle={styles.secondaryButtonLabel}
                onPress={onClose}
              >
                {requireLogin ? 'Continue Limited Access' : 'Maybe Later'}
              </Button>
            </View>
          </ScrollView>
        </Surface>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9999,
  },
  container: {
    flex: 1,
    margin: 16,
    marginTop: 96,
    marginBottom: 48,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 10000,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  icon: {
    marginTop: 24,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'Inter-Bold',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
    color: '#666666',
    fontFamily: 'Inter-Regular',
  },
  featuresContainer: {
    width: '100%',
    padding: 16,
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    fontFamily: 'Inter-SemiBold',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    marginLeft: 8,
    fontFamily: 'Inter-Regular',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginTop: 24,
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  pricePeriod: {
    fontSize: 16,
    color: '#666666',
    marginLeft: 4,
    fontFamily: 'Inter-Regular',
  },
  buttonContainer: {
    width: '100%',
    marginTop: 24,
  },
  primaryButton: {
    marginBottom: 12,
    borderRadius: 6,
    backgroundColor: '#000000',
  },
  secondaryButton: {
    borderColor: '#000000',
    borderRadius: 6,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  secondaryButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    fontFamily: 'Inter-SemiBold',
  },
});

export default PaywallModal; 