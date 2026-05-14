import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CypheusPanel } from './CypheusPanel';
import { useCypheusStore } from './store/cypheus.store';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useLayoutPrefsStore } from '@/features/layout-prefs/layout-prefs.store';

describe('CypheusPanel', () => {
  beforeEach(() => {
    useCypheusStore.getState().resetAll();
    useBuilderStore.getState().resetAll();
    useLayoutPrefsStore.setState({
      leftPanelCollapsed: true,
      botSummaryHidden: false,
      summaryMode: 'visual',
    });
  });

  it('renders the greeting bubbles and no input control', async () => {
    useLayoutPrefsStore.getState().setLeftPanelCollapsed(false);
    render(<CypheusPanel />);

    await waitFor(
      () => {
        // Wait for the third greeting bubble to start streaming. Exclude
        // the header "Coming Soon" pill (which renders synchronously and
        // would otherwise resolve this immediately).
        expect(
          screen.getByText(/Coming soon/i, {
            selector: ':not([data-pill="coming-soon"])',
          }),
        ).toBeInTheDocument();
      },
      { timeout: 4000 },
    );

    expect(screen.getByText(/Hi, I'm Cypheus/i)).toBeInTheDocument();
    expect(screen.getByText(/AI co-pilot/i)).toBeInTheDocument();

    expect(screen.queryByPlaceholderText(/Tell Cypheus/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /JSON/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create new bot/i })).not.toBeInTheDocument();
  });

  it('renders a "Coming Soon" pill next to the panel title when expanded', () => {
    useLayoutPrefsStore.getState().setLeftPanelCollapsed(false);
    render(<CypheusPanel />);

    const pill = screen.getByText(/Coming Soon/i, { selector: '[data-pill="coming-soon"]' });
    expect(pill).toBeInTheDocument();
  });

  it('starts collapsed and shows a red notification when unread messages exist', () => {
    useCypheusStore
      .getState()
      .pushMessage({ role: 'cypheus', text: 'Read me', typing: false });

    render(<CypheusPanel />);

    expect(
      screen.getByRole('button', { name: /Show Cypheus panel \(1 unread\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Coming Soon/i, { selector: '[data-pill="coming-soon"]' }),
    ).toBeNull();
  });
});
