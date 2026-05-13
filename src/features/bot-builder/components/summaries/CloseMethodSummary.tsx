import {
  Hand, Target, LineChart, Clock, AlertTriangle, type LucideIcon,
} from 'lucide-react';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { ReadOnlyChip } from './shared/ReadOnlyChip';
import { ConditionPreview } from './shared/ConditionPreview';
import type { CloseMethodType } from '@/types/builder.types';

const METHOD_META: Record<
  CloseMethodType,
  { label: string; icon: LucideIcon }
> = {
  manual: { label: 'Manual', icon: Hand },
  tp_sl: { label: 'TP / SL', icon: Target },
  indicator: { label: 'Indicator exit', icon: LineChart },
  roi: { label: 'ROI table', icon: Clock },
};

export function CloseMethodSummary() {
  const closeMethod = useBuilderStore((s) => s.closeMethod);
  const {
    type, tpEnabled, tpLevels, slEnabled, slValue, trailingEnabled,
    roiSteps, exitConditions,
  } = closeMethod;

  const meta = METHOD_META[type];
  const Icon = meta.icon;
  const totalTpAmount = tpLevels.reduce((sum, l) => sum + (l.amount ?? 0), 0);
  const tpOver100 = totalTpAmount > 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ReadOnlyChip
          tone="brand"
          icon={<Icon className="h-3 w-3" />}
          title={`Close method: ${meta.label}`}
        >
          {meta.label}
        </ReadOnlyChip>
        {type === 'manual' ? (
          <span className="text-xs text-fg-muted">Close trades by hand</span>
        ) : null}
        {type === 'tp_sl' && trailingEnabled ? (
          <ReadOnlyChip tone="info">Trailing</ReadOnlyChip>
        ) : null}
        {type === 'roi' ? (
          <ReadOnlyChip tone="neutral">
            {roiSteps.length} step{roiSteps.length === 1 ? '' : 's'}
          </ReadOnlyChip>
        ) : null}
        {type === 'indicator' ? (
          <ReadOnlyChip tone="neutral">
            {exitConditions.conditions.length} rule
            {exitConditions.conditions.length === 1 ? '' : 's'}
          </ReadOnlyChip>
        ) : null}
      </div>

      {/* TP/SL 2-cell grid — hero exit visualization (mockup B) */}
      {type === 'tp_sl' ? (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border-subtle bg-border-subtle">
          <div className="flex flex-col gap-0.5 bg-black/30 px-3 py-2">
            <span className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-bullish">
              Take profit
              {tpOver100 ? <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" /> : null}
            </span>
            <span className="font-mono text-sm font-semibold text-fg">
              {tpEnabled && tpLevels[0] ? `+${tpLevels[0].profit}%` : 'off'}
            </span>
            {tpEnabled && tpLevels.length > 0 ? (
              <span className="text-2xs text-fg-muted">
                {tpLevels.length} level{tpLevels.length === 1 ? '' : 's'} ·{' '}
                {totalTpAmount}% total
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-0.5 bg-black/30 px-3 py-2">
            <span className="text-2xs font-semibold uppercase tracking-wide text-bearish">
              Stop loss
            </span>
            <span className="font-mono text-sm font-semibold text-fg">
              {slEnabled ? `${slValue}%` : 'off'}
            </span>
            <span className="text-2xs text-fg-muted">
              {slEnabled ? (trailingEnabled ? 'trailing' : 'hard stop') : 'disabled'}
            </span>
          </div>
        </div>
      ) : null}

      {/* ROI preview */}
      {type === 'roi' && roiSteps.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 pl-1">
          <span className="text-2xs uppercase tracking-wide text-fg-muted">Schedule</span>
          {roiSteps.slice(0, 3).map((step, idx) => (
            <span
              key={idx}
              title={`${step.minutes}min @ ${step.roi}%`}
              className="font-mono text-2xs tabular-nums text-fg-secondary"
            >
              {step.minutes}m@{step.roi}%
            </span>
          ))}
          {roiSteps.length > 3 ? (
            <span className="text-2xs text-fg-muted">+{roiSteps.length - 3} more</span>
          ) : null}
        </div>
      ) : null}

      {/* Indicator exit preview */}
      {type === 'indicator' && exitConditions.conditions.length > 0 ? (
        <div className="pl-1">
          <ConditionPreview row={exitConditions.conditions[0]} />
          {exitConditions.conditions.length > 1 ? (
            <span className="ml-2 text-2xs text-fg-muted">
              + {exitConditions.conditions.length - 1} more
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
