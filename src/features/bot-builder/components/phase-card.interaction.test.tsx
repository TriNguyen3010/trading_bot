import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Bot } from 'lucide-react';
import { StepCard } from './StepCard';
import { StrategyCard } from './StrategyCard';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import { useLayoutPrefsStore } from '@/features/layout-prefs/layout-prefs.store';

describe('phase card interactions', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
    useCypheusStore.getState().resetAll();
    useLayoutPrefsStore.getState().setSummaryMode('visual');
  });

  it('shows the Cypheus hello avatar on idle Phase 1', () => {
    const { container } = render(
      <StepCard
        stepId="bot-config"
        index={1}
        icon={Bot}
        title="Bot Basics"
      />,
    );

    expect(container.querySelector('video')?.getAttribute('src')).toBe(
      '/cypheus/hello-alpha.webm',
    );
  });

  it('opens Phase 1 side panel when clicking the summary area', () => {
    const store = useBuilderStore.getState();
    store.patchBotConfig({ pair: 'BTC-USDC', timeframe: '5m', leverage: 1 });
    store.setStepStatus('bot-config', 'configured');

    render(
      <StepCard
        stepId="bot-config"
        index={1}
        icon={Bot}
        title="Bot Basics"
      />,
    );

    fireEvent.click(screen.getByText('BTC-USDC'));

    expect(useBuilderStore.getState().openStep).toBe('bot-config');
  });

  it('opens Phase 2 side panel when clicking the summary area', () => {
    const store = useBuilderStore.getState();
    store.setStepStatus('entry-strategy', 'configured');
    store.setStepStatus('direction', 'configured');
    store.setStepStatus('close-method', 'configured');

    render(<StrategyCard />);

    fireEvent.click(screen.getByText('No entry rules yet'));

    expect(useBuilderStore.getState().openStep).toBe('entry-strategy');
  });
});
