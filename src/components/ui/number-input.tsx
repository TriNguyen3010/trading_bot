import * as React from 'react';
import { cn } from '@/lib/utils';

export interface NumberInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'type' | 'onChange' | 'value' | 'defaultValue'
  > {
  value?: number | null;
  defaultValue?: number;
  onValueChange?: (value: number | null) => void;
  /** Optional unit suffix shown to the right (e.g. "x", "%", "USDT"). */
  suffix?: React.ReactNode;
}

/**
 * Number input with tabular-nums alignment, optional suffix, and a
 * controlled-or-uncontrolled value -> number | null pipeline.
 *
 * Empty string maps to `null` so the parent can distinguish "not set" from "0".
 */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, onValueChange, suffix, ...props }, ref) => {
    const display =
      value === null || value === undefined || Number.isNaN(value)
        ? ''
        : String(value);

    return (
      <div className="relative flex items-center">
        <input
          ref={ref}
          type="number"
          inputMode="decimal"
          value={display}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') {
              onValueChange?.(null);
              return;
            }
            const num = Number(raw);
            if (Number.isFinite(num)) onValueChange?.(num);
          }}
          className={cn(
            'flex h-10 w-full rounded-md border border-border bg-input pl-3 text-sm text-fg font-tabular',
            suffix ? 'pr-12 text-right' : 'pr-3',
            'transition-colors duration-fast focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-subtle',
            'disabled:cursor-not-allowed disabled:opacity-60',
            'aria-[invalid=true]:border-danger',
            className,
          )}
          {...props}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 text-xs text-fg-muted">
            {suffix}
          </span>
        ) : null}
      </div>
    );
  },
);
NumberInput.displayName = 'NumberInput';
