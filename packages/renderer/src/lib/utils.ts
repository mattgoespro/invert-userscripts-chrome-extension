import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export { v4 as uuid } from 'uuid';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
