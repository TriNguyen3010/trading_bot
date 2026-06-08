import { useCallback, useEffect, useMemo, useState } from 'react';
import { botApi, type BotStatusOut } from './bot.api';
import type { BotPerformance } from './bot-performance';
import {
  deriveMode,
  zipBotsAndConfigs,
  RUNNING_MODES,
  type ConfigShape,
  type DashboardBot,
} from './bot-list.helpers';
import { computePortfolioStats, type PortfolioStats } from './portfolio-stats';
import { formatBackendError } from '@/lib/format-error';

/** Per-bot summary of its most recent backtest history item (top-level fields
 * only — the `results` blob is intentionally NOT read here). Moved here from
 * DashboardPage so the shared data hook owns it. */
export interface LastBacktest {
  historyCount: number;
  latestStatus: string | null;
  winRate: number | null;
  trades: number | null;
  netAbs: number | null;
}

export interface UsePortfolioOverviewOptions {
  /** When false, the hook does not fetch (used on the public landing page
   * before the wallet is connected, where /bot/list would 401). Default true. */
  enabled?: boolean;
}

export interface PortfolioOverview {
  /** null → not loaded yet; [] → loaded, user has no bots. */
  bots: DashboardBot[] | null;
  perfById: Map<number, BotPerformance>;
  btById: Map<number, LastBacktest>;
  stats: PortfolioStats;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  /** Splice one bot's mode/errorMsg after a lifecycle response and drop its
   * stale balance once it is no longer running. */
  updateOneBot: (id: number, next: BotStatusOut) => void;
  removeOneBot: (id: number) => void;
}

export function usePortfolioOverview(
  options: UsePortfolioOverviewOptions = {},
): PortfolioOverview {
  const { enabled = true } = options;

  const [bots, setBots] = useState<DashboardBot[] | null>(null);
  const [perfById, setPerfById] = useState<Map<number, BotPerformance>>(
    () => new Map(),
  );
  const [btById, setBtById] = useState<Map<number, LastBacktest>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await botApi.list();
        if (cancelled) return;

        if (list.length === 0) {
          setBots([]);
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
        setBots(zipped);

        const running = zipped.filter((b) => RUNNING_MODES.includes(b.mode));
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
        setError(formatBackendError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const updateOneBot = useCallback((id: number, next: BotStatusOut) => {
    setBots((prev) => {
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
    if (next.status !== 'running') {
      setPerfById((prev) => {
        if (!prev.has(id)) return prev;
        const m = new Map(prev);
        m.delete(id);
        return m;
      });
    }
  }, []);

  const removeOneBot = useCallback((id: number) => {
    setBots((prev) => (prev ? prev.filter((b) => b.id !== id) : prev));
  }, []);

  const stats = useMemo(
    () => computePortfolioStats(bots ?? [], perfById),
    [bots, perfById],
  );

  return {
    bots,
    perfById,
    btById,
    stats,
    loading,
    error,
    refresh,
    updateOneBot,
    removeOneBot,
  };
}
