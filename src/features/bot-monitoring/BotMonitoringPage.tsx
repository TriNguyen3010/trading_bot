import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { DotGridSpotlight } from '@/features/fx/DotGridSpotlight';
import { formatBackendError } from '@/lib/format-error';
import {
  BacktestDialog,
  type BacktestBot,
} from '@/features/backtest/BacktestDialog';
import {
  botApi as lifecycleApi,
  type BacktestHistoryItem,
  type BotAuditLogOut,
} from './bot.api';
import type { BotPerformance } from './bot-performance';
import { useBotStatusPoll } from './useBotStatusPoll';
import { ConfirmActionDialog } from './ConfirmActionDialog';
import {
  deriveMode,
  derivePair,
  deriveTimeframe,
  type ConfigShape,
} from './bot-list.helpers';
import { derivePresentationalState } from './presentational-state';
import { extractStrategyBlock } from './backtest-results';
import { DetailHero } from './detail/DetailHero';
import { PerformancePanel } from './detail/PerformancePanel';
import { RecentTradesPanel } from './detail/RecentTradesPanel';
import { StatusPanel } from './detail/StatusPanel';
import { ConfigPanel } from './detail/ConfigPanel';
import { ActivityLogPanel } from './detail/ActivityLogPanel';

interface LastBacktestSummary {
  count: number;
  latestStatus: string | null;
  winRate: number | null;
  netAbs: number | null;
  strategyName: string | null;
}

export function BotMonitoringPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // The dashboard card passes created_at + name via navigation state (no
  // per-bot endpoint returns created_at; see spec §6). Falls back gracefully
  // when the page is opened directly by URL.
  const navState = (location.state ?? null) as {
    createdAt?: string | null;
    name?: string | null;
  } | null;
  const botIdNum = id ? Number(id) : null;
  const safeBotId =
    botIdNum != null && !Number.isNaN(botIdNum) ? botIdNum : null;

  const {
    status: liveStatus,
    setStatus: setLiveStatus,
    loading: statusLoading,
  } = useBotStatusPoll(safeBotId);

  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [perf, setPerf] = useState<BotPerformance | null>(null);
  const [backtest, setBacktest] = useState<BacktestHistoryItem | null>(null);
  const [history, setHistory] = useState<LastBacktestSummary>({
    count: 0,
    latestStatus: null,
    winRate: null,
    netAbs: null,
    strategyName: null,
  });
  const [auditLogs, setAuditLogs] = useState<BotAuditLogOut[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [backtestOpen, setBacktestOpen] = useState(false);

  // Load config + performance + latest backtest + audit logs (parallel,
  // best-effort). The full backtest results blob is fetched only when the
  // latest run completed.
  useEffect(() => {
    if (safeBotId == null) return;
    let cancelled = false;
    setLoadError(null);
    void (async () => {
      try {
        const [cfgR, perfR, histR, auditR] = await Promise.allSettled([
          lifecycleApi.getConfig(safeBotId),
          lifecycleApi.getPerformance(safeBotId),
          lifecycleApi.getBacktestHistory(safeBotId, 1),
          lifecycleApi.getAuditLogs(safeBotId, 20),
        ]);
        if (cancelled) return;

        if (cfgR.status === 'fulfilled')
          setConfig((cfgR.value.config ?? {}) as Record<string, unknown>);
        else setLoadError(formatBackendError(cfgR.reason));
        if (perfR.status === 'fulfilled') setPerf(perfR.value);
        if (auditR.status === 'fulfilled') setAuditLogs(auditR.value ?? []);

        if (histR.status === 'fulfilled') {
          const items = histR.value.items ?? [];
          const it = items[0];
          setHistory({
            count: histR.value.total ?? items.length,
            latestStatus: it?.status ?? null,
            winRate: it?.win_rate ?? null,
            netAbs: it?.total_profit ?? null,
            strategyName: it?.strategy_name ?? null,
          });
          if (it && it.status === 'completed') {
            try {
              const full = await lifecycleApi.getBacktest(it.id);
              if (!cancelled) setBacktest(full);
            } catch {
              /* full results optional — panel falls back to empty */
            }
          }
        }
      } catch (err) {
        if (!cancelled) setLoadError(formatBackendError(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [safeBotId]);

  // Start must route through the Launchpad mode-gate (never lifecycleApi.start
  // directly) — a PAUSED ex-Live bot would otherwise restart in LIVE.
  const handleStart = useCallback(() => {
    if (safeBotId == null) return;
    navigate('/dashboard', { state: { launchpadBotId: safeBotId } });
  }, [navigate, safeBotId]);

  const doStop = useCallback(async () => {
    if (safeBotId == null) return;
    setPending(true);
    try {
      const next = await lifecycleApi.stop(safeBotId);
      setLiveStatus(next);
      toast.success(`Stopping bot #${safeBotId}`);
    } catch (err) {
      toast.error(formatBackendError(err));
    } finally {
      setPending(false);
      setConfirmStop(false);
    }
  }, [safeBotId, setLiveStatus]);

  const doSync = useCallback(async () => {
    if (safeBotId == null) return;
    setPending(true);
    try {
      const next = await lifecycleApi.sync(safeBotId);
      setLiveStatus(next);
      toast.message('Re-synced bot status');
    } catch (err) {
      toast.error(formatBackendError(err));
    } finally {
      setPending(false);
    }
  }, [safeBotId, setLiveStatus]);

  const doRestart = useCallback(async () => {
    if (safeBotId == null) return;
    setPending(true);
    try {
      const next = await lifecycleApi.restart(safeBotId);
      setLiveStatus(next);
      toast.success(`Restarting bot #${safeBotId}`);
    } catch (err) {
      toast.error(formatBackendError(err));
    } finally {
      setPending(false);
    }
  }, [safeBotId, setLiveStatus]);

  const cfgShape = config as ConfigShape | null;
  const mode = deriveMode(
    {
      status: liveStatus?.status ?? 'stopped',
      error_message: liveStatus?.error_message ?? null,
    },
    cfgShape,
  );
  const state = derivePresentationalState(mode, {
    historyCount: history.count,
    latestStatus: history.latestStatus,
  });
  const running = mode === 'LIVE' || mode === 'DRY-RUN';
  const exchangeName =
    (config?.exchange as { name?: string } | undefined)?.name ??
    (config?.exchange_name as string | undefined) ??
    null;
  const tradeBlock = backtest ? extractStrategyBlock(backtest) : null;

  const notLoaded =
    config === null && liveStatus === null && !loadError && statusLoading;
  if (notLoaded) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-fg-muted">
        <span className="text-sm">Loading bot…</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-screen flex-col bg-black text-fg">
      <div
        className="pointer-events-none fixed -top-20 left-1/2 z-0 h-[420px] w-[700px] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(240,185,11,0.12), transparent 70%)',
        }}
        aria-hidden
      />
      <DotGridSpotlight
        className="pointer-events-none fixed z-0"
        style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        dimmed={false}
      />

      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-8 py-7">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex w-fit items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </button>

          {loadError && (
            <div
              role="alert"
              className="rounded-lg border border-bearish/40 bg-bearish-subtle px-4 py-3 text-xs text-bearish"
            >
              <strong className="mr-2">Couldn&apos;t load bot details:</strong>
              {loadError}
            </div>
          )}

          <DetailHero
            bot={{
              name:
                liveStatus?.bot_name ??
                navState?.name ??
                (config?.bot_name as string | undefined) ??
                `Bot #${safeBotId ?? ''}`,
              mode,
              state,
              pair: derivePair(cfgShape),
              timeframe: deriveTimeframe(cfgShape),
              exchange: exchangeName,
              tradingMode: (config?.trading_mode as string | undefined) ?? null,
              createdAt: navState?.createdAt ?? null,
              balance: running ? (perf?.balance ?? null) : null,
              openTrades: running ? (perf?.openTrades ?? null) : null,
              maxOpenTrades:
                (config?.max_open_trades as number | undefined) ?? null,
              lastBacktest:
                history.count > 0
                  ? { winRate: history.winRate, netAbs: history.netAbs }
                  : null,
            }}
            pending={pending}
            onSync={doSync}
            onRestart={doRestart}
            onStop={() => setConfirmStop(true)}
            onStart={handleStart}
          />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-5">
              <PerformancePanel
                item={backtest}
                onRunBacktest={() => setBacktestOpen(true)}
              />
              <RecentTradesPanel trades={tradeBlock?.trades ?? []} />
            </div>
            <div className="flex flex-col gap-5">
              <StatusPanel status={liveStatus} />
              <ConfigPanel config={config} />
              <ActivityLogPanel logs={auditLogs} />
            </div>
          </div>
        </div>
      </main>

      <ConfirmActionDialog
        open={confirmStop}
        onOpenChange={setConfirmStop}
        title="Stop this bot?"
        body="The bot will stop placing orders immediately. Open positions are NOT closed automatically — close them manually or with a take-profit/stop-loss already set."
        confirmLabel="Stop"
        variant="destructive"
        busy={pending}
        onConfirm={doStop}
      />

      <BacktestDialog
        open={backtestOpen}
        onOpenChange={setBacktestOpen}
        bot={
          safeBotId == null
            ? null
            : ({
                id: safeBotId,
                name:
                  liveStatus?.bot_name ??
                  (config?.bot_name as string | undefined) ??
                  `Bot #${safeBotId}`,
                strategyName: history.strategyName,
                pair: derivePair(cfgShape),
                timeframe: deriveTimeframe(cfgShape),
              } satisfies BacktestBot)
        }
      />
    </div>
  );
}
