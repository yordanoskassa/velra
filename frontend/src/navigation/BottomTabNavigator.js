import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import screens
import NewsScreen from '../screens/NewsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SavedScreen from '../screens/SavedScreen';

const Tab = createBottomTabNavigator();
const ProfileStack = createNativeStackNavigator();

// Create a stack navigator for Profile to include Settings
const ProfileStackNavigator = () => {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
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

const BottomTabNavigator = () => {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#000000',
        tabBarInactiveTintColor: '#666666',
        tabBarStyle: {
          ...styles.tabBar,
          height: 40 + (Platform.OS === 'ios' ? insets.bottom : 0),
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 2,
        },
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen 
        name="Feed" 
        component={NewsScreen} 
        options={{
          tabBarIcon: ({ color, size, focused }) => (
            <View style={styles.tabIconContainer}>
              <MaterialIcons name="rss-feed" size={22} color={color} />
              {focused && <View style={styles.activeIndicator} />}
            </View>
          ),
        }}
      />
      <Tab.Screen 
        name="Saved" 
        component={SavedScreen} 
        options={{
          tabBarIcon: ({ color, size, focused }) => (
            <View style={styles.tabIconContainer}>
              <MaterialIcons name="star" size={22} color={color} />
              {focused && <View style={styles.activeIndicator} />}
            </View>
          ),
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileStackNavigator} 
        options={{
          tabBarIcon: ({ color, size, focused }) => (
            <View style={styles.tabIconContainer}>
              <MaterialIcons name="person" size={22} color={color} />
              {focused && <View style={styles.activeIndicator} />}
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
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
    paddingTop: 3,
  },
  activeIndicator: {
    width: 20,
    height: 2,
    backgroundColor: '#000000',
    position: 'absolute',
    bottom: -3,
    zIndex: 1,
  },
});

export default BottomTabNavigator; 