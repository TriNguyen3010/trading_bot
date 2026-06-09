import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SummaryModeToggle } from '../SummaryModeToggle';
import { useLayoutPrefsStore } from '@/features/layout-prefs/layout-prefs.store';

describe('SummaryModeToggle', () => {
  beforeEach(() => {
    useLayoutPrefsStore.setState({
      summaryMode: 'visual',
      summaryHintUnseen: false,
    });
  });

  it('renders a button to switch to narrative mode when in visual mode', () => {
    render(<SummaryModeToggle />);
    expect(
      screen.getByRole('button', { name: /switch to narrative summary/i }),
    ).toBeInTheDocument();
  });

  it('clicking the toggle flips the persisted mode', () => {
    render(<SummaryModeToggle />);
    const btn = screen.getByRole('button', {
      name: /switch to narrative summary/i,
    });
    fireEvent.click(btn);
    expect(useLayoutPrefsStore.getState().summaryMode).toBe('narrative');
    expect(
      screen.getByRole('button', { name: /switch to visual summary/i }),
    ).toBeInTheDocument();
  });

  it('shows a notify dot when the text-view hint is unseen', () => {
    useLayoutPrefsStore.setState({ summaryHintUnseen: true });
    const { container } = render(<SummaryModeToggle />);
    expect(
      container.querySelector('[data-testid="summary-hint-dot"]'),
    ).toBeInTheDocument();
  });

  it('hides the notify dot once the hint has been seen', () => {
    useLayoutPrefsStore.setState({ summaryHintUnseen: false });
    const { container } = render(<SummaryModeToggle />);
    expect(
      container.querySelector('[data-testid="summary-hint-dot"]'),
    ).not.toBeInTheDocument();
  });

  it('clicking the toggle clears the notify dot', () => {
    useLayoutPrefsStore.setState({ summaryHintUnseen: true });
    render(<SummaryModeToggle />);
    fireEvent.click(
      screen.getByRole('button', { name: /switch to narrative summary/i }),
    );
    expect(useLayoutPrefsStore.getState().summaryHintUnseen).toBe(false);
  });
});
