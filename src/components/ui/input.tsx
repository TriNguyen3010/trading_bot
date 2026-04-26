import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'flex h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-fg placeholder:text-fg-muted',
      'transition-colors duration-fast ease-out-quick',
      'focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-subtle',
      'disabled:cursor-not-allowed disabled:opacity-60',
      'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-danger/40',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';
