import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ToggleGroupOption<T extends string> {
  value: T;
  label: ReactNode;
  description?: string;
  /** Visual tone of the active state. Defaults to "brand". */
  tone?: 'brand' | 'bullish' | 'bearish';
}

export interface ToggleGroupProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: ToggleGroupOption<T>[];
  /** When true the group expands to fill its container. */
  fullWidth?: boolean;
  className?: string;
  ariaLabel?: string;
}

/**
 * Lightweight 2+ button single-select group. Used for Live/Dry-run,
 * Long/Short, Spot/Futures, etc. Active button uses tone-aware accent.
 */
export function ToggleGroup<T extends string>({
  value,
  onChange,
  options,
  fullWidth,
  className,
  ariaLabel,
}: ToggleGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-stretch gap-1 rounded-md border border-border bg-input p-1',
        fullWidth && 'w-full',
        className,
      )}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        const tone = opt.tone ?? 'brand';
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              !isActive && 'text-fg-secondary hover:text-fg',
              isActive &&
                tone === 'brand' &&
                'bg-brand text-fg-inverse',
              isActive &&
                tone === 'bullish' &&
                'bg-bullish text-fg',
              isActive &&
                tone === 'bearish' &&
                'bg-bearish text-fg',
            )}
          >
            <div>{opt.label}</div>
            {opt.description ? (
              <div className="mt-0.5 text-2xs font-normal opacity-80">
                {opt.description}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
