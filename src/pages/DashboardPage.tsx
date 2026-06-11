import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DotGridSpotlight } from '@/features/fx/DotGridSpotlight';
import { ImportDialog } from '@/features/export-import/ImportDialog';
import { useRequireWallet } from '@/features/wallet-auth/RequireWalletProvider';
import { botApi, type BotStatusOut } from '@/features/bot-monitoring/bot.api';
import { type DashboardBot } from '@/features/bot-monitoring/bot-list.helpers';
import { derivePresentationalState } from '@/features/bot-monitoring/presentational-state';
import { usePortfolioOverview } from '@/features/bot-monitoring/usePortfolioOverview';
import { BotCard, type BotCardData } from '@/features/bot-monitoring/BotCard';
import { PortfolioBar } from '@/features/bot-monitoring/PortfolioBar';
import { StatusFilterChips } from '@/features/bot-monitoring/StatusFilterChips';
import { sortCards } from '@/features/bot-monitoring/bot-sort';
import {
  filterByCategory,
  countByCategory,
  type FilterCategory,
} from '@/features/bot-monitoring/bot-filter';
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
import { cn } from '@/lib/utils';

/** Poll cadence + safety cap for status polling after a lifecycle action. */
const POLL_INTERVAL_MS = 1_500;
const POLL_MAX_TRIES = 40;

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
    stakeAmount: b.stakeAmount,
  };
}

export function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const consumedLaunchRef = useRef(false);
  const { requireWalletThen } = useRequireWallet();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [importOpen, setImportOpen] = useState(false);

  const {
    bots: realBots,
    perfById,
    btById,
    stats,
    loading,
    error: fetchError,
    refresh: handleRefresh,
    updateOneBot,
    removeOneBot,
  } = usePortfolioOverview();

  // ── Lifecycle actions ──
  const [confirmState, setConfirmState] = useState<null | {
    action: 'stop' | 'remove';
    botId: number;
    botName: string;
  }>(null);
  const [backtestBot, setBacktestBot] = useState<BacktestBot | null>(null);
  // When the launchpad started the run itself, BacktestDialog opens straight
  // into the running phase for this id.
  const [backtestStartId, setBacktestStartId] = useState<number | null>(null);
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
        stakeAmount: b.stakeAmount,
        maxOpenTrades: b.maxOpenTrades,
        balance: perf?.balance ?? null,
        openTrades: perf?.openTrades ?? null,
        mode: b.mode,
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

  const counts = useMemo(() => countByCategory(cards), [cards]);

  // If the active filter's bucket empties (after a refresh/poll), fall back to
  // "all" so the user isn't stranded on a now-disabled chip + empty grid.
  useEffect(() => {
    if (filter !== 'all' && counts[filter] === 0) setFilter('all');
  }, [counts, filter]);

  // Sort (triage-first) → filter by status chip → filter by search.
  const filtered = useMemo(() => {
    const sorted = sortCards(cards);
    const byCat = filterByCategory(sorted, filter);
    if (!search) return byCat;
    const q = search.toLowerCase();
    return byCat.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.pair.toLowerCase().includes(q),
    );
  }, [cards, filter, search]);

  return (
    <>
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
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-8 py-7">
          {isEmptyReal ? (
            <DashboardEmptyState
              onCreate={() => requireWalletThen(() => navigate('/builder'))}
              onImport={() => requireWalletThen(() => setImportOpen(true))}
            />
          ) : (
            <>
              <PortfolioBar stats={stats} loading={loading} />

              <section className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xs font-semibold uppercase tracking-widest text-fg-muted">
                      My bots · {stats.total}
                    </h2>
                    {isLoadedReal && (
                      <StatusFilterChips
                        counts={counts}
                        active={filter}
                        onChange={setFilter}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isLoadedReal && (
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search bots or pairs…"
                          className="h-9 w-[220px] rounded-[10px] border border-border bg-input pl-9 pr-3 text-[13px] text-fg placeholder:text-fg-disabled focus:border-border-strong focus:outline-none"
                        />
                      </div>
                    )}
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={handleRefresh}
                      disabled={loading}
                      aria-label="Refresh bots"
                      title="Refresh"
                    >
                      <RefreshCw
                        className={cn('h-3.5 w-3.5', loading && 'animate-spin')}
                      />
                    </Button>
                    <Button
                      variant="secondary"
                      size="md"
                      className="min-w-[120px]"
                      onClick={() =>
                        requireWalletThen(() => setImportOpen(true))
                      }
                    >
                      Import
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      className="group min-w-[120px]"
                      onClick={() =>
                        requireWalletThen(() => navigate('/builder'))
                      }
                    >
                      New bot
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </Button>
                  </div>
                </div>

                {loading ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
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
                ) : (
                  <>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
                      {filtered.map((card) => (
                        <BotCard
                          key={card.id}
                          bot={card}
                          onClick={() =>
                            navigate(`/bots/${card.id}`, {
                              state: {
                                createdAt: card.createdAt,
                                name: card.name,
                              },
                            })
                          }
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
                          onRemove={() =>
                            setConfirmState({
                              action: 'remove',
                              botId: card.id,
                              botName: card.name,
                            })
                          }
                          onBacktest={() => {
                            const rb = realById.get(card.id);
                            if (rb) {
                              // Card path opens the setup phase — clear any
                              // stale launchpad-started run id.
                              setBacktestStartId(null);
                              setBacktestBot({
                                id: rb.id,
                                name: rb.name,
                                strategyName: rb.strategyName,
                                pair: rb.pair,
                                timeframe: rb.timeframe,
                              });
                            }
                          }}
                        />
                      ))}
                    </div>

                    {filtered.length === 0 && (
                      <div className="card-coin98-flat rounded-2xl p-10 text-center">
                        <p className="text-sm font-semibold text-fg">
                          No bots match your filter
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setFilter('all');
                          }}
                          className="mt-2 text-xs text-brand hover:underline"
                        >
                          Clear filter
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
            </>
          )}
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
          if (!o) {
            setBacktestBot(null);
            setBacktestStartId(null);
          }
        }}
        bot={backtestBot}
        initialBacktestId={backtestStartId}
        // A run finished in the dialog updates the bot's last-backtest chip.
        onComplete={handleRefresh}
        onViewDetails={() => {
          const id = backtestBot?.id;
          // Close the dialog (clear both drivers) before leaving the page.
          setBacktestBot(null);
          setBacktestStartId(null);
          if (id != null) navigate(`/bots/${id}`);
        }}
      />

      <LaunchpadModal
        open={launchBotTarget !== null}
        onOpenChange={(o) => {
          if (!o) setLaunchBotTarget(null);
        }}
        bot={launchBotTarget}
        onBacktestStarted={(backtestId) => {
          if (launchBotTarget) {
            setBacktestBot({
              id: launchBotTarget.id,
              name: launchBotTarget.name,
              strategyName: launchBotTarget.strategyName,
              pair: launchBotTarget.pair,
              timeframe: launchBotTarget.timeframe,
            });
            setBacktestStartId(backtestId);
          }
          setLaunchBotTarget(null);
        }}
        onLaunched={() => {
          const id = launchBotTarget?.id;
          setLaunchBotTarget(null);
          if (id != null) navigate(`/bots/${id}`);
        }}
      />
    </>
  );
}
