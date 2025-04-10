import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, View, Text, Platform, Dimensions } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Animated } from 'react-native';

// Import screens
import VirtualTryOnScreen from '../screens/NewsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SavedScreen from '../screens/SavedScreen';

const Tab = createBottomTabNavigator();
const ProfileStack = createNativeStackNavigator();
const { width } = Dimensions.get('window');

// Create a stack navigator for Profile to include Settings
const ProfileStackNavigator = () => {
  return (
    <ProfileStack.Navigator 
      screenOptions={{ 
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 200,
      }}
    >
      <ProfileStack.Screen 
        name="ProfileMain" 
        component={ProfileScreen} 
        options={{
          headerShown: false,
          headerBackVisible: false,
        }}
      />
      <ProfileStack.Screen 
        name="Settings" 
        component={SettingsScreen} 
      />
    </ProfileStack.Navigator>
  );
};

// Custom tab transition animation
const tabScreenOptions = ({ route }) => ({
  tabBarIcon: ({ color, size, focused }) => {
    let iconName;
    
    if (route.name === 'TryOn') {
      return (
        <View style={styles.tabIconContainer}>
          <MaterialCommunityIcons name="hanger" size={24} color={color} />
          {focused && <View style={[styles.activeIndicator, { backgroundColor: '#444444' }]} />}
        </View>
      );
    } else if (route.name === 'Saved') {
      return (
        <View style={styles.tabIconContainer}>
          <MaterialIcons name="star" size={24} color={color} />
          {focused && <View style={[styles.activeIndicator, { backgroundColor: '#444444' }]} />}
        </View>
      );
    } else if (route.name === 'Profile') {
      return (
        <View style={styles.tabIconContainer}>
          <MaterialIcons name="person" size={24} color={color} />
          {focused && <View style={[styles.activeIndicator, { backgroundColor: '#444444' }]} />}
        </View>
      );
    }
  },
});

const BottomTabNavigator = () => {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#444444',
        tabBarInactiveTintColor: '#888888',
        tabBarStyle: {
          ...styles.tabBar,
          height: 50 + (Platform.OS === 'ios' ? insets.bottom : 0),
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 2,
        },
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        // Custom tab transition animation
        tabBarIcon: tabScreenOptions({ route }).tabBarIcon,
        // Screen transition animation
        animation: 'fade',
        animationDuration: 200,
      })}
      screenListeners={({ navigation }) => ({
        tabPress: e => {
          // Add haptic feedback if desired
          // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      })}
    >
      <Tab.Screen 
        name="TryOn" 
        component={VirtualTryOnScreen} 
        options={{
          tabBarBadge: null,
        }}
      />
      <Tab.Screen 
        name="Saved" 
        component={SavedScreen} 
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileStackNavigator} 
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 1,
    borderTopColor: '#CCCCCC',
    backgroundColor: '#F5F2EA',
    elevation: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowColor: 'transparent',
    shadowOffset: { height: 0, width: 0 },
    zIndex: 999,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    position: 'relative',
  },
  activeIndicator: {
    width: 24,
    height: 2,
    backgroundColor: '#444444',
    position: 'absolute',
    bottom: -6,
    zIndex: 1,
    borderRadius: 0,
  },
});

export default BottomTabNavigator; 