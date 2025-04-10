import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  View, 
  Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';

// Export the constants from the official package for convenience
export const ButtonType = {
  SIGN_IN: AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN,
  CONTINUE: AppleAuthentication.AppleAuthenticationButtonType.CONTINUE,
  SIGN_UP: AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
};

export const ButtonStyle = {
  WHITE: AppleAuthentication.AppleAuthenticationButtonStyle.WHITE,
  BLACK: AppleAuthentication.AppleAuthenticationButtonStyle.BLACK,
  WHITE_OUTLINE: AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE
};

/**
 * Apple Authentication Button that works on both iOS and Android
 * Falls back to a custom implementation on Android or when native Apple button is not available
 */
const AppleButton = ({ 
  style = {}, 
  buttonStyle = ButtonStyle.BLACK,
  buttonType = ButtonType.SIGN_IN,
  cornerRadius = 5,
  onPress,
  disabled = false
}) => {
  const [appleAuthAvailable, setAppleAuthAvailable] = React.useState(false);
  
  // Check if Apple Authentication is available on this device
  React.useEffect(() => {
    const checkAvailability = async () => {
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      console.log('Apple Sign In available:', isAvailable);
      setAppleAuthAvailable(isAvailable);
    };
    
    checkAvailability().catch(error => {
      console.log('Error checking Apple Sign In availability:', error);
      setAppleAuthAvailable(false);
    });
  }, []);
  
  // If Apple Authentication is available and we're on iOS, use the native button
  if (appleAuthAvailable && Platform.OS === 'ios') {
    return (
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={buttonType}
        buttonStyle={buttonStyle}
        cornerRadius={cornerRadius}
        style={[styles.nativeButton, style]}
        onPress={onPress}
      />
    );
  }
  
  // Otherwise, fall back to our custom implementation
  
  // Determine button background and text colors based on style
  const buttonBackgroundColor = 
    buttonStyle === ButtonStyle.BLACK 
      ? '#000000' 
      : '#FFFFFF';
      
  const buttonTextColor = 
    buttonStyle === ButtonStyle.BLACK 
      ? '#FFFFFF' 
      : '#000000';
  
  const buttonBorderWidth = 
    buttonStyle === ButtonStyle.WHITE_OUTLINE 
      ? 1 
      : 0;
      
  const iconColor = 
    buttonStyle === ButtonStyle.BLACK 
      ? '#FFFFFF' 
      : '#000000';
  
  // Get button text based on type
  const getButtonText = () => {
    switch (buttonType) {
      case ButtonType.SIGN_IN:
        return 'Sign in with Apple';
      case ButtonType.CONTINUE:
        return 'Continue with Apple';
      case ButtonType.SIGN_UP:
        return 'Sign up with Apple';
      default:
        return 'Sign in with Apple';
    }
  };
  
  console.log(`Rendering custom Apple button: ${buttonType}, style: ${buttonStyle}`);
  
  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: buttonBackgroundColor,
          borderColor: '#000000',
          borderWidth: buttonBorderWidth,
          borderRadius: cornerRadius
        },
        style
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={getButtonText()}
      testID="apple-auth-button"
    >
      <Ionicons 
        name="logo-apple" 
        size={24} 
        color={iconColor} 
        style={styles.icon} 
      />
      <Text style={[styles.text, { color: buttonTextColor }]}>
        {getButtonText()}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minWidth: 180,
    minHeight: 48,
    marginVertical: 8
  },
  nativeButton: {
    height: 48,
    minWidth: 180,
    marginVertical: 8
  },
  icon: {
    marginRight: 8
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  }
});

export default AppleButton; 