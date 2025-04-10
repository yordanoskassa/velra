import { Platform } from 'react-native';
import axios from 'axios';
import { API_URL } from '../config/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock implementation of Apple Pay for development
// In a real app, you would use a library like react-native-payments
// or stripe-react-native to handle Apple Pay
const mockApplePay = {
  canMakePayments: async () => {
    // In a real implementation, this would check if the device supports Apple Pay
    return Platform.OS === 'ios';
  },
  
  requestPayment: async (paymentRequest) => {
    // This is a mock implementation that simulates a successful payment
    // In a real app, this would show the Apple Pay sheet and process the payment
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Return a mock payment token
    return {
      success: true,
      token: 'mock-apple-pay-token-' + Date.now(),
      paymentMethod: 'apple_pay'
    };
  }
};

// Mock implementation of credit card payment for development
const mockCreditCardPayment = {
  processPayment: async (cardDetails) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Return a mock payment token
    return {
      success: true,
      token: 'mock-credit-card-token-' + Date.now(),
      paymentMethod: 'credit_card'
    };
  }
};

export const canUseApplePay = async () => {
  if (Platform.OS !== 'ios') return false;
  
  try {
    // In a real app, this would use the actual Apple Pay API
    return await mockApplePay.canMakePayments();
  } catch (error) {
    console.error('Error checking Apple Pay availability:', error);
    return false;
  }
};

export const processApplePayPayment = async (amount, description, subscriptionPlan) => {
  try {
    // In a real app, this would create a proper Apple Pay payment request
    const paymentRequest = {
      countryCode: 'US',
      currencyCode: 'USD',
      supportedNetworks: ['visa', 'mastercard', 'amex'],
      merchantCapabilities: ['3ds', 'debit', 'credit'],
      total: {
        label: 'Headline Decoder Premium',
        amount: amount.toString(),
        type: 'final'
      },
      description
    };
    
    // Process the payment with Apple Pay
    const paymentResponse = await mockApplePay.requestPayment(paymentRequest);
    
    if (!paymentResponse.success) {
      throw new Error('Payment failed');
    }
    
    // Get the authentication token
    const token = await AsyncStorage.getItem('token');
    
    // Send the payment token to your backend to create a subscription
    const response = await axios.post(
      `${API_URL}/subscription`,
      {
        payment_method: 'apple_pay',
        receipt_data: paymentResponse.token,
        subscription_plan: subscriptionPlan
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error processing Apple Pay payment:', error);
    throw error;
  }
};

export const processCreditCardPayment = async (cardDetails, amount, subscriptionPlan) => {
  try {
    // Process the payment with a credit card
    const paymentResponse = await mockCreditCardPayment.processPayment(cardDetails);
    
    if (!paymentResponse.success) {
      throw new Error('Payment failed');
    }
    
    // Get the authentication token
    const token = await AsyncStorage.getItem('token');
    
    // Send the payment token to your backend to create a subscription
    const response = await axios.post(
      `${API_URL}/subscription`,
      {
        payment_method: 'credit_card',
        receipt_data: paymentResponse.token,
        subscription_plan: subscriptionPlan
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error processing credit card payment:', error);
    throw error;
  }
};

export const restoreSubscription = async () => {
  try {
    // Get the authentication token
    const token = await AsyncStorage.getItem('token');
    
    if (!token) {
      throw new Error('User not authenticated');
    }
    
    // Call the backend to restore the subscription
    const response = await axios.get(
      `${API_URL}/subscription`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error restoring subscription:', error);
    throw error;
  }
};

export const cancelSubscription = async () => {
  try {
    // Get the authentication token
    const token = await AsyncStorage.getItem('token');
    
    if (!token) {
      throw new Error('User not authenticated');
    }
    
    // Call the backend to cancel the subscription
    const response = await axios.delete(
      `${API_URL}/subscription`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
}; 