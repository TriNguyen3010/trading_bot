/**
 * Risk block: trading mode / stake / leverage / wallet / max trades.
 * Returns lines + an optional warning when leverage looks dangerous on
 * live capital.
 */
import type { BotConfigForm } from '@/types/builder.types';
import type { SummaryLine } from '../types';
import { t, line } from '../types';

export interface TranslateRiskResult {
  lines: SummaryLine[];
  /** Surfaced on the block header — only set in genuinely risky configs. */
  warning?: string;
}

const HIGH_LEVERAGE_THRESHOLD = 10;

function fmtMoney(n: number, currency: string): string {
  return `$${n.toLocaleString('en-US')} ${currency}`;
}

export function translateRisk(c: BotConfigForm): TranslateRiskResult {
  const lines: SummaryLine[] = [];
  let warning: string | undefined;

  // ── Trading mode ──────────────────────────────────────────────
  if (c.tradingMode === 'live') {
    lines.push(
      line(
        t('Live trading', 'bearish'),
        t(' — using real funds.'),
      ),
    );
  } else {
    lines.push(
      line(
        t(
          `Dry-run mode with a ${fmtMoney(c.dryRunWallet, c.stakeCurrency)} simulated wallet.`,
        ),
      ),
    );
  }

  // ── Stake + concurrency ──────────────────────────────────────
  const concurrency =
    c.maxOpenTrades === -1
      ? 'unlimited concurrent positions'
      : c.maxOpenTrades === 1
        ? '1 position at a time'
        : `up to ${c.maxOpenTrades} concurrent positions`;
  lines.push(
    line(
      t(
        `${fmtMoney(c.stakeAmount, c.stakeCurrency)} stake per trade, ${concurrency}.`,
      ),
    ),
  );

  // ── Leverage / market ────────────────────────────────────────
  if (c.marketType === 'spot') {
    lines.push(
      line(t('Spot trading — no leverage, no liquidation risk.')),
    );
  } else if (c.leverage <= 1) {
    lines.push(
      line(t(`No leverage (1×), ${c.marginMode}-margin futures.`)),
    );
  } else if (c.leverage >= HIGH_LEVERAGE_THRESHOLD) {
    lines.push(
      line(
        t('Leverage '),
        t(`${c.leverage}×`, 'bearish'),
        t(` ${c.marginMode}-margin — high-leverage, monitor closely.`),
      ),
    );
    if (c.tradingMode === 'live') {
      warning = `${c.leverage}× leverage on live capital — losses can exceed your stake.`;
    }
  } else {
    lines.push(
      line(t(`Leverage ${c.leverage}× ${c.marginMode}-margin.`)),
    );
  }

  return { lines, warning };
}
