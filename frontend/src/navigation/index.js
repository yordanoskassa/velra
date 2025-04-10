import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SettingsScreen from '../screens/SettingsScreen';
import ArticleDetailsScreen from '../screens/ArticleDetailsScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicy';
import TermsOfServiceScreen from '../screens/TermsOfService';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import BottomTabNavigator from './BottomTabNavigator';

const MainStack = createNativeStackNavigator();

function MainStackNavigator() {
  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="HomeTabs" component={BottomTabNavigator} />
      <MainStack.Screen 
        name="ArticleDetails" 
        component={ArticleDetailsScreen}
        options={{ 
          headerShown: true, 
          headerTransparent: true,
          headerTitle: '', 
          headerBackTitle: '',
          headerTintColor: '#FFFFFF'
        }} 
      />
      <MainStack.Screen 
        name="Settings" 
        component={SettingsScreen} 
        options={{ 
          headerShown: true,
          headerTitle: 'Settings',
          headerTintColor: '#000000',
          headerStyle: { backgroundColor: '#FFFFFF' }
        }} 
      />
      <MainStack.Screen 
        name="PrivacyPolicy" 
        component={PrivacyPolicyScreen}
        options={{ 
          headerShown: true,
          headerTitle: 'Privacy Policy',
          headerTintColor: '#000000',
          headerStyle: { backgroundColor: '#FFFFFF' }
        }} 
      />
      <MainStack.Screen 
        name="TermsOfService" 
        component={TermsOfServiceScreen}
        options={{ 
          headerShown: true,
          headerTitle: 'Terms of Service',
          headerTintColor: '#000000',
          headerStyle: { backgroundColor: '#FFFFFF' }
        }} 
      />
      <MainStack.Screen 
        name="Subscription" 
        component={SubscriptionScreen}
        options={{ 
          headerShown: true,
          headerTitle: 'Subscription',
          headerTintColor: '#000000',
          headerStyle: { backgroundColor: '#FFFFFF' }
        }} 
      />
    </MainStack.Navigator>
  );
}

export default MainStackNavigator; 