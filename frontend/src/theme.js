import { DefaultTheme } from 'react-native-paper';

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#1976d2',
    primaryLight: '#42a5f5',
    primaryDark: '#1565c0',
    secondary: '#9c27b0',
    secondaryLight: '#ba68c8',
    secondaryDark: '#7b1fa2',
    background: '#f5f5f5',
    surface: '#ffffff',
    text: '#000000',
    textSecondary: '#666666',
    error: '#d32f2f',
    warning: '#ed6c02',
    success: '#2e7d32',
  },
  fonts: {
    ...DefaultTheme.fonts,
    regular: {
      fontFamily: 'Inter_400Regular',
      fontWeight: 'normal',
    },
    medium: {
      fontFamily: 'Inter_600SemiBold',
      fontWeight: 'normal',
    },
    light: {
      fontFamily: 'Inter_400Regular',
      fontWeight: 'normal',
    },
    thin: {
      fontFamily: 'Inter_400Regular',
      fontWeight: 'normal',
    },
  },
  typography: {
    fontFamily: 'Inter_400Regular',
    fontSize: {
      small: 14,
      medium: 16,
      large: 20,
      h1: 40,
      h2: 32,
      h3: 28,
    },
    fontWeight: {
      regular: 'normal',
      medium: 'normal',
      bold: 'normal',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    small: 4,
    medium: 8,
    large: 12,
  },
  shadows: {
    small: '0 2px 4px rgba(0, 0, 0, 0.1)',
    medium: '0 4px 6px rgba(0, 0, 0, 0.1)',
    large: '0 8px 16px rgba(0, 0, 0, 0.1)',
  },
};

export default theme;

