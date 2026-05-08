import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Native `<select>` styled with Tailwind. Sufficient for MVP — Pair search
 * (typeahead) is a separate component. Replace with Radix Select when we
 * need richer item rendering.
 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        'flex h-11 w-full appearance-none rounded-2xl bg-black/40 pl-4 pr-10 text-sm text-fg',
        'transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown
      aria-hidden
      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted"
    />
  </div>
));
Select.displayName = 'Select';
