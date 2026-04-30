import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download } from 'lucide-react';
import { Highlight, themes } from 'prism-react-renderer';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { buildUnifiedPayload } from '@/lib/serializer';
import {
  copyToClipboard,
  downloadJson,
  unifiedBotStrategyFilename,
} from '@/features/export-import/file-utils';
import { cn } from '@/lib/utils';
import { JsonEmptyState } from './JsonEmptyState';
import type { StepStatus } from '@/types/builder.types';

/**
 * Live JSON preview pane. Single unified payload (no more split tabs):
 * the FE used to show two files (`bot.json` + `strategy.json`) but the
 * Export/Import flow now produces one `bot-strategy-*.json` file via
 * `buildUnifiedPayload`. Showing the same shape here keeps the preview
 * truthful to what users actually download.
 */
export function JsonLiveView() {
  const stepStatus = useBuilderStore((s) => s.stepStatus);
  const hasAnyConfigured = useMemo(
    () => (Object.values(stepStatus) as StepStatus[]).some((s) => s === 'configured'),
    [stepStatus],
  );

  if (!hasAnyConfigured) {
    return <JsonEmptyState />;
  }

  return <JsonLiveViewActive />;
}

function JsonLiveViewActive() {
  const state = useBuilderStore();

  const json = useMemo(
    () => JSON.stringify(buildUnifiedPayload(state), null, 2),
    [state],
  );
  const filename = unifiedBotStrategyFilename(state.botName);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <JsonPane json={json} filename={filename} />
    </div>
  );
}

interface JsonPaneProps {
  json: string;
  filename: string;
}

const FLASH_DURATION_MS = 1000;

function JsonPane({ json, filename }: JsonPaneProps) {
  const [flashLines, setFlashLines] = useState<Set<number>>(new Set());
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const previousLines = useRef<string[] | null>(null);

  // Detect changed lines when JSON changes.
  useEffect(() => {
    const currentLines = json.split('\n');
    const prev = previousLines.current;
    if (prev) {
      const changed = new Set<number>();
      for (let i = 0; i < currentLines.length; i++) {
        if (prev[i] !== currentLines[i]) changed.add(i);
      }
      // Only flash if there's an actual change (not first render).
      if (changed.size > 0 && prev.length > 0) {
        setFlashLines(changed);
        setUpdatedAt(Date.now());
      }
    }
    previousLines.current = currentLines;
  }, [json]);

  // Clear flash class after animation completes.
  useEffect(() => {
    if (flashLines.size === 0) return;
    const id = window.setTimeout(
      () => setFlashLines(new Set()),
      FLASH_DURATION_MS,
    );
    return () => window.clearTimeout(id);
  }, [flashLines]);

  // Tick once a second so "Updated Xs ago" stays fresh.
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    if (!updatedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [updatedAt]);

  const handleCopy = async () => {
    const ok = await copyToClipboard(json);
    toast[ok ? 'success' : 'error'](ok ? 'Copied to clipboard.' : 'Copy failed.');
  };

  const handleDownload = () => {
    try {
      const data = JSON.parse(json);
      downloadJson(data, filename);
      toast.success(`Saved ${filename}`);
    } catch {
      toast.error('Could not download — JSON is invalid.');
    }
  };

  const updatedLabel = relativeTime(updatedAt);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 pt-2 pb-1">
        <span className="font-mono text-xs text-fg-muted">{filename}</span>
      </div>
      <div className="flex-1 overflow-auto px-4 py-3 scrollbar-thin">
        <Highlight code={json} language="json" theme={themes.vsDark}>
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={cn(className, 'font-mono text-xs leading-5')}
              style={{ ...style, background: 'transparent' }}
            >
              {tokens.map((line, i) => {
                const isFlash = flashLines.has(i);
                const lineProps = getLineProps({ line });
                return (
                  <div
                    key={i}
                    {...lineProps}
                    className={cn(
                      lineProps.className,
                      'block rounded-sm transition-colors',
                      isFlash && 'animate-flash-success',
                    )}
                  >
                    <span className="mr-3 inline-block w-6 select-none text-right text-fg-disabled">
                      {i + 1}
                    </span>
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </div>
                );
              })}
            </pre>
          )}
        </Highlight>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border-subtle px-4 py-2">
        <span className="text-2xs text-fg-muted">
          {updatedLabel ? `Updated ${updatedLabel}` : 'Live preview'}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            <Copy className="h-3 w-3" />
            Copy
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownload}>
            <Download className="h-3 w-3" />
            Download
          </Button>
        </div>
      </div>
    </div>
  );
}

function relativeTime(ts: number | null): string | null {
  if (!ts) return null;
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
}
