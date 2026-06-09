import { cn } from '@/lib/utils';
import { FILTER_CHIPS, type FilterCategory } from './bot-filter';

interface StatusFilterChipsProps {
  counts: Record<FilterCategory, number>;
  active: FilterCategory;
  onChange: (cat: FilterCategory) => void;
}

export function StatusFilterChips({
  counts,
  active,
  onChange,
}: StatusFilterChipsProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      role="group"
      aria-label="Filter bots by status"
    >
      {FILTER_CHIPS.map((chip) => {
        const count = counts[chip.key];
        const isActive = active === chip.key;
        const disabled = chip.key !== 'all' && count === 0;
        return (
          <button
            key={chip.key}
            type="button"
            disabled={disabled}
            aria-pressed={isActive}
            onClick={() => onChange(chip.key)}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition',
              isActive
                ? 'border-brand bg-brand-subtle text-brand-hover'
                : disabled
                  ? // Disabled: resting surface look, dimmed, NO hover utilities
                    // (so the button doesn't light up on hover despite being disabled).
                    'cursor-not-allowed border-border bg-surface text-fg-secondary opacity-40'
                  : 'border-border bg-surface text-fg-secondary hover:border-border-strong hover:bg-surface-hover hover:text-fg',
            )}
          >
            {chip.label}
            <span
              className={cn(
                'font-mono text-xs tabular-nums',
                isActive ? 'text-brand-hover/70' : 'text-fg-muted',
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
