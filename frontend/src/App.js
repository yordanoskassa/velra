import React, { useState, useEffect, useMemo } from 'react';
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Syne_800ExtraBold } from '@expo-google-fonts/syne';
import { Raleway_400Regular, Raleway_500Medium, Raleway_600SemiBold } from '@expo-google-fonts/raleway';
import { CourierPrime_400Regular } from '@expo-google-fonts/courier-prime';
import { NotoSerif_400Regular } from '@expo-google-fonts/noto-serif';
import { View, ActivityIndicator, StyleSheet, StatusBar, Platform, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import { AuthProvider } from './context/AuthContext';
import { SavedArticlesProvider } from './context/SavedArticlesContext';
import { ThemeProvider } from './context/ThemeContext';
import { UsageProvider } from './context/UsageContext';
import { Provider as PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Navigation from './navigation';
import { lightTheme, darkTheme } from './theme';

// Enable screens for better navigation performance
enableScreens();

// Ignore specific RN warnings
LogBox.ignoreLogs([
  'VirtualizedLists should never be nested',
  'Sending `onAnimatedValueUpdate` with no listeners registered',
]);

function App() {
  const [fontsLoaded] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
    'OldEnglish': Syne_800ExtraBold,
    'CourierPrime-Regular': CourierPrime_400Regular,
    'TimesNewRoman': NotoSerif_400Regular,
    'Raleway-Regular': Raleway_400Regular,
    'Raleway-Medium': Raleway_500Medium,
    'Raleway-SemiBold': Raleway_600SemiBold
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <PaperProvider>
            <AuthProvider>
              <UsageProvider>
                <SavedArticlesProvider>
                  <NavigationContainer>
                    <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
                    <Navigation />
                  </NavigationContainer>
                </SavedArticlesProvider>
              </UsageProvider>
            </AuthProvider>
          </PaperProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  }
});

export default App; 