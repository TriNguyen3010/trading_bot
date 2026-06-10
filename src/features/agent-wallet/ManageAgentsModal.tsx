import { useCallback, useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertTriangle, Loader2, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatBackendError } from '@/lib/format-error';
import type {
  AgentInfoResponse,
  AgentSyncStatusResponse,
  BotWalletRotationResultItem,
  HyperliquidWalletResponse,
} from '@/types/api-helpers';
import { agentApi } from './agent.api';
import { botApi } from '@/features/bot-monitoring/bot.api';
import { useAgentRevokeFlow } from './useAgentRevokeFlow';

/** A merged view of an on-chain agent and its optional DB record. */
interface MergedAgent {
  /** On-chain data (always present — we start from the on-chain list). */
  onchain: HyperliquidWalletResponse;
  /** DB record — present only if this address is tracked in our DB. */
  db: AgentInfoResponse | null;
  /** Whether this agent is currently active in our DB. */
  isDbActive: boolean;
  /** Display source tag. */
  source: 'app-managed' | 'external';
}

export interface ManageAgentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful active-agent revoke so parent can open onboarding. */
  onRequestOnboarding: () => void;
  /** Called when rotateWallet returns error_count > 0, with the failing results. */
  onRotateErrors: (results: BotWalletRotationResultItem[]) => void;
}

type ConfirmState = null | {
  agent: MergedAgent;
  phase: 'confirm' | 'revoking';
};

export function ManageAgentsModal({
  open,
  onOpenChange,
  onRequestOnboarding,
  onRotateErrors,
}: ManageAgentsModalProps) {
  const [agents, setAgents] = useState<MergedAgent[]>([]);
  const [syncStatus, setSyncStatus] = useState<AgentSyncStatusResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [rotating, setRotating] = useState(false);
  const {
    state: revokeState,
    run: runRevoke,
    reset: resetRevoke,
  } = useAgentRevokeFlow();

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [onchain, dbList, sync] = await Promise.all([
        agentApi.hyperliquidWallets(),
        agentApi.list(),
        agentApi.syncStatus(),
      ]);
      setSyncStatus(sync);
      const merged: MergedAgent[] = onchain.map((w) => {
        const dbEntry =
          dbList.find(
            (d) => d.agent_address.toLowerCase() === w.address.toLowerCase(),
          ) ?? null;
        const isDbActive = dbEntry?.is_active === true;
        return {
          onchain: w,
          db: dbEntry,
          isDbActive,
          source: dbEntry ? 'app-managed' : 'external',
        };
      });
      setAgents(merged);
    } catch (err) {
      setLoadError(formatBackendError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadData();
      setConfirm(null);
      resetRevoke();
    }
  }, [open, loadData, resetRevoke]);

  // After successful revoke: refresh list. If revoked agent was active → trigger onboarding.
  // Reset the revoke stage back to idle here — otherwise it stays 'success' and
  // this effect re-fires the next time `confirm` becomes truthy (i.e. when the
  // user opens the confirm box for a DIFFERENT row), wrongly swallowing that
  // confirm + spuriously triggering onboarding. resetRevoke is a stable
  // useCallback, safe in deps.
  useEffect(() => {
    if (revokeState.stage === 'success' && confirm) {
      const wasActive = confirm.agent.isDbActive;
      setConfirm(null);
      resetRevoke();
      void loadData();
      if (wasActive) {
        onRequestOnboarding();
      }
    }
  }, [revokeState.stage, confirm, loadData, onRequestOnboarding, resetRevoke]);

  const handleRevokeConfirm = async () => {
    if (!confirm) return;
    const target =
      confirm.agent.source === 'app-managed' && confirm.agent.db
        ? { type: 'app-managed' as const, agentId: confirm.agent.db.id }
        : { type: 'external' as const, agentName: confirm.agent.onchain.name };
    setConfirm({ ...confirm, phase: 'revoking' });
    await runRevoke(target);
  };

  const handleRotate = async () => {
    setRotating(true);
    try {
      const result = await botApi.rotateWallet();
      toast.success(
        `Agent updated: ${result.updated_count}/${result.total_bots} bots, ${result.restarted_count} restarted.`,
      );
      if (result.error_count > 0) {
        onRotateErrors(result.results.filter((r) => r.error != null));
      }
    } catch (err) {
      toast.error(formatBackendError(err));
    } finally {
      setRotating(false);
    }
  };

  const hasActiveDbAgent = agents.some((a) => a.isDbActive);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 w-[640px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border bg-surface-elevated shadow-lg data-[state=open]:animate-fade-in"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-subtle px-6 py-3">
            <DialogPrimitive.Title className="text-sm font-semibold text-fg">
              Manage Agents
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </DialogPrimitive.Close>
          </div>

          <div className="px-6 py-5">
            {/* Sync mismatch banner */}
            {syncStatus?.mismatch_db_active_but_onchain_missing && (
              <div className="bg-warning-subtle mb-4 flex items-start gap-3 rounded-lg border border-warning/40 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div className="text-sm text-warning">
                  The active agent has been removed on Hyperliquid — create a
                  new agent and update your bots.
                  <button
                    className="ml-2 underline"
                    onClick={() => {
                      onOpenChange(false);
                      onRequestOnboarding();
                    }}
                  >
                    Create agent now
                  </button>
                </div>
              </div>
            )}

            {/* Load error */}
            {loadError && (
              <div className="mb-4 rounded-lg border border-bearish/40 bg-bearish-subtle p-3 text-xs text-bearish">
                {loadError}
              </div>
            )}

            {/* Loading spinner */}
            {loading && (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-brand" />
              </div>
            )}

            {/* Empty state */}
            {!loading && agents.length === 0 && !loadError && (
              <p className="py-8 text-center text-sm text-fg-muted">
                No agents on Hyperliquid. An agent is created when you Go Live.
              </p>
            )}

            {/* Agent table */}
            {!loading && agents.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle text-left text-xs font-medium text-fg-muted">
                      <th className="pb-2 pr-4">Name</th>
                      <th className="pb-2 pr-4">Address</th>
                      <th className="pb-2 pr-4">Expires</th>
                      <th className="pb-2 pr-4">Source</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent) => (
                      <AgentRow
                        key={agent.onchain.address}
                        agent={agent}
                        confirmState={
                          confirm?.agent.onchain.address ===
                          agent.onchain.address
                            ? confirm
                            : null
                        }
                        revokeFlowState={revokeState}
                        onRevokeClick={() =>
                          setConfirm({ agent, phase: 'confirm' })
                        }
                        onRevokeConfirm={handleRevokeConfirm}
                        onRevokeCancel={() => {
                          setConfirm(null);
                          resetRevoke();
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Rotate wallet button */}
            {hasActiveDbAgent && (
              <div className="mt-5 border-t border-border-subtle pt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={rotating}
                  onClick={() => void handleRotate()}
                >
                  {rotating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <RefreshCw className="h-3.5 w-3.5" />
                  Update agent for your bots
                </Button>
                <p className="mt-1.5 text-2xs text-fg-muted">
                  Applies the active agent to all of your bots.
                </p>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ─── Sub-component ─────────────────────────────────────────────── */

function AgentRow({
  agent,
  confirmState,
  revokeFlowState,
  onRevokeClick,
  onRevokeConfirm,
  onRevokeCancel,
}: {
  agent: MergedAgent;
  confirmState: ConfirmState;
  revokeFlowState: import('./useAgentRevokeFlow').AgentRevokeFlowState;
  onRevokeClick: () => void;
  onRevokeConfirm: () => void;
  onRevokeCancel: () => void;
}) {
  const addr = agent.onchain.address;
  const shortAddr = `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  const validUntil =
    agent.onchain.valid_until != null
      ? new Date(agent.onchain.valid_until).toLocaleDateString('vi-VN')
      : '–';

  const isConfirming = confirmState?.phase === 'confirm';
  const isRevoking =
    confirmState?.phase === 'revoking' ||
    revokeFlowState.stage === 'fetching-payload' ||
    revokeFlowState.stage === 'signing' ||
    revokeFlowState.stage === 'submitting';

  return (
    <>
      <tr className="border-b border-border-subtle/50">
        <td className="py-2.5 pr-4 font-medium text-fg">
          {agent.onchain.name || '(unnamed)'}
        </td>
        <td className="py-2.5 pr-4 font-mono text-xs text-fg-secondary">
          {shortAddr}
        </td>
        <td className="py-2.5 pr-4 text-xs text-fg-secondary">{validUntil}</td>
        <td className="py-2.5 pr-4">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium',
              agent.source === 'app-managed'
                ? 'bg-brand-subtle text-brand'
                : 'bg-surface-hover text-fg-muted',
            )}
          >
            {agent.source === 'app-managed' ? 'App' : 'External'}
          </span>
        </td>
        <td className="py-2.5">
          {!isConfirming && (
            <Button
              variant="ghost"
              size="sm"
              className="text-bearish hover:bg-bearish-subtle hover:text-bearish"
              onClick={onRevokeClick}
              aria-label="Revoke"
            >
              Revoke
            </Button>
          )}
        </td>
      </tr>
      {isConfirming && (
        <tr>
          <td colSpan={5} className="pb-3 pt-1">
            <div className="rounded-lg border border-bearish/30 bg-bearish-subtle p-3">
              {agent.isDbActive ? (
                <p className="mb-2.5 text-xs text-fg-secondary">
                  <span className="font-semibold text-fg">
                    This agent is in use by your bots.
                  </span>{' '}
                  Revoking signs 1 tx and removes the agent from Hyperliquid —
                  bots using this agent will fail/stop trading until you create
                  a new agent and update them.
                </p>
              ) : (
                <p className="mb-2.5 text-xs text-fg-secondary">
                  Revoking &quot;{agent.onchain.name || '(unnamed)'}&quot; signs
                  1 tx and removes the agent from Hyperliquid.
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isRevoking}
                  onClick={() => void onRevokeConfirm()}
                  aria-label="Confirm"
                >
                  {isRevoking && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Confirm revoke
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isRevoking}
                  onClick={onRevokeCancel}
                >
                  Cancel
                </Button>
              </div>
              {revokeFlowState.stage === 'error' && (
                <p className="mt-2 text-xs text-bearish">
                  {revokeFlowState.message}
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
