import React from 'react';
import { View } from 'react-native';
import { cn } from '../../lib/utils';
import { Text } from './text';

const Card = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <View
      ref={ref}
      className={cn(
        'rounded-lg border border-border bg-card p-4 shadow-sm',
        className
      )}
      {...props}
    />
  );
});

const CardHeader = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <View
      ref={ref}
      className={cn('flex flex-col space-y-1.5 p-2', className)}
      {...props}
    />
  );
});

const CardTitle = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <Text
      ref={ref}
      className={cn('text-xl font-semibold leading-tight text-card-foreground', className)}
      {...props}
    />
  );
});

const CardDescription = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <Text
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
});

const CardContent = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <View
      ref={ref}
      className={cn('p-2 pt-0', className)}
      {...props}
    />
  );
});

const CardFooter = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <View
      ref={ref}
      className={cn('flex flex-row items-center p-2 pt-0', className)}
      {...props}
    />
  );
});

Card.displayName = 'Card';
CardHeader.displayName = 'CardHeader';
CardTitle.displayName = 'CardTitle';
CardDescription.displayName = 'CardDescription';
CardContent.displayName = 'CardContent';
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }; 