import React, { createContext, useState, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_PREFERENCE_KEY = '@velra_theme_preference';

// Default theme values to prevent null errors
const DEFAULT_LIGHT_THEME = {
  dark: false,
  colors: {
    primary: '#4F46E5',
    background: '#F5F2EA',
    surface: '#F5F2EA',
    text: '#000000',
    secondaryText: '#6E6E6E',
    border: '#E0E0E0',
    card: '#F5F2EA',
    error: '#B00020',
    placeholder: '#AAAAAA',
  }
};

const DEFAULT_DARK_THEME = {
  dark: true,
  colors: {
    primary: '#4F46E5',
    background: '#F5F2EA',
    surface: '#F5F2EA',
    text: '#000000',
    secondaryText: '#555555',
    border: '#D0D0D0',
    card: '#F5F2EA',
    error: '#CF6679',
    placeholder: '#666666',
  }
};

// Create the context
const ThemeContext = createContext({
  isDarkMode: false,
  theme: DEFAULT_LIGHT_THEME,
  toggleTheme: () => {},
});

export const ThemeProvider = ({ children }) => {
  const deviceTheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(deviceTheme === 'dark');
  
  // Load saved theme preference on mount
  useEffect(() => {
    loadThemePreference();
  }, []);

  // Save theme preference when it changes
  useEffect(() => {
    saveThemePreference();
  }, [isDarkMode]);

  const loadThemePreference = async () => {
    try {
      const savedPreference = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
      
      if (savedPreference !== null) {
        setIsDarkMode(savedPreference === 'dark');
      } else {
        // If no saved preference, use device theme
        setIsDarkMode(deviceTheme === 'dark');
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
      // Default to device theme if there's an error
      setIsDarkMode(deviceTheme === 'dark');
    }
  };

  const saveThemePreference = async () => {
    try {
      await AsyncStorage.setItem(THEME_PREFERENCE_KEY, isDarkMode ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(prevMode => !prevMode);
  };

  // Define theme based on mode
  const theme = isDarkMode ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;

  return (
    <ThemeContext.Provider value={{ isDarkMode, theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use the theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    console.warn('useTheme must be used within a ThemeProvider, returning default theme');
    return { 
      isDarkMode: false, 
      theme: DEFAULT_LIGHT_THEME, 
      toggleTheme: () => console.warn('Theme toggle unavailable') 
    };
  }
  return context;
};

export default ThemeContext; 