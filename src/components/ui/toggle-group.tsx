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
        'inline-flex items-stretch gap-1 rounded-2xl bg-black/40 p-1',
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
              'flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              !isActive && 'text-fg-secondary hover:text-fg hover:bg-white/5',
              isActive &&
                tone === 'brand' &&
                'bg-brand text-black font-semibold shadow-[0_0_14px_rgba(240,185,11,0.35)]',
              isActive &&
                tone === 'bullish' &&
                'bg-bullish text-black font-semibold shadow-[0_0_14px_rgba(14,203,129,0.4)]',
              isActive &&
                tone === 'bearish' &&
                'bg-bearish text-white font-semibold shadow-[0_0_14px_rgba(246,70,93,0.4)]',
            )}
          >
            <div>{opt.label}</div>
            {opt.description ? (
              <div
                className={cn(
                  'mt-0.5 text-2xs font-normal',
                  isActive ? 'opacity-75' : 'opacity-70',
                )}
              >
                {opt.description}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
