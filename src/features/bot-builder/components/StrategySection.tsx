import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StrategySectionProps {
  title: string;
  /** Open by default. Pass `false` for "Advanced" to keep it collapsed
   * until the user expresses intent. */
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Vertical collapsible section used inside StrategyDrawerContent.
 * Replaces the Setup/Configure tab dichotomy with a single scrollable
 * form split into 3 named sections (Entry / Action / Advanced).
 *
 * Uses controlled local state — section open/close is purely a UI
 * preference and doesn't need to live in the store.
 */
export function StrategySection({
  title,
  defaultOpen = true,
  children,
}: StrategySectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-b border-border-subtle last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center justify-between gap-2 py-3 text-left',
          'transition-colors duration-fast hover:text-brand',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        )}
      >
        <span className="text-sm font-semibold uppercase tracking-wide text-fg">
          {title}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-fg-muted transition-transform duration-fast ease-out-quick',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      {open && <div className="space-y-5 pb-5 pt-1">{children}</div>}
    </section>
  );
}
