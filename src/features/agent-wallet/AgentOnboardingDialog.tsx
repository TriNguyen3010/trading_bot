import { useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertCircle, Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AgentCreateResponse } from '@/types/api-helpers';
import { formatSpendingLimit, isAgentCapFull } from './agent-helpers';
import { useAgentSignFlow } from './useAgentSignFlow';

export interface AgentOnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill spending limit (e.g. user launches live $1000 → suggest $5000 limit). */
  suggestedLimit?: number | null;
  /** Called once Confirm succeeds — caller resumes the original action (e.g. launch live bot). */
  onSuccess: (agent: AgentCreateResponse) => void;
  /** Called when user clicks "Manage agents" from the cap-full state. Optional —
   *  callers that haven't wired it yet will simply not show the button for the cap-full path. */
  onManageAgents?: () => void;
}

export function AgentOnboardingDialog({
  open,
  onOpenChange,
  suggestedLimit,
  onSuccess,
  onManageAgents,
}: AgentOnboardingDialogProps) {
  const { state, run, reset } = useAgentSignFlow();
  const [limitInput, setLimitInput] = useState<string>(
    suggestedLimit != null ? String(suggestedLimit) : '',
  );

  // Keep the latest onSuccess in a ref so the success effect doesn't depend on
  // its identity. The parent (LaunchpadModal) passes an inline, non-memoized
  // callback, so a new reference on every parent re-render would otherwise
  // re-fire the success effect while state.stage is still 'success' — an
  // infinite onSuccess → relaunch loop (the dialog stays mounted with open
  // toggled, so the state never resets between fires).
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  // Fire onSuccess exactly once per success transition. `firedRef` guards
  // re-fires while the flow state stays 'success' (it only resets to idle on
  // the next open); it is cleared when the dialog (re)opens.
  const firedRef = useRef(false);
  useEffect(() => {
    if (state.stage === 'success' && !firedRef.current) {
      firedRef.current = true;
      onSuccessRef.current(state.agent);
    }
  }, [state]);

  // Reset to idle and re-seed input whenever the dialog (re)opens
  useEffect(() => {
    if (open) {
      reset();
      firedRef.current = false;
      setLimitInput(suggestedLimit != null ? String(suggestedLimit) : '');
    }
  }, [open, reset, suggestedLimit]);

  // Empty input → no limit (null). A non-empty value that is non-numeric or
  // negative is invalid: we block submit instead of coercing to null, because
  // coercing a negative to null would silently launch with NO spending cap.
  const limitNum = parseFloat(limitInput);
  const limitInvalid =
    limitInput.trim() !== '' && (!Number.isFinite(limitNum) || limitNum < 0);

  const handleGenerate = () => {
    if (limitInvalid) return;
    void run({
      spendingLimitUsd:
        Number.isFinite(limitNum) && limitNum >= 0 ? limitNum : null,
    });
  };

  const isBusy =
    state.stage === 'creating' ||
    state.stage === 'signing' ||
    state.stage === 'confirming';

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 w-[480px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border bg-surface-elevated shadow-lg data-[state=open]:animate-fade-in"
        >
          {/* ─── HEADER ─────────────────────────────────────────── */}
          <div className="flex items-center justify-between border-b border-border-subtle px-6 py-3">
            <DialogPrimitive.Title className="text-sm font-semibold text-fg">
              Connect Hyperliquid Agent
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-fg-muted transition-colors hover:border-border-strong hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </DialogPrimitive.Close>
          </div>

          {/* ─── BODY ────────────────────────────────────────────── */}
          <div className="px-7 py-6">
            {state.stage === 'idle' && (
              <IdleStep
                limitInput={limitInput}
                limitInvalid={limitInvalid}
                onLimitChange={setLimitInput}
                onGenerate={handleGenerate}
              />
            )}

            {isBusy && <BusyStep stage={state.stage} />}

            {state.stage === 'success' && (
              <SuccessStep
                agent={state.agent}
                onContinue={() => onOpenChange(false)}
              />
            )}

            {state.stage === 'error' &&
              (isAgentCapFull(new Error(state.message)) && onManageAgents ? (
                <CapFullStep onManageAgents={onManageAgents} />
              ) : (
                <ErrorStep
                  message={state.message}
                  onRetry={reset}
                  onCancel={() => onOpenChange(false)}
                />
              ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ─── Step sub-components ───────────────────────────────────────── */

function IdleStep({
  limitInput,
  limitInvalid,
  onLimitChange,
  onGenerate,
}: {
  limitInput: string;
  limitInvalid: boolean;
  onLimitChange: (v: string) => void;
  onGenerate: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="mb-1 text-xl font-bold text-fg">
          Why do you need an agent wallet?
        </h2>
        <p className="text-sm text-fg-secondary">
          An agent is a sub-key that lets the bot trade on your behalf on
          Hyperliquid.
        </p>
      </div>

      <ul className="space-y-2 text-sm text-fg-secondary">
        <li className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 text-brand">•</span>
          <span>
            <span className="font-medium text-fg">Sign once</span> — no need to
            approve every order
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 text-brand">•</span>
          <span>
            <span className="font-medium text-fg">Bot trades 24/7</span> — even
            while you are offline
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 text-brand">•</span>
          <span>
            <span className="font-medium text-fg">Spending cap</span> — caps
            your daily budget to limit risk
          </span>
        </li>
      </ul>

      <div className="space-y-1.5">
        <label
          htmlFor="spending-limit"
          className="block text-xs font-medium text-fg-muted"
        >
          Daily spending limit (USD){' '}
          <span className="font-normal text-fg-muted">(optional)</span>
        </label>
        <input
          id="spending-limit"
          type="number"
          min={0}
          step="any"
          placeholder="e.g. 5000"
          value={limitInput}
          onChange={(e) => onLimitChange(e.target.value)}
          aria-invalid={limitInvalid}
          className={cn(
            'w-full rounded-lg border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted',
            'focus:outline-none focus:ring-1',
            limitInvalid
              ? 'border-bearish focus:border-bearish focus:ring-bearish'
              : 'border-border focus:border-brand focus:ring-brand',
          )}
        />
        {limitInvalid ? (
          <p className="text-2xs text-bearish">
            Spending limit must be a number ≥ 0.
          </p>
        ) : (
          limitInput && (
            <p className="text-2xs text-fg-muted">
              Cap:{' '}
              {(() => {
                const parsed = parseFloat(limitInput);
                return formatSpendingLimit(
                  Number.isFinite(parsed) ? parsed : null,
                );
              })()}
              /day
            </p>
          )
        )}
      </div>

      <Button
        variant="primary"
        size="md"
        className="w-full"
        disabled={limitInvalid}
        onClick={onGenerate}
      >
        Generate &amp; Sign
      </Button>
    </div>
  );
}

function BusyStep({ stage }: { stage: 'creating' | 'signing' | 'confirming' }) {
  const message =
    stage === 'creating'
      ? 'Preparing signature...'
      : stage === 'signing'
        ? 'Please sign in the Coin98 wallet — a window will pop up'
        : 'Confirming on Hyperliquid...';

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <Loader2 className="h-8 w-8 animate-spin text-brand" />
      <p className="text-center text-sm text-fg-secondary">{message}</p>
    </div>
  );
}

function SuccessStep({
  agent,
  onContinue,
}: {
  agent: AgentCreateResponse;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-subtle text-brand">
        <Check className="h-6 w-6" />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-fg">Agent confirmed!</p>
        <p className="mt-1 font-mono text-xs text-fg-muted">
          {agent.agent_address}
        </p>
        {agent.spending_limit_usd != null && (
          <p className="mt-0.5 text-xs text-fg-secondary">
            Cap: {formatSpendingLimit(agent.spending_limit_usd)}/day
          </p>
        )}
      </div>
      <Button variant="primary" size="md" onClick={onContinue}>
        Continue
      </Button>
    </div>
  );
}

function ErrorStep({
  message,
  onRetry,
  onCancel,
}: {
  message: string;
  onRetry: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-bearish/40 bg-bearish-subtle p-4">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-bearish" />
        <p className="text-sm text-bearish">{message}</p>
      </div>
      <div className="flex gap-3">
        <Button
          variant="secondary"
          size="md"
          className="flex-1"
          onClick={onRetry}
        >
          Retry
        </Button>
        <Button variant="ghost" size="md" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function CapFullStep({ onManageAgents }: { onManageAgents: () => void }) {
  return (
    <div className="space-y-5">
      <div className="bg-warning-subtle flex items-start gap-3 rounded-lg border border-warning/40 p-4">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-fg">
            Hyperliquid agent limit reached
          </p>
          <p className="text-fg-secondary">
            Your wallet has reached the maximum number of agents on Hyperliquid.
            Revoke an old agent to free a slot, then create a new one.
          </p>
        </div>
      </div>
      <Button
        variant="primary"
        size="md"
        className="w-full"
        onClick={() => onManageAgents()}
      >
        Manage agents
      </Button>
    </div>
  );
}
