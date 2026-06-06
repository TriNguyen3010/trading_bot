import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DotGridSpotlight } from '@/features/fx/DotGridSpotlight';
import { ImportDialog } from '@/features/export-import/ImportDialog';
import { useRequireWallet } from '@/features/wallet-auth/RequireWalletProvider';
import { botApi, type BotStatusOut } from '@/features/bot-monitoring/bot.api';
import type { BotPerformance } from '@/features/bot-monitoring/bot-performance';
import {
  deriveMode,
  zipBotsAndConfigs,
  type ConfigShape,
  type DashboardBot,
} from '@/features/bot-monitoring/bot-list.helpers';
import { derivePresentationalState } from '@/features/bot-monitoring/presentational-state';
import { computePortfolioStats } from '@/features/bot-monitoring/portfolio-stats';
import { BotCard, type BotCardData } from '@/features/bot-monitoring/BotCard';
import { DashboardEmptyState } from '@/features/bot-monitoring/DashboardEmptyState';
import { ConfirmActionDialog } from '@/features/bot-monitoring/ConfirmActionDialog';
import { isTerminal } from '@/features/bot-monitoring/lifecycle-actions';
import {
  BacktestDialog,
  type BacktestBot,
} from '@/features/backtest/BacktestDialog';
import {
  LaunchpadModal,
  type LaunchpadBot,
} from '@/features/launchpad/LaunchpadModal';
import { formatBackendError } from '@/lib/format-error';
import { AppHeader } from './AppHeader';

/** Poll cadence + safety cap for status polling after a lifecycle action. */
const POLL_INTERVAL_MS = 1_500;
const POLL_MAX_TRIES = 40;

/** Per-bot summary of its most recent backtest history item (top-level fields
 * only — the `results` blob is intentionally NOT read here). */
interface LastBacktest {
  historyCount: number;
  latestStatus: string | null;
  winRate: number | null;
  trades: number | null;
  netAbs: number | null;
}

/** Narrow a real bot to the shape LaunchpadModal needs. */
function toLaunchpadBot(b: DashboardBot): LaunchpadBot {
  return {
    id: b.id,
    name: b.name,
    strategyName: b.strategyName,
    pair: b.pair,
    timeframe: b.timeframe,
    mode: b.mode as LaunchpadBot['mode'],
    errorMsg: b.errorMsg,
  };
}

export function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const consumedLaunchRef = useRef(false);
  const { requireWalletThen } = useRequireWallet();
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  // `realBots === null` → not yet loaded; `[]` → loaded, user has no bots.
  const [realBots, setRealBots] = useState<DashboardBot[] | null>(null);
  const [perfById, setPerfById] = useState<Map<number, BotPerformance>>(
    () => new Map(),
  );
  const [btById, setBtById] = useState<Map<number, LastBacktest>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const list = await botApi.list();
        if (cancelled) return;

        if (list.length === 0) {
          setRealBots([]);
          setPerfById(new Map());
          setBtById(new Map());
          return;
        }

        const configs = await Promise.allSettled(
          list.map((b) => botApi.getConfig(b.id)),
        );
        if (cancelled) return;
        const configsOrNull = configs.map((r) =>
          r.status === 'fulfilled' ? (r.value.config as ConfigShape) : null,
        );
        const zipped = zipBotsAndConfigs(list, configsOrNull);
        setRealBots(zipped);

        // Enrich: live performance (running bots only) + latest backtest
        // (every bot, limit=1, top-level fields only) — all in parallel.
        const running = zipped.filter(
          (b) => b.mode === 'LIVE' || b.mode === 'DRY-RUN',
        );
        const [perfs, hists] = await Promise.all([
          Promise.allSettled(running.map((b) => botApi.getPerformance(b.id))),
          Promise.allSettled(
            zipped.map((b) => botApi.getBacktestHistory(b.id, 1)),
          ),
        ]);
        if (cancelled) return;

        const pMap = new Map<number, BotPerformance>();
        running.forEach((b, i) => {
          const r = perfs[i];
          if (r.status === 'fulfilled') pMap.set(b.id, r.value);
        });
        setPerfById(pMap);

        const bMap = new Map<number, LastBacktest>();
        zipped.forEach((b, i) => {
          const r = hists[i];
          if (r.status !== 'fulfilled') return;
          const items = r.value.items ?? [];
          const it = items[0];
          bMap.set(b.id, {
            historyCount: r.value.total ?? items.length,
            latestStatus: it?.status ?? null,
            winRate: it?.win_rate ?? null,
            trades: it?.trade_count ?? null,
            netAbs: it?.total_profit ?? null,
          });
        });
        setBtById(bMap);
      } catch (err) {
        if (cancelled) return;
        setFetchError(formatBackendError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  // ── Lifecycle actions ──
  const [confirmState, setConfirmState] = useState<null | {
    action: 'stop' | 'remove';
    botId: number;
    botName: string;
  }>(null);
  const [backtestBot, setBacktestBot] = useState<BacktestBot | null>(null);
  const [launchBotTarget, setLaunchBotTarget] = useState<LaunchpadBot | null>(
    null,
  );

  // After bot creation, ExportDialog routes here with state.launchpadBotId.
  useEffect(() => {
    const targetId = (location.state as { launchpadBotId?: number } | null)
      ?.launchpadBotId;
    if (targetId == null || consumedLaunchRef.current || !realBots) return;
    const found = realBots.find((b) => b.id === targetId);
    if (found) {
      consumedLaunchRef.current = true;
      setLaunchBotTarget(toLaunchpadBot(found));
      navigate('/dashboard', { replace: true, state: {} });
    }
  }, [location.state, realBots, navigate]);

  // Splice one bot's mode/errorMsg after a lifecycle response (dry_run from
  // the row, since BotStatusOut carries none).
  const updateOneBot = useCallback((id: number, next: BotStatusOut) => {
    setRealBots((prev) => {
      if (!prev) return prev;
      return prev.map((b) => {
        if (b.id !== id) return b;
        return {
          ...b,
          mode: deriveMode(
            { status: next.status, error_message: next.error_message ?? null },
            { dry_run: b.dryRun },
          ),
          errorMsg: next.error_message ?? null,
        };
      });
    });
  }, []);

  const removeOneBot = useCallback((id: number) => {
    setRealBots((prev) => (prev ? prev.filter((b) => b.id !== id) : prev));
  }, []);

  const mountedRef = useRef(true);
  const pollTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  useEffect(() => {
    mountedRef.current = true;
    const timers = pollTimers.current;
    return () => {
      mountedRef.current = false;
      timers.forEach((h) => clearTimeout(h));
      timers.clear();
    };
  }, []);

  const pollUntilSettled = useCallback(
    (id: number) => {
      let tries = 0;
      function schedule() {
        const h = setTimeout(() => {
          pollTimers.current.delete(h);
          void tick();
        }, POLL_INTERVAL_MS);
        pollTimers.current.add(h);
      }
      async function tick() {
        if (!mountedRef.current) return;
        let next: BotStatusOut;
        try {
          next = await botApi.getStatus(id);
        } catch {
          return;
        }
        if (!mountedRef.current || !next?.status) return;
        updateOneBot(id, next);
        if (!isTerminal(next.status) && ++tries < POLL_MAX_TRIES) schedule();
      }
      schedule();
    },
    [updateOneBot],
  );

  const doStop = useCallback(
    async (id: number) => {
      try {
        const next = await botApi.stop(id);
        updateOneBot(id, next);
        toast.success(`Stopping bot #${id}`);
        if (!isTerminal(next.status)) pollUntilSettled(id);
      } catch (err) {
        toast.error(formatBackendError(err));
      } finally {
        setConfirmState(null);
      }
    },
    [updateOneBot, pollUntilSettled],
  );

  const doSync = useCallback(
    async (id: number) => {
      try {
        await botApi.disableTelegram(id);
        const next = await botApi.sync(id);
        updateOneBot(id, next);
        toast.message('Connection settings fixed and status re-synced');
        if (!isTerminal(next.status)) pollUntilSettled(id);
      } catch (err) {
        toast.error(formatBackendError(err));
      }
    },
    [updateOneBot, pollUntilSettled],
  );

  const doRemove = useCallback(
    async (id: number) => {
      try {
        await botApi.remove(id);
        removeOneBot(id);
        toast.success(`Bot #${id} deleted`);
      } catch (err) {
        toast.error(formatBackendError(err));
      } finally {
        setConfirmState(null);
      }
    },
    [removeOneBot],
  );

  const isEmptyReal = realBots !== null && realBots.length === 0;
  const isLoadedReal = realBots !== null && realBots.length > 0;

  const stats = useMemo(
    () =>
      computePortfolioStats(
        (realBots ?? []).map((b) => ({ id: b.id, mode: b.mode })),
        perfById,
      ),
    [realBots, perfById],
  );

  // Build presentational card data from real bots + perf + last backtest.
  const realById = useMemo(
    () => new Map((realBots ?? []).map((b) => [b.id, b])),
    [realBots],
  );

  const cards = useMemo<BotCardData[]>(() => {
    return (realBots ?? []).map((b) => {
      const bt = btById.get(b.id);
      const perf = perfById.get(b.id);
      const state = derivePresentationalState(b.mode, {
        historyCount: bt?.historyCount ?? 0,
        latestStatus: bt?.latestStatus ?? null,
      });
      return {
        id: b.id,
        name: b.name,
        pair: b.pair,
        timeframe: b.timeframe,
        createdAt: b.createdAt ? b.createdAt.slice(0, 10) : null,
        leverage: b.leverage,
        stakeAmount: b.stakeAmount,
        maxOpenTrades: b.maxOpenTrades,
        balance: perf?.balance ?? null,
        openTrades: perf?.openTrades ?? null,
        state,
        errorMsg: b.errorMsg,
        lastBacktest:
          bt && bt.historyCount > 0
            ? {
                winRate: bt.winRate,
                trades: bt.trades,
                netAbs: bt.netAbs,
                status: bt.latestStatus ?? 'completed',
              }
            : null,
      };
    });
  }, [realBots, perfById, btById]);

  const filtered = search
    ? cards.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.pair.toLowerCase().includes(search.toLowerCase()),
      )
    : cards;

  const capital = stats.capitalDeployed.toLocaleString('en-US', {
    maximumFractionDigits: 2,
  });

  return (
    <div className="flex h-screen w-screen flex-col bg-black text-fg">
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

      <AppHeader />

      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-8 py-7">
          {/* Hero portfolio — capital deployed (live balance) */}
          <section
            aria-labelledby="portfolio-label"
            className="card-coin98-flat relative overflow-hidden rounded-3xl p-8"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-16 -top-24 h-80 w-80 rounded-full opacity-40 blur-2xl"
              style={{
                background:
                  'radial-gradient(circle, rgba(240,185,11,0.25), transparent 70%)',
              }}
            />
            <div className="relative">
              <div
                id="portfolio-label"
                className="mb-4 flex items-center gap-3 text-2xs uppercase tracking-widest text-fg-muted"
              >
                <span>Portfolio</span>
                <span className="inline-flex items-center gap-1.5 text-bullish">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bullish" />
                  Live
                </span>
              </div>

              <div
                className="font-mono text-6xl font-bold tabular-nums tracking-tight text-fg"
                style={{
                  textShadow: '0 0 38px rgba(240,185,11,0.22)',
                  lineHeight: 1.0,
                }}
              >
                {capital} <span className="text-2xl text-fg-muted">USDC</span>
              </div>
              <div className="mt-2 text-2xs uppercase tracking-widest text-fg-muted">
                Capital deployed · live balance
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-bullish">▲</span>
                  <span className="font-semibold tabular-nums text-fg">
                    {stats.active}
                  </span>
                  <span className="text-fg-muted">
                    active · {stats.total} total
                  </span>
                </span>
                <span className="text-border-strong">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-semibold tabular-nums text-fg-muted">
                    {stats.idle}
                  </span>
                  <span className="text-fg-muted">idle</span>
                </span>
                <span className="text-border-strong">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-semibold tabular-nums text-brand">
                    {stats.transitioning}
                  </span>
                  <span className="text-fg-muted">transitioning</span>
                </span>
                <span className="text-border-strong">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-semibold tabular-nums text-fg">
                    {stats.openTrades}
                  </span>
                  <span className="text-fg-muted">open trades</span>
                </span>
              </div>
            </div>
          </section>

          {/* My bots */}
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xs font-semibold uppercase tracking-widest text-fg-muted">
                My bots · {stats.total} total
              </h2>
              <div className="flex items-center gap-2">
                {isLoadedReal && (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search bots…"
                      className="h-9 w-44 rounded-md border border-border bg-input pl-8 pr-3 text-sm text-fg placeholder:text-fg-muted focus:border-brand focus:outline-none"
                    />
                  </div>
                )}
                {!loading && !fetchError && (
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={handleRefresh}
                    aria-label="Refresh bots"
                    title="Refresh"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="md"
                  className="min-w-[120px]"
                  onClick={() => requireWalletThen(() => setImportOpen(true))}
                >
                  Import
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  className="group min-w-[120px]"
                  onClick={() => requireWalletThen(() => navigate('/builder'))}
                >
                  New bot
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="card-coin98-flat min-h-[230px] animate-pulse rounded-2xl p-4"
                  >
                    <div className="h-4 w-16 rounded bg-fg-muted/15" />
                    <div className="mt-3 h-6 w-3/4 rounded bg-fg-muted/15" />
                    <div className="mt-2 h-3 w-1/2 rounded bg-fg-muted/15" />
                    <div className="mt-6 h-8 w-2/3 rounded bg-fg-muted/15" />
                  </div>
                ))}
              </div>
            ) : fetchError ? (
              <div className="card-coin98-flat rounded-2xl p-10 text-center">
                <p className="text-sm font-semibold text-bearish">
                  Couldn&apos;t load your bots
                </p>
                <p className="mt-1 text-xs text-fg-muted">{fetchError}</p>
                <Button
                  variant="secondary"
                  className="mt-4"
                  onClick={handleRefresh}
                >
                  Retry
                </Button>
              </div>
            ) : isEmptyReal ? (
              <DashboardEmptyState
                onCreate={() => requireWalletThen(() => navigate('/builder'))}
                onImport={() => requireWalletThen(() => setImportOpen(true))}
              />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((card) => (
                    <BotCard
                      key={card.id}
                      bot={card}
                      onClick={() => navigate(`/bots/${card.id}`)}
                      onStart={() => {
                        const rb = realById.get(card.id);
                        if (rb) setLaunchBotTarget(toLaunchpadBot(rb));
                      }}
                      onStop={() =>
                        setConfirmState({
                          action: 'stop',
                          botId: card.id,
                          botName: card.name,
                        })
                      }
                      onSync={() => void doSync(card.id)}
                      onRemove={() =>
                        setConfirmState({
                          action: 'remove',
                          botId: card.id,
                          botName: card.name,
                        })
                      }
                      onBacktest={() => {
                        const rb = realById.get(card.id);
                        if (rb)
                          setBacktestBot({
                            id: rb.id,
                            name: rb.name,
                            strategyName: rb.strategyName,
                            pair: rb.pair,
                            timeframe: rb.timeframe,
                          });
                      }}
                    />
                  ))}
                </div>

                {filtered.length === 0 && (
                  <div className="card-coin98-flat rounded-2xl p-10 text-center">
                    <p className="text-sm font-semibold text-fg">
                      No bots match &quot;{search}&quot;
                    </p>
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="mt-2 text-xs text-brand hover:underline"
                    >
                      Clear search
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <ConfirmActionDialog
        open={confirmState != null}
        onOpenChange={(o) => {
          if (!o) setConfirmState(null);
        }}
        title={
          confirmState?.action === 'remove'
            ? `Delete "${confirmState.botName}"?`
            : confirmState
              ? `Stop "${confirmState.botName}"?`
              : ''
        }
        body={
          confirmState?.action === 'remove'
            ? 'This action cannot be undone. The bot, its strategy file, and its tracking history will be permanently removed.'
            : 'The bot will stop placing orders immediately. Open positions are NOT closed automatically — you can manage them on the bot detail page.'
        }
        confirmLabel={confirmState?.action === 'remove' ? 'Delete' : 'Stop'}
        variant="destructive"
        onConfirm={() => {
          if (!confirmState) return;
          if (confirmState.action === 'stop') void doStop(confirmState.botId);
          else void doRemove(confirmState.botId);
        }}
      />

      <BacktestDialog
        open={backtestBot !== null}
        onOpenChange={(o) => {
          if (!o) setBacktestBot(null);
        }}
        bot={backtestBot}
      />

      <LaunchpadModal
        open={launchBotTarget !== null}
        onOpenChange={(o) => {
          if (!o) setLaunchBotTarget(null);
        }}
        bot={launchBotTarget}
        onBacktest={() => {
          if (launchBotTarget) {
            setBacktestBot({
              id: launchBotTarget.id,
              name: launchBotTarget.name,
              strategyName: launchBotTarget.strategyName,
              pair: launchBotTarget.pair,
              timeframe: launchBotTarget.timeframe,
            });
          }
          setLaunchBotTarget(null);
        }}
        onLaunched={() => {
          const id = launchBotTarget?.id;
          setLaunchBotTarget(null);
          if (id != null) navigate(`/bots/${id}`);
        }}
      />
    </div>
  );
}
