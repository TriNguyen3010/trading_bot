import { useEffect } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import { strings } from '@/i18n/en';
import type { StepId } from '@/types/builder.types';

const SUMMARY_STEPS: { id: StepId; index: number; title: string }[] = [
  { id: 'bot-config', index: 1, title: strings.steps.botConfig.title },
  { id: 'entry-strategy', index: 2, title: strings.steps.entryStrategy.title },
  { id: 'direction', index: 3, title: strings.steps.direction.title },
  { id: 'close-method', index: 4, title: strings.steps.closeMethod.title },
];

const AUTO_CLOSE_MS = 2000;

interface CypheusSummaryViewProps {
  /** Called when the user (or auto-close timer) wants the drawer dismissed. */
  onDismiss: () => void;
  /** Called when the user clicks "Review JSON". */
  onReviewJson: () => void;
}

/**
 * Final state shown for ~2s after Cypheus finishes the magic build. Lists the
 * four configured steps with brief one-line summaries, then auto-closes.
 */
export function CypheusSummaryView({
  onDismiss,
  onReviewJson,
}: CypheusSummaryViewProps) {
  const builder = useBuilderStore();
  const drawerMode = useCypheusStore((s) => s.drawerMode);

  useEffect(() => {
    if (drawerMode !== 'cypheus-summary') return;
    const t = window.setTimeout(onDismiss, AUTO_CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [drawerMode, onDismiss]);

  const lineFor = (id: StepId): string => {
    switch (id) {
      case 'bot-config':
        return `${builder.botConfig.pair || '—'} · ${builder.botConfig.timeframe} · ${builder.botConfig.leverage}x`;
      case 'entry-strategy': {
        const conds = builder.strategy.entryConditions.conditions;
        if (conds.length === 0) return '—';
        const c = conds[0];
        return `${c.left} ${c.op} ${c.right_number ?? c.right_indicator ?? ''}`;
      }
      case 'direction':
        return `${builder.directionForm.direction === 'long' ? 'Long' : 'Short'} · ${
          builder.directionForm.orderType === 'market' ? 'Market' : 'Limit'
        }`;
      case 'close-method':
        return builder.closeMethod.type === 'tp_sl'
          ? 'TP/SL'
          : builder.closeMethod.type === 'roi'
            ? 'ROI steps'
            : 'Indicator exit';
    }
  };

  return (
    <div className="flex h-full flex-col">
      <ul className="flex-1 space-y-3 px-6 py-5">
        {SUMMARY_STEPS.map((step) => (
          <li
            key={step.id}
            className="flex items-start gap-3 rounded-lg border border-bullish/30 bg-bullish/5 px-3 py-2"
          >
            <Check
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-bullish"
              aria-hidden
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-fg">
                {step.index}. {step.title}
              </div>
              <div className="text-xs text-fg-muted">{lineFor(step.id)}</div>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-end gap-3 border-t border-border-subtle px-6 py-4">
        <Button variant="ghost" onClick={onDismiss}>
          {strings.cypheus.magicBuild.summary.close}
        </Button>
        <Button variant="primary" onClick={onReviewJson}>
          {strings.cypheus.magicBuild.summary.reviewJson}
        </Button>
      </div>
    </div>
  );
}
