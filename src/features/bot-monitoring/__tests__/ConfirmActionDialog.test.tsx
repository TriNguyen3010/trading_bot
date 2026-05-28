import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmActionDialog } from '../ConfirmActionDialog';

describe('ConfirmActionDialog', () => {
  it('renders title/body and fires onConfirm when user clicks confirm', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmActionDialog
        open
        onOpenChange={onOpenChange}
        title="Stop bot?"
        body="The bot will stop placing orders immediately."
        confirmLabel="Stop"
        variant="destructive"
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByText('Stop bot?')).toBeInTheDocument();
    expect(screen.getByText(/will stop placing orders/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancel closes without calling onConfirm', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmActionDialog
        open
        onOpenChange={onOpenChange}
        title="Delete bot?"
        body="This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows a loading spinner state when busy=true and disables confirm', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmActionDialog
        open
        onOpenChange={() => {}}
        title="Stop bot?"
        body=""
        confirmLabel="Stop"
        variant="destructive"
        onConfirm={onConfirm}
        busy
      />,
    );
    const btn = screen.getByRole('button', { name: /stop/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
