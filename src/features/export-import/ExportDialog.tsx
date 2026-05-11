import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Download, Loader2, ShieldAlert, Upload } from 'lucide-react';
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
import { buildUnifiedPayload } from '@/lib/serializer';
import { validateBuilder } from '@/lib/validator';
import {
  copyToClipboard,
  downloadJson,
  unifiedBotStrategyFilename,
} from './file-utils';
import { unifiedBotStrategyCreateSchema } from '@/schemas/unified-bot-strategy.schema';
import { botStrategyApi } from '@/features/bot-builder/bot-strategy.api';
import { ValidationError } from '@/lib/http';
import type { CreatePayload } from '@/types/api-helpers';

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const state = useBuilderStore();
  const issues = useMemo(() => validateBuilder(state), [state]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Build the unified payload + the 3 FE-only round-trip fields. We
  // validate the BE-shape part with `unifiedBotStrategyCreateSchema` (the
  // schema strips the extras), but emit the full bundle so re-import
  // re-hydrates the builder. See `UnifiedBundle` in serializer.ts.
  const bundle = useMemo(() => {
    if (issues.length > 0) return null;
    try {
      const draft = buildUnifiedPayload(state);
      const result = unifiedBotStrategyCreateSchema.safeParse(draft);
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
      // Return the original draft (with FE-only fields), not result.data
      // (which has the FE-only fields stripped by Zod's default object
      // mode). Both are equivalent for the BE; the draft is richer for
      // round-trip.
      return draft;
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [state, issues.length]);

  const json = bundle ? JSON.stringify(bundle, null, 2) : '';
  const filename = unifiedBotStrategyFilename(state.botName);

  const handleCopy = async () => {
    const ok = await copyToClipboard(json);
    toast[ok ? 'success' : 'error'](
      ok ? 'Bot strategy copied to clipboard.' : 'Copy failed.',
    );
  };

  const handleDownload = () => {
    if (!bundle) return;
    downloadJson(bundle, filename);
    toast.success(`Saved ${filename}`);
  };

  const handleSubmit = async () => {
    if (!bundle) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await botStrategyApi.create(bundle as unknown as CreatePayload);
      toast.success(
        `Bot #${response.bot.id} "${response.bot.bot_name ?? ''}" đã được tạo thành công`,
      );
      onOpenChange(false);
      setTimeout(() => {
        navigate(`/bots/${response.bot.id}`);
      }, 150);
    } catch (err) {
      if (err instanceof ValidationError) {
        setSubmitError(
          err.detail
            .map((d) => `${d.loc.join('.')}: ${d.msg}`)
            .join('\n'),
        );
      } else {
        toast.error('Lỗi server, vui lòng thử lại');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Export bot strategy</DialogTitle>
          <DialogDescription>
            One unified <code>bot-strategy-*.json</code> file matching the
            backend's <code>POST /bot-strategy/create</code> shape.
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

        {submitError ? (
          <div className="rounded-lg border border-danger/40 bg-bearish-subtle p-4 text-xs text-bearish">
            <p className="mb-1 font-semibold">Backend validation error:</p>
            <pre className="whitespace-pre-wrap font-mono">{submitError}</pre>
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
            variant="secondary"
            disabled={!bundle}
            onClick={handleDownload}
          >
            <Download className="h-3.5 w-3.5" />
            Download .json
          </Button>
          <Button
            variant="primary"
            disabled={!bundle || submitting}
            onClick={handleSubmit}
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {submitting ? 'Submitting…' : 'Submit to Backend'}
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
