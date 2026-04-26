import { cn } from '@/lib/utils';

const TOKEN_GLYPH: Record<string, string> = {
  BTC: '₿', // ₿
  ETH: 'Ξ', // Ξ
  SOL: '◎', // ◎
  BNB: 'B',
  XRP: 'X',
  ADA: 'A',
  DOGE: 'D',
  AVAX: 'A',
  MATIC: 'M',
  DOT: 'P',
  LINK: 'L',
  USDT: '$',
  USDC: '$',
  DAI: '$',
};

const TOKEN_TONE: Record<string, string> = {
  BTC: 'border-warning/50 bg-warning/15 text-warning',
  ETH: 'border-info/50 bg-info/15 text-info',
  SOL: 'border-brand/50 bg-brand-subtle text-brand',
  BNB: 'border-warning/50 bg-warning/10 text-warning',
  XRP: 'border-info/50 bg-info/10 text-info',
  DOGE: 'border-warning/50 bg-warning/10 text-warning',
  USDT: 'border-bullish/40 bg-bullish-subtle text-bullish',
  USDC: 'border-info/40 bg-info/10 text-info',
};

const FALLBACK_TONE = 'border-border bg-surface-hover text-fg-secondary';

export interface TokenIconProps {
  symbol: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Compact token glyph rendered before the pair label on Bot Config summary.
 *
 * Uses Unicode glyphs for well-known tickers (₿, Ξ, ◎) and falls back to
 * the first letter of the symbol with a tinted neutral background.
 */
export function TokenIcon({ symbol, size = 'sm', className }: TokenIconProps) {
  const upper = (symbol || '').toUpperCase();
  const glyph = TOKEN_GLYPH[upper] ?? upper.charAt(0) ?? '?';
  const tone = TOKEN_TONE[upper] ?? FALLBACK_TONE;

  const sizing =
    size === 'md'
      ? 'h-7 w-7 text-sm'
      : 'h-5 w-5 text-2xs';

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border font-semibold leading-none',
        sizing,
        tone,
        className,
      )}
    >
      {glyph}
    </span>
  );
}
