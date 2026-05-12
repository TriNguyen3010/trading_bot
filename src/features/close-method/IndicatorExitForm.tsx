import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { ConditionBuilder } from '@/features/conditions/ConditionBuilder';
import { useConditionMetrics } from '@/features/conditions/useConditionMetrics';

export function IndicatorExitForm() {
  const close = useBuilderStore((s) => s.closeMethod);
  const patch = useBuilderStore((s) => s.patchCloseMethod);
  const { allCandle, fullIndicators, wrapOnChange } = useConditionMetrics();

  return (
    <ConditionBuilder
      group={close.exitConditions}
      indicators={fullIndicators}
      candlestickChannels={[...allCandle]}
      onChange={wrapOnChange((g) => patch({ exitConditions: g }))}
      label="Exit conditions"
      emptyHint="Add a condition (e.g. RSI > 70) to exit when indicators signal."
    />
  );
}
