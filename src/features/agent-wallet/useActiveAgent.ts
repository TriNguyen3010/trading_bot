import { useCallback, useEffect, useState } from 'react';
import { agentApi } from './agent.api';
import type { AgentInfoResponse } from '@/types/api-helpers';

export interface UseActiveAgentOptions {
  /** Skip the fetch (e.g. wallet not connected). Default true. */
  enabled?: boolean;
}

export interface ActiveAgentState {
  agent: AgentInfoResponse | null;
  loading: boolean;
  /** Re-fetch — call after the user creates an agent so the go-live nudge
   * disappears without a page reload. */
  refresh: () => void;
}

/** Fetch the wallet's active Hyperliquid agent for the "go live" nudge.
 * Fail-soft: any error resolves to `agent: null` (treated as "no agent yet")
 * so a failed /agent/active never blocks the portfolio from rendering. */
export function useActiveAgent(
  options: UseActiveAgentOptions = {},
): ActiveAgentState {
  const { enabled = true } = options;
  const [agent, setAgent] = useState<AgentInfoResponse | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    agentApi
      .active()
      .then((a) => {
        if (!cancelled) setAgent(a ?? null);
      })
      .catch(() => {
        if (!cancelled) setAgent(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { agent, loading, refresh };
}
