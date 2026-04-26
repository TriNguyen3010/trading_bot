import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { ConditionBuilder } from '@/features/conditions/ConditionBuilder';

export function IndicatorExitForm() {
  const close = useBuilderStore((s) => s.closeMethod);
  const strategy = useBuilderStore((s) => s.strategy);
  const patch = useBuilderStore((s) => s.patchCloseMethod);

  return (
    <ConditionBuilder
      group={close.exitConditions}
      indicators={strategy.indicators}
      candlestickChannels={strategy.candlestick}
      onChange={(g) => patch({ exitConditions: g })}
      label="Exit conditions"
      emptyHint="Add a condition (e.g. RSI > 70) to exit when indicators signal."
    />
  );
}
