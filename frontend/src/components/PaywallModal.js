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
            <MaterialCommunityIcons name="close" size={24} color="#222222" />
          </TouchableOpacity>
          
          <ScrollView contentContainerStyle={styles.content}>
            <MaterialCommunityIcons name="star-circle" size={72} color="#444444" style={styles.icon} />
            
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
                  <MaterialCommunityIcons name="check-circle" size={20} color="#222222" />
                  <Text style={styles.featureText}>multiple insights analysis</Text>
                </View>
                
                <View style={styles.featureRow}>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#222222" />
                  <Text style={styles.featureText}>multiple article saves</Text>
                </View>
                
                <View style={styles.featureRow}>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#222222" />
                  <Text style={styles.featureText}>Weekly market insights report</Text>
                </View>
                
                <View style={styles.featureRow}>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#222222" />
                  <Text style={styles.featureText}>Ad-free experience</Text>
                </View>
                
                <View style={styles.featureRow}>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#222222" />
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  container: {
    flex: 1,
    backgroundColor: '#111111',
    borderRadius: 12,
    margin: 16,
    overflow: 'hidden',
    elevation: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#444444',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  icon: {
    marginTop: 32,
    marginBottom: 24,
    color: '#444444',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#444444',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
    color: '#FFFFFF',
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 24,
    backgroundColor: '#222222',
    padding: 20,
    borderRadius: 12,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#444444',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#FFFFFF',
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
    color: '#444444',
  },
  pricePeriod: {
    fontSize: 16,
    color: '#AAAAAA',
    marginLeft: 2,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 16,
  },
  primaryButton: {
    backgroundColor: '#444444',
    borderRadius: 12,
    marginBottom: 12,
    padding: 4,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222222',
    paddingVertical: 4,
  },
  secondaryButton: {
    borderColor: '#444444',
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryButtonLabel: {
    color: '#444444',
  },
});

export default PaywallModal; 