import { ExpoConfig } from 'expo/config';

// Get the API URL from environment variables or use a default
const API_URL = process.env.API_URL || 'http://localhost:8000';

const config = {
  name: "Headline Decoder",
  slug: "headline-decoder",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#000000"
  },
  assetBundlePatterns: [
    "**/*"
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.anonymous.headlinedecoder"
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#000000"
    },
    package: "com.anonymous.headlinedecoder"
  },
  web: {
    favicon: "./assets/favicon.png"
  },
  extra: {
    apiUrl: API_URL,
    eas: {
      projectId: "16a52a87-af3d-400e-92ec-c3be02b115cd"
    }
  }
};

export default config; 