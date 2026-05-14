import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { ConditionTreeBuilder } from '@/features/conditions/ConditionTreeBuilder';
import { useConditionMetrics } from '@/features/conditions/useConditionMetrics';

export function IndicatorExitForm() {
  const close = useBuilderStore((s) => s.closeMethod);
  const patch = useBuilderStore((s) => s.patchCloseMethod);
  const { allCandle, fullIndicators, wrapOnChange } = useConditionMetrics();

  return (
    <ConditionTreeBuilder
      tree={close.exitConditions}
      indicators={fullIndicators}
      candlestickChannels={[...allCandle]}
      onChange={wrapOnChange((tree) => patch({ exitConditions: tree }))}
      label="Exit conditions"
      emptyHint="Add a group (e.g. RSI > 70) to exit when indicators signal."
      defaultGroupOnMount
    />
  );
}
