import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { View, Text, ActivityIndicator } from 'react-native';
import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';

// Import screens
import NewsScreen from './src/screens/NewsScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ArticleDetailsScreen from './src/screens/ArticleDetailsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TermsOfService from './src/screens/TermsOfService';
import PrivacyPolicy from './src/screens/PrivacyPolicy';

// Import theme and context
import theme from './src/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';

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

// Auth Stack - screens for non-authenticated users
function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#000000' },
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

// App Stack - screens for authenticated users
function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <Stack.Screen name="News" component={NewsScreen} />
      <Stack.Screen 
        name="ArticleDetails" 
        component={ArticleDetailsScreen}
        options={{ 
          headerShown: true, 
          title: '',
          headerStyle: {
            backgroundColor: '#1a237e',
          },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="TermsOfService" component={TermsOfService} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicy} />
    </Stack.Navigator>
  );
}

// Main navigator that handles authentication state
function RootNavigator() {
  const { user, isLoading } = useAuth();
  const [isNavigationReady, setIsNavigationReady] = React.useState(false);
  const navigationRef = React.useRef(null);

  // Log when user state changes
  React.useEffect(() => {
    console.log('RootNavigator: User state changed:', user ? `Logged in as ${user.email}` : 'Logged out');
    
    if (user) {
      console.log('RootNavigator: User is authenticated, showing AppStack');
    } else {
      console.log('RootNavigator: User is not authenticated, showing AuthStack');
    }
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={{ marginTop: 16, color: '#FFFFFF', fontSize: 16 }}>Loading...</Text>
      </View>
    );
  }

  console.log('RootNavigator: Rendering with user:', user ? `Authenticated as ${user.email}` : 'Not authenticated');

  return (
    <NavigationContainer 
      ref={navigationRef}
      onStateChange={onNavigationStateChange}
    >
      <StatusBar style="light" />
      {user ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (fontsLoaded) {
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

  // Main app with error handling
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

export default App; 