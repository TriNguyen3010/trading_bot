import type { MouseEvent } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getTemplateById,
  type BotTemplate,
  type TemplateDifficulty,
  type TemplateRisk,
} from '@/templates';
import { useTemplatesDialogStore } from './templates-dialog.store';

const DIFFICULTY_TONE: Record<TemplateDifficulty, string> = {
  beginner: 'text-bullish',
  intermediate: 'text-brand',
  advanced: 'text-bearish',
};

const RISK_LABEL: Record<TemplateRisk, string> = {
  conservative: 'Conservative',
  balanced: 'Balanced',
  aggressive: 'Aggressive',
};

export interface TemplateDetailModalProps {
  /** Receives the click event so callers can detect Shift-click for the
   * skip-animation path (decision D2). */
  onUse: (template: BotTemplate, event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Read-only preview of a single template — opens when the user clicks a
 * card body in the gallery, or clicks the "Based on …" header badge.
 *
 * Renders longDescription, the key parameter highlights (pair / timeframe /
 * leverage / direction / close method) so the user can sanity-check the
 * starter before committing, plus the same "Use this template" CTA the
 * card has.
 */
export function TemplateDetailModal({ onUse }: TemplateDetailModalProps) {
  const detailId = useTemplatesDialogStore((s) => s.detailId);
  const closeDetail = useTemplatesDialogStore((s) => s.closeDetail);

  const template = detailId ? getTemplateById(detailId) : null;
  const open = template !== null;

  const handleUse = (e: MouseEvent<HTMLButtonElement>) => {
    if (!template) return;
    closeDetail();
    onUse(template, e);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeDetail()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {template && <DetailBody template={template} />}
        <DialogFooter>
          <Button variant="ghost" onClick={closeDetail}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleUse}
            aria-label={`Use ${template?.name ?? 'template'}`}
          >
            Use this template
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */

function DetailBody({ template }: { template: BotTemplate }) {
  return (
    <>
      <DialogHeader>
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-brand-subtle text-brand">
          <Sparkles className="h-5 w-5" />
        </div>
        <DialogTitle>{template.name}</DialogTitle>
        <DialogDescription>{template.description}</DialogDescription>
      </DialogHeader>

      {/* Metadata strip: difficulty + risk + tags */}
      <div className="-mt-2 mb-3 flex flex-wrap items-center gap-2 text-2xs uppercase tracking-wide">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 font-semibold',
            DIFFICULTY_TONE[template.difficulty],
          )}
        >
          {template.difficulty}
        </span>
        <span className="text-fg-muted">•</span>
        <span className="text-fg-secondary">
          {RISK_LABEL[template.riskLevel]}
        </span>
        {template.tags.length > 0 && (
          <>
            <span className="text-fg-muted">•</span>
            <span className="flex flex-wrap gap-1">
              {template.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border-subtle px-2 text-fg-muted"
                >
                  #{tag}
                </span>
              ))}
            </span>
          </>
        )}
      </div>

      {template.longDescription && (
        <p className="mb-4 text-sm leading-relaxed text-fg-secondary">
          {template.longDescription}
        </p>
      )}

      <ParamHighlights template={template} />
    </>
  );
}

function ParamHighlights({ template }: { template: BotTemplate }) {
  const c = template.state.botConfig;
  const d = template.state.directionForm;
  const close = template.state.closeMethod;

  // Build a small key/value list highlighting the most "is this for me?"
  // fields. We keep it short — the gallery card already shows the name and
  // tags, so the modal's job is to surface the gritty trade params.
  const rows: { label: string; value: string }[] = [
    { label: 'Pair', value: c.pair },
    { label: 'Timeframe', value: c.timeframe },
    {
      label: 'Mode',
      value: `${c.tradingMode === 'dry-run' ? 'Dry-run' : 'Live'} · ${c.marketType}${c.leverage > 1 ? ` · ${c.leverage}x` : ''}`,
    },
    {
      label: 'Direction',
      value: `${d.direction === 'long' ? 'Long' : 'Short'} · ${d.orderType}`,
    },
    {
      label: 'Indicators',
      value:
        template.state.strategy.indicators.length > 0
          ? template.state.strategy.indicators.map((i) => i.name).join(', ')
          : '—',
    },
    {
      label: 'Close',
      value: closeMethodLabel(close),
    },
  ];

  return (
    <div className="rounded-lg border border-border-subtle bg-canvas/60 p-4">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        Key parameters
      </h4>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col">
            <dt className="text-2xs uppercase tracking-wide text-fg-muted">
              {row.label}
            </dt>
            <dd className="text-fg">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function closeMethodLabel(close: BotTemplate['state']['closeMethod']): string {
  switch (close.type) {
    case 'tp_sl': {
      const tps = close.tpEnabled ? `${close.tpLevels.length} TP${close.tpLevels.length === 1 ? '' : 's'}` : '';
      const sl = close.slEnabled ? `SL ${close.slValue}%` : '';
      return [tps, sl].filter(Boolean).join(' · ') || 'TP/SL';
    }
    case 'roi':
      return `ROI · ${close.roiSteps.length} step${close.roiSteps.length === 1 ? '' : 's'}`;
    case 'indicator':
      return 'Indicator exit';
    case 'manual':
      return 'Manual';
  }
}
