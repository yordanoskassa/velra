import React from 'react';
import { View, ScrollView } from 'react-native';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, H2, P, Small } from './ui';

/**
 * Example component demonstrating React Native Reusables components
 */
const ExampleRNR = () => {
  return (
    <ScrollView className="bg-background p-4">
      <H2 className="mb-6 text-center">React Native Reusables Example</H2>
      
      {/* Button Examples */}
      <View className="mb-6 space-y-4">
        <P className="mb-2">Button Variants:</P>
        <Button className="mb-2">Default Button</Button>
        <Button variant="destructive" className="mb-2">Destructive</Button>
        <Button variant="outline" className="mb-2">Outline</Button>
        <Button variant="secondary" className="mb-2">Secondary</Button>
        <Button variant="ghost" className="mb-2">Ghost</Button>
        <Button variant="link">Link</Button>
      </View>
      
      <View className="mb-6 space-y-4">
        <P className="mb-2">Button Sizes:</P>
        <Button size="sm" className="mb-2">Small Button</Button>
        <Button className="mb-2">Default Size</Button>
        <Button size="lg">Large Button</Button>
      </View>
      
      {/* Card Example */}
      <View className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card Description goes here</CardDescription>
          </CardHeader>
          <CardContent>
            <P>This is the main content of the card. You can put any content here.</P>
          </CardContent>
          <CardFooter>
            <Small>Last updated: Today</Small>
            <View className="flex-1" />
            <Button variant="outline" size="sm">Cancel</Button>
            <View className="w-2" />
            <Button size="sm">Save</Button>
          </CardFooter>
        </Card>
      </View>
    </ScrollView>
  );
};

export default ExampleRNR; 