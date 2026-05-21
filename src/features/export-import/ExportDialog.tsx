import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Layers, Loader2, ShieldAlert, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { buildUnifiedPayload } from '@/lib/serializer';
import { validateBuilder } from '@/lib/validator';
import { unifiedBotStrategyCreateSchema } from '@/schemas/unified-bot-strategy.schema';
import { botStrategyApi } from '@/features/bot-builder/bot-strategy.api';
import { formatBackendError } from '@/lib/format-error';
import type { CreatePayload } from '@/types/api-helpers';
import { cn } from '@/lib/utils';
import {
  copyToClipboard,
  downloadJson,
  unifiedBotStrategyFilename,
} from './file-utils';
import { getDeploySummary } from './deploy-summary';
import { DeploySummary } from './DeploySummary';
import { JsonActionGroup } from './JsonActionGroup';
import { JsonPreviewPane } from './JsonPreviewPane';

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODAL_W_COLLAPSED = 600;
const MODAL_W_EXPANDED = 980;
const JSON_PANE_W = MODAL_W_EXPANDED - MODAL_W_COLLAPSED;
const EXPAND_EASE = [0.16, 1, 0.3, 1] as const;

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const state = useBuilderStore();
  const issues = useMemo(() => validateBuilder(state), [state]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const navigate = useNavigate();

  const summary = useMemo(() => getDeploySummary(state), [state]);

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
      return draft;
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [state, issues.length]);

  const json = bundle ? JSON.stringify(bundle, null, 2) : '';
  const filename = unifiedBotStrategyFilename(state.botName);
  const canExport = bundle !== null;

  const handleCopy = async () => {
    if (!json) return;
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
      const backendPayload = unifiedBotStrategyCreateSchema.parse(bundle);
      const response = await botStrategyApi.create(
        backendPayload as unknown as CreatePayload,
      );
      toast.success(
        `Bot #${response.bot.id} "${response.bot.bot_name ?? ''}" đã được tạo thành công`,
      );
      onOpenChange(false);
      setTimeout(() => {
        navigate(`/bots/${response.bot.id}`);
      }, 150);
    } catch (err) {
      setSubmitError(formatBackendError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border-strong bg-surface-elevated shadow-lg data-[state=open]:animate-fade-in"
        >
          <motion.div
            initial={false}
            animate={{
              width: showJson ? MODAL_W_EXPANDED : MODAL_W_COLLAPSED,
            }}
            transition={{ duration: 0.36, ease: EXPAND_EASE }}
            className="grid max-h-[calc(100vh-64px)] grid-rows-[auto_minmax(0,1fr)_auto]"
          >
            {/* ─── HEADER ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-3 border-b border-border bg-canvas/40 px-5 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-brand/20 bg-brand-subtle text-brand">
                  <Layers className="h-3.5 w-3.5" />
                </div>
                <DialogPrimitive.Title className="truncate text-sm font-semibold leading-none tracking-tight text-fg">
                  Review &amp; deploy bot
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">
                  Inspect the bot summary before submitting to the backend.
                </DialogPrimitive.Description>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <JsonActionGroup
                  previewOpen={showJson}
                  onTogglePreview={() => setShowJson((o) => !o)}
                  onCopy={handleCopy}
                  onDownload={handleDownload}
                  disabled={!canExport}
                />
                <DialogPrimitive.Close
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-fg-muted transition-colors hover:border-border-strong hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  aria-label="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </DialogPrimitive.Close>
              </div>
            </div>

            {/* ─── BODY: 2 panes ───────────────────────────────────── */}
            <div className="flex min-h-0">
              {/* Summary pane (fixed width = collapsed modal width) */}
              <div
                className={cn(
                  'flex shrink-0 flex-col overflow-y-auto transition-colors',
                  showJson && 'border-r border-border',
                )}
                style={{ width: MODAL_W_COLLAPSED }}
              >
                {issues.length > 0 ? (
                  <IssuesBanner
                    title={`Fix ${issues.length} issue${
                      issues.length === 1 ? '' : 's'
                    } before deploying`}
                    items={issues.map((i) => ({
                      label: stepLabel(i.stepId),
                      message: i.message,
                    }))}
                  />
                ) : null}

                {parseError ? (
                  <ErrorBlock
                    title="Schema validation failed"
                    body={parseError}
                  />
                ) : null}
                {submitError ? (
                  <ErrorBlock
                    title="Backend rejected the payload"
                    body={submitError}
                  />
                ) : null}

                <DeploySummary summary={summary} />
              </div>

              {/* JSON pane (animates 0 → JSON_PANE_W) */}
              <motion.div
                initial={false}
                animate={{
                  width: showJson ? JSON_PANE_W : 0,
                  opacity: showJson ? 1 : 0,
                }}
                transition={{
                  width: { duration: 0.36, ease: EXPAND_EASE },
                  opacity: {
                    duration: 0.28,
                    ease: EXPAND_EASE,
                    delay: showJson ? 0.12 : 0,
                  },
                }}
                className="overflow-hidden"
                aria-hidden={!showJson}
              >
                <div style={{ width: JSON_PANE_W }} className="h-full">
                  {json ? (
                    <JsonPreviewPane json={json} filename={filename} />
                  ) : (
                    <EmptyJsonPane />
                  )}
                </div>
              </motion.div>
            </div>

            {/* ─── FOOTER ──────────────────────────────────────────── */}
            <div className="flex items-center justify-end gap-2 border-t border-border bg-canvas/40 px-5 py-3">
              <Button
                variant="ghost"
                size="md"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={!canExport || submitting}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {submitting ? 'Deploying…' : 'Deploy bot'}
              </Button>
            </div>
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ─── Internals ─────────────────────────────────────────────────── */

function IssuesBanner({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; message: string }>;
}) {
  return (
    <div className="mx-6 mt-5 rounded-lg border border-bearish/40 bg-bearish-subtle p-3.5">
      <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-bearish">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        {title}
      </div>
      <ul className="ml-5 list-disc space-y-1 text-xs text-fg">
        {items.map((i, idx) => (
          <li key={idx}>
            <span className="text-fg-muted">{i.label}:</span> {i.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ErrorBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-6 mt-5 rounded-lg border border-bearish/40 bg-bearish-subtle p-3.5 text-xs text-bearish">
      <p className="mb-1 font-semibold">{title}</p>
      <pre className="whitespace-pre-wrap font-mono text-fg">{body}</pre>
    </div>
  );
}

function EmptyJsonPane() {
  return (
    <div className="grid h-full place-items-center bg-canvas p-8 text-center text-xs text-fg-muted">
      <div className="max-w-[240px]">
        <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full border border-border bg-surface-elevated">
          <ShieldAlert className="h-4 w-4 text-fg-muted" />
        </div>
        <p>
          Fix the issues on the left before the payload becomes inspectable.
        </p>
      </div>
    </div>
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
