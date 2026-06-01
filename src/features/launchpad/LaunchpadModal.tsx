import { useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  AlertTriangle,
  ChartLine,
  Loader2,
  Play,
  Rocket,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { formatBackendError } from '@/lib/format-error';
import { botApi } from '@/features/bot-monitoring/bot.api';
import { AgentOnboardingDialog } from '@/features/agent-wallet/AgentOnboardingDialog';
import {
  launchBot,
  type LaunchMode,
  AgentNotActiveError,
} from './launch-actions';

export interface LaunchpadBot {
  id: number;
  name: string;
  strategyName: string | null;
  pair: string;
  timeframe: string;
  mode: 'LIVE' | 'DRY-RUN' | 'PAUSED' | 'ERROR';
  errorMsg: string | null;
}

export interface LaunchpadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bot: LaunchpadBot | null;
  onBacktest: () => void;
  onLaunched: () => void;
}

export function LaunchpadModal({
  open,
  onOpenChange,
  bot,
  onBacktest,
  onLaunched,
}: LaunchpadModalProps) {
  const [busy, setBusy] = useState<LaunchMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setBusy(null);
      setError(null);
      setOnboardingOpen(false);
    }
  }, [open]);

  if (!bot) return null;

  const doLaunch = async (mode: LaunchMode) => {
    setBusy(mode);
    setError(null);
    try {
      await launchBot(bot.id, mode);
      toast.success(
        `Bot #${bot.id} "${bot.name}" đang khởi động (${mode === 'live' ? 'LIVE' : 'dry-run'})`,
      );
      onOpenChange(false);
      onLaunched();
    } catch (err) {
      if (err instanceof AgentNotActiveError) {
        setOnboardingOpen(true);
      } else {
        setError(formatBackendError(err));
      }
    } finally {
      setBusy(null);
    }
  };

  // Assumes /agent/active is read-your-write consistent after /agent/confirm —
  // if the backend serves `active` from a lagging replica, the retry would see
  // no active agent and re-open onboarding.
  const handleOnboardingSuccess = () => {
    setOnboardingOpen(false);
    void doLaunch('live');
  };

  const doSync = async () => {
    try {
      await botApi.sync(bot.id);
      toast.success('Đã đồng bộ trạng thái bot.');
      onOpenChange(false);
    } catch (err) {
      setError(formatBackendError(err));
    }
  };

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md data-[state=open]:animate-fade-in" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[920px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border bg-surface-elevated shadow-lg data-[state=open]:animate-fade-in">
            {/* Top bar */}
            <div className="flex items-center justify-between border-b border-border-subtle px-6 py-3">
              <div />
              <DialogPrimitive.Close
                className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-fg-muted hover:bg-surface-hover hover:text-fg"
                aria-label="Back to dashboard"
              >
                <X className="h-3.5 w-3.5" />
                Back to dashboard
              </DialogPrimitive.Close>
            </div>

            <div className="px-7 py-6">
              {error && (
                <div className="mb-5 rounded-lg border border-bearish/40 bg-bearish-subtle p-3 text-xs text-bearish">
                  {error}
                </div>
              )}

              {bot.mode === 'ERROR' && bot.errorMsg && (
                <div className="mb-6 flex items-center gap-3 rounded-2xl border border-bearish/40 bg-bearish-subtle px-5 py-3">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 text-bearish" />
                  <div className="flex-1 text-sm">
                    <span className="font-semibold text-bearish">
                      Last run failed.
                    </span>{' '}
                    <span className="text-fg-secondary">{bot.errorMsg}</span>
                  </div>
                  <Button variant="secondary" size="sm" onClick={doSync}>
                    Sync
                  </Button>
                </div>
              )}

              <div className="mb-7">
                <DialogPrimitive.Description className="mb-1.5 font-mono text-2xs uppercase tracking-wider text-fg-muted">
                  Bot #{bot.id} · {bot.pair} · {bot.timeframe}
                </DialogPrimitive.Description>
                <DialogPrimitive.Title className="text-2xl font-bold leading-tight text-fg">
                  Launch <span className="text-brand">{bot.name}</span>
                </DialogPrimitive.Title>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <ModeCard
                  icon={<ChartLine className="h-5 w-5" />}
                  title="Backtest"
                  desc="Test on past data · no risk"
                  cta="Run backtest"
                  onClick={() => {
                    onOpenChange(false);
                    onBacktest();
                  }}
                />
                <ModeCard
                  icon={<Play className="h-5 w-5" />}
                  title="Dry-run"
                  desc="Paper trade live market · sim wallet"
                  cta="Start dry-run"
                  tone="recommended"
                  busy={busy === 'dry-run'}
                  onClick={() => doLaunch('dry-run')}
                />
                <ModeCard
                  icon={<Rocket className="h-5 w-5" />}
                  title="Live"
                  desc="Real money on Hyperliquid · agent wallet required"
                  cta="Go Live"
                  tone="danger"
                  busy={busy === 'live'}
                  onClick={() => doLaunch('live')}
                />
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <AgentOnboardingDialog
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        onSuccess={handleOnboardingSuccess}
      />
    </>
  );
}

function ModeCard({
  icon,
  title,
  desc,
  cta,
  onClick,
  tone = 'neutral',
  busy = false,
  disabled = false,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta: string;
  onClick: () => void;
  tone?: 'neutral' | 'recommended' | 'danger';
  busy?: boolean;
  disabled?: boolean;
}) {
  const ring =
    tone === 'recommended'
      ? 'border-brand/50'
      : tone === 'danger'
        ? 'border-bearish/40'
        : 'border-border';
  return (
    <div
      className={`flex flex-col rounded-2xl border ${ring} bg-surface/40 p-5`}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-subtle text-brand">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      <p className="mt-1 flex-1 text-xs text-fg-secondary">{desc}</p>
      <Button
        variant={tone === 'danger' ? 'destructive' : 'primary'}
        size="sm"
        className="mt-4"
        disabled={busy || disabled}
        onClick={onClick}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {cta}
      </Button>
    </div>
  );
}
