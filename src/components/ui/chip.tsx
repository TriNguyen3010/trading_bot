import { type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChipProps {
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

/**
 * Toggleable chip used for Candlestick channel selection (Open / Close /
 * High / Low / Volume) and similar multi-select groups. Selected variant
 * uses brand-subtle background + brand border and a leading checkmark.
 */
export function Chip({
  selected,
  disabled,
  onClick,
  children,
  className,
  ariaLabel,
}: ChipProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={!!selected}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-all duration-fast',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        selected
          ? 'border-brand bg-brand-subtle text-fg'
          : 'border-border bg-surface text-fg-secondary hover:border-border-strong hover:text-fg',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      {selected ? <Check className="h-3 w-3 text-brand" /> : null}
      <span>{children}</span>
    </button>
  );
}
