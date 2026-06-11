import type { ReactNode } from 'react';
import { InfoHint } from '@/components/ui/info-hint';

/** Compact relative time ("12s ago" / "3h ago"); falls back to the raw
 * string on parse failure. Shared by StatusPanel + ActivityLogPanel. */
export function relTime(ts: string): string {
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return ts;
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="card-coin98-flat rounded-xl border border-border-subtle">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <span className="text-sm font-bold text-fg">{title}</span>
        {hint && <span className="text-xs text-fg-muted">{hint}</span>}
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  );
}

export function KV({
  k,
  v,
  accent,
  hint,
}: {
  k: string;
  v: string;
  accent?: 'bull' | 'bear';
  hint?: ReactNode;
}) {
  const cls =
    accent === 'bull'
      ? 'text-bullish'
      : accent === 'bear'
        ? 'text-bearish'
        : 'text-fg';
  return (
    <div className="flex items-center justify-between border-b border-border-subtle py-2 text-xs last:border-0">
      <span className="flex items-center gap-1 text-fg-secondary">
        {k}
        {hint ? <InfoHint text={hint} /> : null}
      </span>
      <span className={`font-mono font-semibold ${cls}`}>{v}</span>
    </div>
  );
}
