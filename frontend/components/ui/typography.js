import React from 'react';
import { cn } from '../../lib/utils';
import { Text } from './text';

// Typography components with consistent styling
const H1 = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <Text
      className={cn('text-3xl font-bold tracking-tight text-foreground', className)}
      ref={ref}
      {...props}
    />
  );
});

const H2 = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <Text
      className={cn('text-2xl font-semibold tracking-tight text-foreground', className)}
      ref={ref}
      {...props}
    />
  );
});

const H3 = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <Text
      className={cn('text-xl font-semibold tracking-tight text-foreground', className)}
      ref={ref}
      {...props}
    />
  );
});

const H4 = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <Text
      className={cn('text-lg font-semibold tracking-tight text-foreground', className)}
      ref={ref}
      {...props}
    />
  );
});

const P = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <Text
      className={cn('text-base leading-7 text-foreground', className)}
      ref={ref}
      {...props}
    />
  );
});

const Small = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <Text
      className={cn('text-sm font-medium text-muted-foreground', className)}
      ref={ref}
      {...props}
    />
  );
});

const Subtle = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <Text
      className={cn('text-sm text-muted-foreground', className)}
      ref={ref}
      {...props}
    />
  );
});

H1.displayName = 'H1';
H2.displayName = 'H2';
H3.displayName = 'H3';
H4.displayName = 'H4';
P.displayName = 'P';
Small.displayName = 'Small';
Subtle.displayName = 'Subtle';

export { H1, H2, H3, H4, P, Small, Subtle }; 