import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { IMFellEnglish_400Regular } from '@expo-google-fonts/im-fell-english';
import { IMFellDWPica_400Regular } from '@expo-google-fonts/im-fell-dw-pica';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { CourierPrime_400Regular } from '@expo-google-fonts/courier-prime';
import { NotoSerif_400Regular } from '@expo-google-fonts/noto-serif';
import * as SplashScreen from 'expo-splash-screen';
import { View, Text, ActivityIndicator, useWindowDimensions, Alert } from 'react-native';
import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
import { Syne_800ExtraBold } from '@expo-google-fonts/syne';
import { Raleway_400Regular, Raleway_500Medium, Raleway_600SemiBold } from '@expo-google-fonts/raleway';

// Import API config and test function
import { testApiConnection } from './src/api/config';

// Import screens
import ArticleDetailsScreen from './src/screens/ArticleDetailsScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import TermsOfService from './src/screens/TermsOfService';
import PrivacyPolicy from './src/screens/PrivacyPolicy';
import SubscriptionScreen from './src/screens/SubscriptionScreen';

// Import navigation
import BottomTabNavigator from './src/navigation/BottomTabNavigator';

// Import theme and context
import theme from './src/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SavedArticlesProvider } from './src/context/SavedArticlesContext';
import { NotificationProvider, useNotifications } from './src/context/NotificationContext';

// Import the SubscriptionProvider
import { SubscriptionProvider } from './src/context/SubscriptionContext';

// Import components
import NotificationPrompt from './src/components/NotificationPrompt';

const Stack = createNativeStackNavigator();

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

enableScreens();

// Simple error boundary component
function ErrorFallback({ error }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>Something went wrong</Text>
      <Text style={{ textAlign: 'center', marginBottom: 20 }}>{error?.message || 'Unknown error'}</Text>
    </View>
  );
}

// Main navigator that handles authentication state
function RootNavigator() {
  const { user, isLoading } = useAuth();
  const [isNavigationReady, setIsNavigationReady] = React.useState(false);
  const navigationRef = React.useRef(null);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // Log when user state changes
  React.useEffect(() => {
    console.log('RootNavigator: User state changed:', user ? `Logged in as ${user.email}` : 'Not logged in');
  }, [user]);

  // Handle navigation state change
  const onNavigationStateChange = () => {
    if (!isNavigationReady) {
      setIsNavigationReady(true);
    }
  };

  // Show loading screen while checking authentication
  if (isLoading) {
    console.log('RootNavigator: Loading auth state...');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#000000" />
        <Text style={{ marginTop: 16, color: '#000000', fontSize: 16 }}>Loading...</Text>
      </View>
    );
  }

  // Create a combined stack with both auth and app screens
  return (
    <NavigationContainer 
      ref={navigationRef}
      onStateChange={onNavigationStateChange}
    >
      <StatusBar style="light" />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { 
            backgroundColor: '#FFFFFF',
            paddingHorizontal: isTablet ? 100 : 0 
          },
        }}
      >
        {/* Main App with Bottom Tabs */}
        <Stack.Screen name="MainApp" component={BottomTabNavigator} />
        
        {/* Other Screens */}
        <Stack.Screen 
          name="ArticleDetails" 
          component={ArticleDetailsScreen}
          options={{ 
            headerShown: true, 
            title: '',
            headerStyle: {
              backgroundColor: '#FFFFFF',
            },
            headerTintColor: '#000000',
          }}
        />
        <Stack.Screen name="TermsOfService" component={TermsOfService} />
        <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicy} />
        <Stack.Screen name="Subscription" component={SubscriptionScreen} />
        
        {/* Auth Screens */}
        <Stack.Screen 
          name="Welcome" 
          component={WelcomeScreen}
          options={{
            contentStyle: { backgroundColor: '#FFFFFF' },
          }}
        />
        <Stack.Screen 
          name="Login" 
          component={LoginScreen}
          options={{
            contentStyle: { backgroundColor: '#FFFFFF' },
          }}
        />
        <Stack.Screen 
          name="Register" 
          component={RegisterScreen}
          options={{
            contentStyle: { backgroundColor: '#FFFFFF' },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Component to manage and render notification prompt
function NotificationManager() {
  const { isNotificationPromptVisible, closeNotificationPrompt, requestNotificationPermissions } = useNotifications();
  
  const handleEnableNotifications = async () => {
    await requestNotificationPermissions();
  };
  
  return (
    <NotificationPrompt 
      visible={isNotificationPromptVisible} 
      onClose={closeNotificationPrompt} 
      onEnable={handleEnableNotifications} 
    />
  );
}

function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    OldEnglish: Syne_800ExtraBold,
    'CourierPrime-Regular': CourierPrime_400Regular,
    'TimesNewRoman': NotoSerif_400Regular,
    'Raleway-Regular': Raleway_400Regular,
    'Raleway-Medium': Raleway_500Medium,
    'Raleway-SemiBold': Raleway_600SemiBold
  });

  const [error, setError] = React.useState(null);
  
  // Add a log to show app initialization
  React.useEffect(() => {
    console.log('App initialized');
  }, []);

  // Test API connection
  React.useEffect(() => {
    const testApi = async () => {
      try {
        console.log('Testing API connection...');
        const isConnected = await testApiConnection();
        if (isConnected) {
          console.log('Successfully connected to production API');
        } else {
          console.error('API connection test failed');
          Alert.alert(
            'Connection Error',
            'Unable to connect to the server. Please check your internet connection and try again.'
          );
        }
      } catch (error) {
        console.error('API connection test error:', error);
      }
    };
    
    testApi();
  }, []);

  React.useEffect(() => {
    if (fontsLoaded) {
      console.log('Fonts loaded, hiding splash screen');
      // Hide the splash screen after the fonts have loaded and the UI is ready
      SplashScreen.hideAsync().catch(() => {
        // Ignore errors hiding splash screen
      });
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  // If there's an error, show the fallback UI
  if (error) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <ErrorFallback error={error} />
      </SafeAreaProvider>
    );
  }

  // Log the app structure being rendered
  console.log('Rendering app with auth and saved articles providers');

  // Main app with error handling
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <PaperProvider theme={theme}>
        <AuthProvider>
          <SavedArticlesProvider>
            <SubscriptionProvider>
              <NotificationProvider>
                <RootNavigator />
                <NotificationManager />
              </NotificationProvider>
            </SubscriptionProvider>
          </SavedArticlesProvider>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

export default App; 