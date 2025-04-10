import { registerRootComponent } from 'expo';
import { AppRegistry } from 'react-native';
import App from './App';

// Register with multiple potential names to handle different runtime environments
AppRegistry.registerComponent('velra', () => App);
AppRegistry.registerComponent('com.kassay.vton', () => App);
AppRegistry.registerComponent('', () => App); // Register with empty string as fallback

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
