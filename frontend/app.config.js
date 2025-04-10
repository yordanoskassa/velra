import { ExpoConfig } from 'expo/config';

// Get the API URL from environment variables or use local IP for development---not this one
const API_URL = process.env.API_URL || 'https://903a-64-85-147-243.ngrok-free.app';

const config = {
  name: "velra",
  slug: "velra",
  version: "2.0.0",
  orientation: "portrait",
  backgroundColor: "#ffffff",
  userInterfaceStyle: "light",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  assetBundlePatterns: [
    "**/*"
  ],
  ios: {
    buildNumber: "23",
    supportsTablet: true,
    bundleIdentifier: "com.kassay.vton",
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
    package: "com.kassay.vton",
    versionCode: 23,
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#ffffff"
    }
  },
  web: {
    favicon: "./assets/favicon.png",
    backgroundColor: "#ffffff"
  },
  extra: {
    apiUrl: API_URL,
    eas: {
      projectId: "a6d75db1-d3bb-4a67-a658-e6101a368ebf"
    }
  },
  scheme: "velra",
  jsEngine: "hermes",
  experiments: {
    tsconfigPaths: true
  },
  plugins: [
    // Media library plugin
    [
      "expo-media-library",
      {
        photosPermission: "Allow $(PRODUCT_NAME) to access your photos.",
        savePhotosPermission: "Allow $(PRODUCT_NAME) to save photos.",
        isAccessMediaLocationEnabled: true
      }
    ],
    // Font plugin
    "expo-font"
  ]
};

export default config; 