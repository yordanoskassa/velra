import React from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar } from 'react-native';
import ExampleRNR from './components/ExampleRNR';

// Import NativeWind stylesheet to enable Tailwind
import './global.css';

// This file demonstrates how you would integrate RNR into your App.js
export default function RNRExample() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ExampleRNR />
    </SafeAreaView>
  );
}

// Only use styles for container - everything else uses Tailwind classes
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

/**
 * HOW TO INTEGRATE WITH YOUR EXISTING APP:
 * 
 * 1. In your App.js:
 *    - Import './global.css'
 *    - You can then use your RNR components throughout your app
 * 
 * 2. Use the components:
 *    import { Button, Card, H2 } from './components/ui';
 *
 *    function MyScreen() {
 *      return (
 *        <View className="p-4">
 *          <H2>My Screen</H2>
 *          <Button onPress={() => console.log('pressed')}>Press Me</Button>
 *        </View>
 *      );
 *    }
 * 
 * 3. Replace existing components:
 *    - Replace <Text> with <P> or appropriate Typography component
 *    - Replace <TouchableOpacity> or similar with <Button>
 *    - Use Tailwind classes with className="" instead of style={}
 */ 