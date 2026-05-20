import { cn } from '@/lib/utils';
import { Check, Lock } from 'lucide-react';

interface Props {
  activeTab: 'setup' | 'configure';
  setupComplete: boolean;
  /** When true, render a one-shot ring animation on the Configure dot —
   * fired when setup just transitioned from incomplete → complete. */
  justUnlocked?: boolean;
}

/**
 * Compact wizard stepper shown beneath the drawer description:
 *
 *   ●  SETUP  ───  ○  CONFIGURE
 *
 * Width is intrinsic (inline-flex) so it never stretches to the drawer's
 * full width. Labels are paired tight with their dot rather than spread to
 * the edges, which avoided the "two icons floating at opposite sides of an
 * empty rail" look.
 */
export function DrawerProgressIndicator({
  activeTab,
  setupComplete,
  justUnlocked,
}: Props) {
  const setupState = setupComplete
    ? 'done'
    : activeTab === 'setup'
      ? 'active'
      : 'pending';
  const configState =
    setupComplete && activeTab === 'configure'
      ? 'active'
      : setupComplete
        ? 'pending'
        : 'locked';

  return (
    <div
      className="mt-2 inline-flex items-center gap-2 text-2xs font-medium uppercase tracking-wide"
      role="group"
      aria-label="Wizard progress"
    >
      <span className="inline-flex items-center gap-1.5">
        <Dot state={setupState} />
        <span
          className={cn(
            'transition-colors duration-200',
            setupState === 'done' ? 'text-bullish' : 'text-brand',
          )}
        >
          Setup
        </span>
      </span>

      <span
        className={cn(
          'h-px w-8 transition-colors duration-300',
          setupComplete ? 'bg-bullish' : 'bg-border',
        )}
        aria-hidden="true"
      />

      <span className="inline-flex items-center gap-1.5">
        <Dot state={configState} highlight={justUnlocked} />
        <span
          className={cn(
            'transition-colors duration-200',
            configState === 'active' && 'text-brand',
            configState === 'pending' && 'text-fg-secondary',
            configState === 'locked' && 'text-fg-muted',
          )}
        >
          Configure
        </span>
      </span>
    </div>
  );
}

type DotState = 'pending' | 'active' | 'done' | 'locked';

function Dot({ state, highlight }: { state: DotState; highlight?: boolean }) {
  return (
    <span
      className={cn(
        'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300',
        state === 'done' && 'border-bullish bg-bullish text-fg-inverse',
        state === 'active' &&
          'border-brand bg-transparent text-brand shadow-[0_0_6px_1px_var(--brand-primary)]',
        state === 'pending' && 'border-border bg-transparent text-fg-muted',
        state === 'locked' && 'border-border-subtle bg-surface text-fg-muted',
        highlight && 'ring-2 ring-brand/60 motion-safe:animate-pulse',
      )}
      aria-hidden="true"
    >
      {state === 'done' ? (
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
      ) : state === 'locked' ? (
        <Lock className="h-2 w-2" strokeWidth={2.5} />
      ) : null}
    </span>
  );
}
