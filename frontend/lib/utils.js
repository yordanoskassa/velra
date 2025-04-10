import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges class names using clsx and tailwind-merge
 * @param {...string} inputs - Class names or conditional class objects
 * @returns {string} - Merged class string
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
} 