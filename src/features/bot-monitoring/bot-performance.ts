/** Defensive shape for the untyped GET /bot/{id}/performance response.
 * openapi declares no schema; we read only the fields BE is observed to
 * return today — balance + open-trades count. PnL/win-rate are NOT read
 * (BE returns N/A → dropped from the design, spec §6). Verify candidate
 * keys against a real BE response. */
export interface BotPerformance {
  balance: number | null;
  openTrades: number | null;
}

function num(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

export function parseBotPerformance(raw: unknown): BotPerformance {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    balance: num(o, ['balance', 'wallet_balance', 'current_balance']),
    openTrades: num(o, [
      'open_trades',
      'open_trades_count',
      'open_trade_count',
    ]),
  };
}
