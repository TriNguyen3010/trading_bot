import { useMemo, useState } from 'react';
import { Copy, Download, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { buildBundle } from '@/lib/serializer';
import { validateBuilder } from '@/lib/validator';
import { copyToClipboard, downloadJson } from './file-utils';
import { bundleSchema } from '@/schemas/bundle.schema';

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const state = useBuilderStore();
  const issues = useMemo(() => validateBuilder(state), [state]);
  const [parseError, setParseError] = useState<string | null>(null);

  const bundle = useMemo(() => {
    if (issues.length > 0) return null;
    try {
      const draft = buildBundle(state);
      const result = bundleSchema.safeParse(draft);
      if (!result.success) {
        setParseError(
          result.error.issues
            .slice(0, 4)
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('\n'),
        );
        return null;
      }
      setParseError(null);
      return result.data;
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [state, issues.length]);

  const json = bundle ? JSON.stringify(bundle, null, 2) : '';

  const slugBotName = state.botName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled-bot';
  const filename = `${slugBotName}.bundle.json`;

  const handleCopy = async () => {
    const ok = await copyToClipboard(json);
    toast[ok ? 'success' : 'error'](
      ok ? 'Bundle copied to clipboard.' : 'Copy failed.',
    );
  };

  const handleDownload = () => {
    if (!bundle) return;
    downloadJson(bundle, filename);
    toast.success(`Saved ${filename}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Export bundle</DialogTitle>
          <DialogDescription>
            One file containing both <code>bot</code> and{' '}
            <code>strategy</code> payloads. Backend can split client-side at
            import time.
          </DialogDescription>
        </DialogHeader>

        {issues.length > 0 ? (
          <div className="rounded-lg border border-danger/40 bg-bearish-subtle p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-bearish">
              <ShieldAlert className="h-4 w-4" />
              Fix {issues.length} issue{issues.length === 1 ? '' : 's'} before
              exporting:
            </div>
            <ul className="ml-5 list-disc space-y-1 text-xs text-fg">
              {issues.map((i, idx) => (
                <li key={idx}>
                  <span className="text-fg-muted">{stepLabel(i.stepId)}:</span>{' '}
                  {i.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {parseError ? (
          <div className="rounded-lg border border-danger/40 bg-bearish-subtle p-4 text-xs text-bearish">
            <p className="mb-1 font-semibold">Schema validation failed:</p>
            <pre className="whitespace-pre-wrap font-mono">{parseError}</pre>
          </div>
        ) : null}

        {bundle ? (
          <pre className="max-h-[420px] overflow-auto rounded-lg border border-border bg-canvas p-4 font-mono text-xs leading-5 text-fg-secondary scrollbar-thin">
            {json}
          </pre>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            variant="secondary"
            disabled={!bundle}
            onClick={handleCopy}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
          <Button
            variant="primary"
            disabled={!bundle}
            onClick={handleDownload}
          >
            <Download className="h-3.5 w-3.5" />
            Download .json
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function stepLabel(stepId: string) {
  switch (stepId) {
    case 'bot-config':
      return 'Bot Config';
    case 'entry-strategy':
      return 'Entry Strategy';
    case 'direction':
      return 'Direction & Order';
    case 'close-method':
      return 'Close Method';
    default:
      return stepId;
  }
}
