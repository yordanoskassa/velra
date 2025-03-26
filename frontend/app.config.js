import { ExpoConfig } from 'expo/config';

// Get the API URL from environment variables or use local IP for development
const API_URL = process.env.API_URL || 'https://decodr-api.onrender.com';

const config = {
  name: "Decodr",
  slug: "headline-decoder",
  version: "2.0.0",
  orientation: "portrait",
  backgroundColor: "#000000",
  userInterfaceStyle: "light",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#000000"
  },
  assetBundlePatterns: [
    "**/*"
  ],
  ios: {
    buildNumber: "12",
    supportsTablet: true,
    bundleIdentifier: "com.anonymous.headlinedecoder",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      CFBundleIconName: "AppIcon",
      NSMediaLibraryUsageDescription: "Allow $(PRODUCT_NAME) to access your media library",
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
        NSExceptionDomains: {
          "ngrok-free.app": {
            NSExceptionAllowsInsecureHTTPLoads: true,
            NSIncludesSubdomains: true
          },
          "onrender.com": {
            NSExceptionAllowsInsecureHTTPLoads: true,
            NSIncludesSubdomains: true
          }
        }
      }
    },
    icon: "./assets/icon.png",
  },
  android: {
    package: "com.anonymous.headlinedecoder",
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#000000"
    }
  },
  web: {
    favicon: "./assets/favicon.png"
  },
  extra: {
    apiUrl: API_URL,
    eas: {
      projectId: "xxx"
    }
  },
  scheme: "decodr",
  jsEngine: "hermes",
  experiments: {
    tsconfigPaths: true
  },
  plugins: [
    [
      "expo-media-library",
      {
        photosPermission: "Allow $(PRODUCT_NAME) to access your photos.",
        savePhotosPermission: "Allow $(PRODUCT_NAME) to save photos.",
        isAccessMediaLocationEnabled: true
      }
    ]
  ]
};

export default config; 