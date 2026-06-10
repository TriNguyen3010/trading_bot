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
import { cn } from '@/lib/utils';
import { formatBackendError } from '@/lib/format-error';
import { botApi } from '@/features/bot-monitoring/bot.api';
import { backtestApi } from '@/features/backtest/backtest.api';
import {
  buildBacktestRequest,
  quoteCurrencyFromPair,
} from '@/features/backtest/backtest-helpers';
import { AgentOnboardingDialog } from '@/features/agent-wallet/AgentOnboardingDialog';
import { ManageAgentsModal } from '@/features/agent-wallet/ManageAgentsModal';
import { useActiveAgent } from '@/features/agent-wallet/useActiveAgent';
import {
  BacktestPanel,
  DryRunPanel,
  LivePanel,
  shortAddress,
} from './LaunchpadPanels';
import {
  launchBot,
  type LaunchMode,
  AgentNotActiveError,
} from './launch-actions';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/** A launchable mode, plus the backtest pseudo-mode (delegated to BacktestDialog). */
export type LaunchpadMode = 'backtest' | LaunchMode;

export interface LaunchpadBot {
  id: number;
  name: string;
  strategyName: string | null;
  pair: string;
  timeframe: string;
  mode: 'LIVE' | 'DRY-RUN' | 'PAUSED' | 'ERROR';
  errorMsg: string | null;
  /** Stake per trade from bot config — null when the config didn't load. */
  stakeAmount: number | null;
}

export interface LaunchpadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bot: LaunchpadBot | null;
  /** The launchpad already POSTed /backtest/start — the parent should open
   * BacktestDialog straight on its running phase with this id. */
  onBacktestStarted: (backtestId: number) => void;
  onLaunched: () => void;
}

const STATUS_META: Record<
  LaunchpadBot['mode'],
  { label: string; dot: string }
> = {
  LIVE: { label: 'Live', dot: 'bg-bullish' },
  'DRY-RUN': { label: 'Dry-run', dot: 'bg-brand' },
  PAUSED: { label: 'Paused', dot: 'bg-fg-muted' },
  ERROR: { label: 'Error', dot: 'bg-bearish' },
};

const FACT_CHIP =
  'inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-2.5 py-1 text-2xs text-fg-secondary';

export function LaunchpadModal({
  open,
  onOpenChange,
  bot,
  onBacktestStarted,
  onLaunched,
}: LaunchpadModalProps) {
  const [mode, setMode] = useState<LaunchpadMode>('dry-run');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [manageAgentsOpen, setManageAgentsOpen] = useState(false);
  // Backtest setup (defaults mirror BacktestDialog)
  const [days, setDays] = useState(7);
  const [stake, setStake] = useState('100');
  const [wallet, setWallet] = useState('1000');
  // Dry-run / live settings
  const telegramTokenDefault = import.meta.env.VITE_TELEGRAM_BOT_TOKEN ?? '';
  const [tgToken, setTgToken] = useState(telegramTokenDefault);
  const [tgChatId, setTgChatId] = useState('');
  const [apiWalletAddress, setApiWalletAddress] = useState('');
  const [ack, setAck] = useState(false);

  const {
    agent,
    loading: agentLoading,
    refresh: refreshAgent,
  } = useActiveAgent({ enabled: open && bot != null });

  useEffect(() => {
    if (open) {
      setMode('dry-run');
      setBusy(false);
      setError(null);
      setOnboardingOpen(false);
      setManageAgentsOpen(false);
      setDays(7);
      setStake('100');
      setWallet('1000');
      setTgToken(telegramTokenDefault);
      setTgChatId('');
      setApiWalletAddress('');
      setAck(false);
    }
  }, [open, telegramTokenDefault]);

  if (!bot) return null;

  const currency = quoteCurrencyFromPair(bot.pair);
  const status = STATUS_META[bot.mode];

  const selectMode = (m: LaunchpadMode) => {
    if (busy) return;
    setMode(m);
    setAck(false); // re-confirm risk every time Live is re-entered
    setError(null);
  };

  /** Both-or-none Telegram pair → arg for launchBot, or 'invalid'. */
  const telegramArgOrInvalid = ():
    | { token: string; chat_id: string }
    | undefined
    | 'invalid' => {
    const token = tgToken.trim();
    const chat_id = tgChatId.trim();
    if (Boolean(token) !== Boolean(chat_id)) return 'invalid';
    return token && chat_id ? { token, chat_id } : undefined;
  };

  const doLaunch = async (m: LaunchMode) => {
    if (busy) return;
    const telegramArg = telegramArgOrInvalid();
    if (telegramArg === 'invalid') {
      setError('Enter both Telegram token and chat ID, or leave both empty.');
      return;
    }
    let expectedAgentAddress: string | undefined;
    if (m === 'live') {
      const address = apiWalletAddress.trim();
      if (address && !ADDRESS_RE.test(address)) {
        setError('API wallet address must be a valid 0x address.');
        return;
      }
      expectedAgentAddress = address || undefined;
    }
    setBusy(true);
    setError(null);
    try {
      const launchOpts = expectedAgentAddress
        ? { expectedAgentAddress }
        : undefined;
      if (telegramArg || launchOpts) {
        await launchBot(bot.id, m, telegramArg, launchOpts);
      } else {
        await launchBot(bot.id, m);
      }
      toast.success(
        `Bot #${bot.id} "${bot.name}" is starting (${m === 'live' ? 'LIVE' : 'dry-run'})`,
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
      setBusy(false);
    }
  };

  const runBacktest = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await backtestApi.start(
        buildBacktestRequest(bot, { days, stake, wallet }),
      );
      onOpenChange(false);
      onBacktestStarted(res.backtest_id);
    } catch (err) {
      setError(formatBackendError(err));
    } finally {
      setBusy(false);
    }
  };

  // Assumes /agent/active is read-your-write consistent after /agent/confirm —
  // if the backend serves `active` from a lagging replica, the retry would see
  // no active agent and re-open onboarding.
  const handleOnboardingSuccess = () => {
    setOnboardingOpen(false);
    refreshAgent();
    void doLaunch('live');
  };

  const doSync = async () => {
    try {
      await botApi.sync(bot.id);
      toast.success('Bot state synced.');
      onOpenChange(false);
    } catch (err) {
      setError(formatBackendError(err));
    }
  };

  const action = {
    backtest: {
      label: 'Run backtest',
      destructive: false,
      disabled: !(Number(stake) > 0) || !(Number(wallet) > 0),
      onClick: () => void runBacktest(),
      note: <>Free · no funds touched · results in ~1–2 min</>,
    },
    'dry-run': {
      label: 'Start dry-run',
      destructive: false,
      disabled: false,
      onClick: () => void doLaunch('dry-run'),
      note: <>No real funds · stop anytime from the dashboard</>,
    },
    live: {
      label: 'Go Live',
      destructive: true,
      disabled: !ack,
      onClick: () => void doLaunch('live'),
      note: agent ? (
        <>
          Real orders via agent{' '}
          <span className="font-mono">{shortAddress(agent.agent_address)}</span>{' '}
          · stop anytime
        </>
      ) : (
        <>Agent onboarding will open first, then the bot goes live</>
      ),
    },
  }[mode];

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

              <div className="mb-4">
                <DialogPrimitive.Description className="mb-1.5 font-mono text-2xs uppercase tracking-wider text-fg-muted">
                  Bot #{bot.id} · {bot.pair} · {bot.timeframe}
                </DialogPrimitive.Description>
                <DialogPrimitive.Title className="text-2xl font-bold leading-tight text-fg">
                  Launch <span className="text-brand">{bot.name}</span>
                </DialogPrimitive.Title>
              </div>

              {/* Concrete bot identity, always visible */}
              <div className="mb-6 flex flex-wrap gap-2">
                <span className={FACT_CHIP}>
                  <span
                    className={cn('h-1.5 w-1.5 rounded-full', status.dot)}
                  />
                  <b className="font-semibold text-fg">{status.label}</b>
                </span>
                {bot.strategyName && (
                  <span className={FACT_CHIP}>
                    Strategy{' '}
                    <b className="font-semibold text-fg">{bot.strategyName}</b>
                  </span>
                )}
                {bot.stakeAmount != null && (
                  <span className={FACT_CHIP}>
                    Stake{' '}
                    <b className="font-semibold text-fg">
                      {bot.stakeAmount} {currency} / trade
                    </b>
                  </span>
                )}
              </div>

              {/* Step 1: pick a mode */}
              <div
                role="radiogroup"
                aria-label="Launch mode"
                className="grid grid-cols-3 gap-3"
              >
                <ModeCard
                  icon={<ChartLine className="h-5 w-5" />}
                  title="Backtest"
                  desc="Replay on past data — no risk."
                  selected={mode === 'backtest'}
                  disabled={busy}
                  onSelect={() => selectMode('backtest')}
                />
                <ModeCard
                  icon={<Play className="h-5 w-5" />}
                  title="Dry-run"
                  desc="Paper-trade the live market with a sim wallet."
                  badge="Recommended"
                  selected={mode === 'dry-run'}
                  disabled={busy}
                  onSelect={() => selectMode('dry-run')}
                />
                <ModeCard
                  icon={<Rocket className="h-5 w-5" />}
                  title="Live"
                  desc="Real USDC on Hyperliquid via agent wallet."
                  badge="Real funds"
                  badgeTone="bearish"
                  danger
                  selected={mode === 'live'}
                  disabled={busy}
                  onSelect={() => selectMode('live')}
                />
              </div>

              {/* Step 2: contextual detail + the one action */}
              <div
                className={cn(
                  'mt-4 overflow-hidden rounded-2xl border transition-colors',
                  mode === 'live'
                    ? 'border-bearish/40'
                    : 'border-border-subtle',
                )}
              >
                <div className="bg-canvas/40 p-5">
                  {mode === 'backtest' && (
                    <BacktestPanel
                      pair={bot.pair}
                      timeframe={bot.timeframe}
                      currency={currency}
                      strategyMissing={!bot.strategyName}
                      days={days}
                      stake={stake}
                      wallet={wallet}
                      onDaysChange={setDays}
                      onStakeChange={setStake}
                      onWalletChange={setWallet}
                    />
                  )}
                  {mode === 'dry-run' && (
                    <DryRunPanel
                      token={tgToken}
                      chatId={tgChatId}
                      onTokenChange={setTgToken}
                      onChatIdChange={setTgChatId}
                    />
                  )}
                  {mode === 'live' && (
                    <LivePanel
                      agent={agent}
                      agentLoading={agentLoading}
                      stakeAmount={bot.stakeAmount}
                      currency={currency}
                      apiWalletAddress={apiWalletAddress}
                      onApiWalletAddressChange={setApiWalletAddress}
                      token={tgToken}
                      chatId={tgChatId}
                      onTokenChange={setTgToken}
                      onChatIdChange={setTgChatId}
                      ack={ack}
                      onAckChange={setAck}
                      onManageAgents={() => setManageAgentsOpen(true)}
                    />
                  )}
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-border-subtle bg-surface/40 px-5 py-3.5">
                  <p className="text-xs text-fg-muted">{action.note}</p>
                  <Button
                    variant={action.destructive ? 'destructive' : 'primary'}
                    size="md"
                    disabled={busy || action.disabled}
                    onClick={action.onClick}
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {action.label}
                  </Button>
                </div>
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <AgentOnboardingDialog
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        onSuccess={handleOnboardingSuccess}
        onManageAgents={() => {
          setOnboardingOpen(false);
          setManageAgentsOpen(true);
        }}
      />
      <ManageAgentsModal
        open={manageAgentsOpen}
        onOpenChange={setManageAgentsOpen}
        onRequestOnboarding={() => {
          setManageAgentsOpen(false);
          setOnboardingOpen(true);
        }}
        onRotateErrors={(results) => {
          results.forEach((r) =>
            toast.warning(
              `Bot "${r.bot_name}" agent rotate failed: ${r.error ?? 'unknown'}`,
            ),
          );
        }}
      />
    </>
  );
}

/** Selectable mode card — a radio, not a button-with-CTA. */
function ModeCard({
  icon,
  title,
  desc,
  badge,
  badgeTone = 'brand',
  danger = false,
  selected,
  disabled = false,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge?: string;
  badgeTone?: 'brand' | 'bearish';
  danger?: boolean;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      // aria-label keeps the accessible name to just the title — without it,
      // the Dry-run card's name would contain "live market" and collide with
      // the Live card in role queries.
      aria-label={title}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'relative flex flex-col rounded-2xl border bg-surface/40 p-5 text-left transition-all duration-200',
        !disabled && 'hover:-translate-y-px hover:bg-surface-hover/60',
        selected
          ? danger
            ? 'border-bearish shadow-[0_0_0_1px_rgb(var(--color-bearish-rgb)),0_0_24px_rgba(246,70,93,0.12)]'
            : 'border-brand shadow-[0_0_0_1px_rgb(var(--brand-primary-rgb)),0_0_24px_rgba(240,185,11,0.12)]'
          : 'border-border',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      {badge && (
        <span
          className={cn(
            'absolute right-3 top-3 rounded-full px-2 py-0.5 font-mono text-2xs uppercase tracking-wider',
            badgeTone === 'bearish'
              ? 'bg-bearish-subtle text-bearish'
              : 'bg-brand-subtle text-brand',
          )}
        >
          {badge}
        </span>
      )}
      <div className="mb-2.5 flex items-center gap-2.5">
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full',
            danger
              ? 'bg-bearish-subtle text-bearish'
              : 'bg-brand-subtle text-brand',
          )}
        >
          {icon}
        </span>
        <h3 className="text-base font-semibold text-fg">{title}</h3>
      </div>
      <p className="pr-5 text-xs text-fg-secondary">{desc}</p>
      <span
        aria-hidden
        className={cn(
          'absolute bottom-3.5 right-3.5 h-4 w-4 rounded-full transition-all',
          selected
            ? danger
              ? 'border-[5px] border-bearish'
              : 'border-[5px] border-brand'
            : 'border-2 border-border-strong',
        )}
      />
    </button>
  );
}
