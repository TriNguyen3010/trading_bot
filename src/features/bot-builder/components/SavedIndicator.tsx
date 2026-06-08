import { useEffect, useState } from 'react';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { strings } from '@/i18n/en';

/** Relative "Saved · 12s ago" label. Returns null until the first save. */
function relativeTime(ts: number | null): string | null {
  if (!ts) return null;
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 5) return strings.header.saved;
  if (seconds < 60)
    return `${strings.header.saved} · ${strings.header.secondsAgo(seconds)}`;
  const minutes = Math.round(seconds / 60);
  return `${strings.header.saved} · ${minutes}m ago`;
}

/** Auto-save status, shown under the Add Strategy button in the builder
 * canvas (moved out of the header). Ticks once a second so the relative
 * time stays fresh; renders nothing until the first save. */
export function SavedIndicator() {
  const lastSavedAt = useBuilderStore((s) => s.lastSavedAt);

  // Tick once a second so "Saved 12s ago" stays fresh.
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!lastSavedAt) return null;
  return (
    <p className="mt-1 text-center text-xs text-fg-muted">
      {relativeTime(lastSavedAt)}
    </p>
  );
}
