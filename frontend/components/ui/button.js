import React from 'react';
import { Pressable } from 'react-native';
import { cn } from '../../lib/utils';
import { Text, TextClassContext } from './text';

/**
 * Button component with various variants and sizes
 */
const Button = React.forwardRef(
  ({ className, variant = "default", size = "default", children, textClass, ...props }, ref) => {
    // Base button styles
    const buttonStyles = cn(
      // Common button styles
      'flex flex-row items-center justify-center rounded-none',
      // Variant styles 
      variant === 'default' && 'bg-primary active:opacity-90',
      variant === 'destructive' && 'bg-destructive active:opacity-90',
      variant === 'outline' && 'border border-input bg-transparent active:bg-accent',
      variant === 'secondary' && 'bg-secondary active:opacity-80',
      variant === 'ghost' && 'bg-transparent active:bg-accent',
      variant === 'link' && 'bg-transparent p-0',
      // Size styles
      size === 'default' && 'py-3 px-5',
      size === 'sm' && 'py-2 px-3 rounded-sm',
      size === 'lg' && 'py-4 px-8',
      size === 'icon' && 'h-10 w-10',
      // Additional custom classes
      className,
      // Disabled state
      props.disabled && 'opacity-50'
    );

    // Text styles based on variant
    const textStyles = cn(
      'text-base font-medium',
      // Text color based on variant
      variant === 'default' && 'text-primary-foreground',
      variant === 'destructive' && 'text-destructive-foreground',
      variant === 'outline' && 'text-foreground',
      variant === 'secondary' && 'text-secondary-foreground',
      variant === 'ghost' && 'text-foreground',
      variant === 'link' && 'text-primary underline',
      // Size adjustments
      size === 'sm' && 'text-sm',
      size === 'lg' && 'text-lg',
      // Additional custom text classes
      textClass
    );

    return (
      <TextClassContext.Provider value={textStyles}>
        <Pressable
          ref={ref}
          className={buttonStyles}
          {...props}
        >
          {typeof children === 'string' ? (
            <Text>{children}</Text>
          ) : (
            children
          )}
        </Pressable>
      </TextClassContext.Provider>
    );
  }
);

Button.displayName = 'Button';

export { Button }; 