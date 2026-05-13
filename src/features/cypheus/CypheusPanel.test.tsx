import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CypheusPanel } from './CypheusPanel';
import { useCypheusStore } from './store/cypheus.store';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';

describe('CypheusPanel', () => {
  beforeEach(() => {
    useCypheusStore.getState().resetAll();
    useBuilderStore.getState().resetAll();
  });

  it('renders the greeting bubbles and no input control', async () => {
    render(<CypheusPanel />);

    await waitFor(
      () => {
        expect(screen.getByText(/Coming soon/i)).toBeInTheDocument();
      },
      { timeout: 4000 },
    );

    expect(screen.getByText(/Hi, I'm Cypheus/i)).toBeInTheDocument();
    expect(screen.getByText(/AI co-pilot/i)).toBeInTheDocument();

    expect(screen.queryByPlaceholderText(/Tell Cypheus/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /JSON/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create new bot/i })).not.toBeInTheDocument();
  });
});
