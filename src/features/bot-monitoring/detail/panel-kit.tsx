import type { ReactNode } from 'react';

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
    <div className="rounded-xl border border-border-subtle bg-surface/40">
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
}: {
  k: string;
  v: string;
  accent?: 'bull' | 'bear';
}) {
  const cls =
    accent === 'bull'
      ? 'text-bullish'
      : accent === 'bear'
        ? 'text-bearish'
        : 'text-fg';
  return (
    <div className="flex items-center justify-between border-b border-border-subtle py-2 text-xs last:border-0">
      <span className="text-fg-secondary">{k}</span>
      <span className={`font-mono font-semibold ${cls}`}>{v}</span>
    </div>
  );
}
