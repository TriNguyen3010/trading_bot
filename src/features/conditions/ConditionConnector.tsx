import { cn } from '@/lib/utils';

export interface ConditionConnectorProps {
  operator: 'AND' | 'OR';
  onChange: (next: 'AND' | 'OR') => void;
}

/**
 * Side-by-side AND/OR toggle pill rendered between adjacent condition
 * rows. The active operator gets a brand-yellow background; the inactive
 * one is muted text on transparent. Clicking the inactive button flips
 * the row's `operator` field.
 *
 * Sized to be visually unobtrusive — should not dominate the row
 * spacing.
 */
export function ConditionConnector({ operator, onChange }: ConditionConnectorProps) {
  const handle = (next: 'AND' | 'OR') => {
    if (next === operator) return;
    onChange(next);
  };

  return (
    <div
      role="group"
      aria-label="Logical join"
      className="inline-flex items-center overflow-hidden rounded-full border border-border-subtle text-xs font-semibold"
    >
      {(['AND', 'OR'] as const).map((label) => {
        const active = operator === label;
        return (
          <button
            key={label}
            type="button"
            data-active={active}
            onClick={() => handle(label)}
            className={cn(
              'px-3 py-1 transition-colors',
              active
                ? 'bg-brand text-fg-inverse'
                : 'bg-transparent text-fg-muted hover:bg-canvas/40',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
