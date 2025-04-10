import React, { createContext, useContext } from 'react';
import { Text as RNText } from 'react-native';
import { cn } from '../../lib/utils';

// Context to pass text styling down through nested components
export const TextClassContext = createContext(null);

// Base text component that supports Tailwind classes
const Text = React.forwardRef(
  ({ className, style, children, ...props }, ref) => {
    const textClass = useContext(TextClassContext);
    
    return (
      <RNText
        ref={ref}
        className={cn(textClass, className)}
        style={style}
        {...props}
      >
        {children}
      </RNText>
    );
  }
);

Text.displayName = 'Text';

export { Text }; 