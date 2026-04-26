import {
  Hand,
  Target,
  LineChart,
  Clock,
  AlertTriangle,
  type LucideIcon,
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
    type,
    tpEnabled,
    tpLevels,
    slEnabled,
    slValue,
    trailingEnabled,
    roiSteps,
    exitConditions,
  } = closeMethod;

  const meta = METHOD_META[type];
  const Icon = meta.icon;

  const totalTpAmount = tpLevels.reduce((sum, l) => sum + (l.amount ?? 0), 0);
  const tpOver100 = totalTpAmount > 100;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <ReadOnlyChip
          tone="brand"
          icon={<Icon className="h-3 w-3" />}
          title={`Close method: ${meta.label}`}
        >
          {meta.label}
        </ReadOnlyChip>

        {type === 'manual' ? (
          <span className="text-xs text-fg-muted">
            Close trades by hand
          </span>
        ) : null}

        {type === 'tp_sl' ? (
          <>
            {tpEnabled ? (
              <ReadOnlyChip
                tone={tpOver100 ? 'warning' : 'bullish'}
                icon={tpOver100 ? <AlertTriangle className="h-3 w-3" /> : null}
                title={
                  tpOver100
                    ? `Total TP ${totalTpAmount}% exceeds 100%`
                    : `${tpLevels.length} TP level${tpLevels.length === 1 ? '' : 's'}`
                }
              >
                TP {tpLevels.length}×
              </ReadOnlyChip>
            ) : (
              <ReadOnlyChip tone="neutral">TP off</ReadOnlyChip>
            )}
            {slEnabled ? (
              <ReadOnlyChip tone="bearish" title={`Stop loss ${slValue}%`}>
                SL {slValue}%
              </ReadOnlyChip>
            ) : (
              <ReadOnlyChip tone="neutral">SL off</ReadOnlyChip>
            )}
            {trailingEnabled ? (
              <ReadOnlyChip tone="info">Trailing</ReadOnlyChip>
            ) : null}
          </>
        ) : null}

        {type === 'roi' ? (
          <ReadOnlyChip
            tone="neutral"
            title={`${roiSteps.length} ROI step${roiSteps.length === 1 ? '' : 's'}`}
          >
            {roiSteps.length} step{roiSteps.length === 1 ? '' : 's'}
          </ReadOnlyChip>
        ) : null}

        {type === 'indicator' ? (
          <ReadOnlyChip
            tone="neutral"
            title={`${exitConditions.conditions.length} exit rule${exitConditions.conditions.length === 1 ? '' : 's'}`}
          >
            {exitConditions.conditions.length} rule
            {exitConditions.conditions.length === 1 ? '' : 's'}
          </ReadOnlyChip>
        ) : null}
      </div>

      {/* TP detail row — only when there are levels */}
      {type === 'tp_sl' && tpEnabled && tpLevels.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 pl-1">
          <span className="text-2xs uppercase tracking-wide text-fg-muted">
            Levels
          </span>
          {tpLevels.slice(0, 4).map((lvl, idx) => (
            <span
              key={idx}
              title={`+${lvl.profit}% × ${lvl.amount}% close`}
              className="font-mono text-2xs tabular-nums text-fg-secondary"
            >
              +{lvl.profit}%×{lvl.amount}%
            </span>
          ))}
          {tpLevels.length > 4 ? (
            <span className="text-2xs text-fg-muted">
              +{tpLevels.length - 4} more
            </span>
          ) : null}
        </div>
      ) : null}

      {/* ROI preview — first / last */}
      {type === 'roi' && roiSteps.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 pl-1">
          <span className="text-2xs uppercase tracking-wide text-fg-muted">
            Schedule
          </span>
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
            <span className="text-2xs text-fg-muted">
              +{roiSteps.length - 3} more
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Indicator exit — first rule preview */}
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
