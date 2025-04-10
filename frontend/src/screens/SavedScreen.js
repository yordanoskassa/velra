import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Newsreader_400Regular,
  Newsreader_600SemiBold,
  useFonts 
} from '@expo-google-fonts/newsreader';
import * as SplashScreen from 'expo-splash-screen';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => {
  /* reloading the app might trigger some race conditions, ignore them */
});

const empowermentQuotes = [
  "You are beautiful inside and out, just the way you are.",
  "Your confidence is your most attractive accessory.",
  "Beauty begins the moment you decide to be yourself.",
  "Let your unique beauty shine bright today and always.",
  "Confidence is not 'they will like me.' It's 'I'll be fine if they don't.'",
  "When you feel beautiful, you project beauty.",
  "Your beauty is not defined by your appearance, but by the light in your heart.",
  "True beauty radiates from self-love and acceptance.",
  "Be proud of who you are becoming; the journey is beautiful.",
  "Your self-confidence makes you unstoppable.",
  "Elegance is when the inside is as beautiful as the outside.",
  "Beauty is power; a smile is its sword.",
  "Confidence isn't thinking you're better than everyone else, it's knowing you don't need to compare yourself.",
  "Radiate confidence and inner beauty without saying a word.",
  "You are enough just as you are. Remember that.",
  "The most beautiful thing you can wear is confidence.",
  "Your beauty is defined by you, not by society's standards.",
  "Let your inner beauty shine brighter than your outer appearance.",
  "Self-confidence is the best outfit. Rock it and own it.",
  "The beauty of a woman is not in the clothes she wears, but in the way she carries herself.",
  "When you are confident, you make others around you feel comfortable too.",
  "Your beauty comes from being unapologetically yourself.",
  "Stand tall, speak up, and own your beauty.",
  "Confidence looks gorgeous on you.",
  "Embrace your flaws. That's where your true beauty lies.",
  "Beauty starts with self-acceptance and blooms with self-love.",
  "When you feel beautiful, you become beautiful.",
  "Confidence is silent. Insecurities are loud.",
  "Your unique beauty tells a story only you can tell.",
  "Self-confidence is the foundation of all great success and achievement.",
  "The most powerful thing a woman can do is believe in her own beauty.",
  "Beautiful people are not always good, but good people are always beautiful.",
  "True beauty is being comfortable in your own skin.",
  "Confidence comes not from always being right but from not fearing to be wrong.",
  "You are beautiful because you are uniquely yourself.",
  "The more you love yourself, the more your beauty radiates to others.",
  "Your beauty is not measured by others' opinions.",
  "A confident woman can look at her reflection and see herself, not the world's expectations.",
  "Be your own kind of beautiful.",
  "The beauty of a woman grows with the passing years.",
  "Let your confidence be louder than your insecurities.",
  "Beauty is how you feel inside, and it reflects in your eyes.",
  "You are beautiful exactly as you are, not as someone else wants you to be.",
  "Confidence is the ability to feel beautiful without needing someone to tell you.",
  "Your beauty shouldn't diminish another's. True beauty uplifts everyone.",
  "The way you carry yourself sets the tone for how others perceive you.",
  "Don't let insecurity ruin the beauty you were born with.",
  "Self-confidence is a superpower. Once you start believing in yourself, magic happens.",
  "Be confident enough to be kind. That's where true beauty lies.",
  "Every time you think of yourself as beautiful, you become a little more so."
];

const SavedScreen = () => {
  const insets = useSafeAreaInsets();
  const [quote, setQuote] = useState("");
  
  // Load the Newsreader fonts
  const [fontsLoaded] = useFonts({
    'Newsreader_400Regular': Newsreader_400Regular,
    'Newsreader_600SemiBold': Newsreader_600SemiBold,
  });

  // Hide splash screen once fonts are loaded
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(console.warn);
    }
  }, [fontsLoaded]);
  
  useEffect(() => {
    // Get random quote of the day
    const today = new Date().toDateString();
    // Use the date string to seed a simple random number
    let seed = 0;
    for (let i = 0; i < today.length; i++) {
      seed += today.charCodeAt(i);
    }
    // Get a quote based on the seed (same quote for the whole day)
    const quoteIndex = seed % empowermentQuotes.length;
    setQuote(empowermentQuotes[quoteIndex]);
  }, []);
  
  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#444444" />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <View style={{ height: insets.top, backgroundColor: '#F5F2EA' }} />
      <View style={styles.header}>
        <Text style={styles.logoText}>velra</Text>
      </View>
      <View style={styles.quoteContainer}>
        <View style={styles.quoteCard}>
          <Text style={styles.quoteText}>{quote}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2EA',
  },
  loadingContainer: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#F5F2EA',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#F5F2EA',
  },
  logoText: {
    fontSize: 28,
    fontFamily: 'OldEnglish',
    color: '#444444',
    letterSpacing: 1,
  },
  quoteContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F2EA',
  },
  quoteCard: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    padding: 30,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  quoteText: {
    color: '#444444',
    fontSize: 26,
    fontFamily: 'Newsreader_600SemiBold',
    textAlign: 'center',
    lineHeight: 36,
  }
});

export default SavedScreen; 