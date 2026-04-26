import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { StepDrawer, type StepContentMap } from './StepDrawer';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import type { StepId } from '@/types/builder.types';

const CONTENT: Record<StepId, StepContentMap> = {
  'bot-config': {
    setup: <div data-testid="bot-config-setup">bot-config setup body</div>,
    configure: <div>cfg</div>,
    title: 'Bot Config',
    description: 'desc',
    index: 1,
  },
  'entry-strategy': {
    setup: <div data-testid="entry-setup">entry setup body</div>,
    configure: <div>cfg</div>,
    title: 'Entry Strategy',
    description: 'desc',
    index: 2,
  },
  direction: {
    setup: <div data-testid="dir-setup">dir setup body</div>,
    configure: <div>cfg</div>,
    title: 'Direction & Order',
    description: 'desc',
    index: 3,
  },
  'close-method': {
    setup: <div data-testid="close-setup">close setup body</div>,
    configure: <div>cfg</div>,
    title: 'Close Method',
    description: 'desc',
    index: 4,
  },
};

const noop = () => {};

const baseProps = {
  contentByStep: CONTENT,
  onManualClose: noop,
  onManualSave: noop,
  onManualSaveAndNext: noop,
  hasNext: true,
  onSummaryDismiss: noop,
  onSummaryReviewJson: noop,
};

describe('StepDrawer integration', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
    useCypheusStore.getState().resetAll();
  });

  it('renders the manual footer with Cancel/Save when openStep is set', async () => {
    useBuilderStore.getState().setOpenStep('bot-config');
    render(<StepDrawer {...baseProps} />);
    expect(await screen.findByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByTestId('bot-config-setup')).toBeInTheDocument();
  });

  it('shows the pinned footer and the cypheus active step content', async () => {
    useCypheusStore.getState().startCypheusDrawer('entry-strategy');
    render(<StepDrawer {...baseProps} />);
    expect(
      await screen.findByText(/Cypheus is configuring/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    expect(screen.getByTestId('entry-setup')).toBeInTheDocument();
  });

  it('switches content when cypheusActiveStepId changes', async () => {
    useCypheusStore.getState().startCypheusDrawer('bot-config');
    const view = render(<StepDrawer {...baseProps} />);
    expect(await screen.findByTestId('bot-config-setup')).toBeInTheDocument();

    useCypheusStore.getState().switchCypheusStep('direction');
    view.rerender(<StepDrawer {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('dir-setup')).toBeInTheDocument();
    });
  });

  it('renders the summary view in cypheus-summary mode', async () => {
    useCypheusStore.getState().startCypheusDrawer('close-method');
    useCypheusStore.getState().showCypheusSummary();
    render(<StepDrawer {...baseProps} hasNext={false} />);
    expect(await screen.findByText('All set ✓')).toBeInTheDocument();
    expect(screen.getByText('Review JSON')).toBeInTheDocument();
  });
});
