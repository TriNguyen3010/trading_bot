import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HeaderToolbar } from '../HeaderToolbar';
import { useLayoutPrefsStore } from '@/features/layout-prefs/layout-prefs.store';

function renderToolbar() {
  return render(
    <MemoryRouter>
      <HeaderToolbar />
    </MemoryRouter>,
  );
}

describe('HeaderToolbar · summary mode toggle', () => {
  beforeEach(() => {
    useLayoutPrefsStore.setState({ summaryMode: 'visual' });
  });

  it('renders a button to switch to narrative mode when in visual mode', () => {
    renderToolbar();
    expect(
      screen.getByRole('button', { name: /switch to narrative summary/i }),
    ).toBeInTheDocument();
  });

  it('clicking the toggle flips the persisted mode', async () => {
    renderToolbar();
    const btn = screen.getByRole('button', { name: /switch to narrative summary/i });
    fireEvent.click(btn);
    expect(useLayoutPrefsStore.getState().summaryMode).toBe('narrative');
    expect(
      screen.getByRole('button', { name: /switch to visual summary/i }),
    ).toBeInTheDocument();
  });
});
