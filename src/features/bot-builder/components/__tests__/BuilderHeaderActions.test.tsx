import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BuilderHeaderActions } from '../BuilderHeaderActions';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useExportDialogStore } from '@/features/export-import/export-dialog.store';

// The dialogs have their own tests; stub them so this test isolates the action
// cluster's logic (disabled state, issue badge, keyboard wiring).
vi.mock('@/features/export-import/ExportDialog', () => ({
  ExportDialog: ({ open }: { open: boolean }) => (
    <div data-testid="export-dialog">
      {open ? 'EXPORT_OPEN' : 'EXPORT_CLOSED'}
    </div>
  ),
}));
vi.mock('@/features/export-import/ImportDialog', () => ({
  ImportDialog: ({ open }: { open: boolean }) => (
    <div data-testid="import-dialog">
      {open ? 'IMPORT_OPEN' : 'IMPORT_CLOSED'}
    </div>
  ),
}));

function renderActions() {
  return render(
    <MemoryRouter>
      <BuilderHeaderActions />
    </MemoryRouter>,
  );
}

describe('BuilderHeaderActions', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
    useExportDialogStore.setState({ open: false });
  });

  it('renders the "New" reset button', () => {
    renderActions();
    expect(screen.getByRole('button', { name: /^New$/i })).toBeInTheDocument();
  });

  it('disables Create bot while the builder is invalid', () => {
    renderActions();
    expect(screen.getByRole('button', { name: /create bot/i })).toBeDisabled();
  });

  it('opens the Import dialog on Ctrl+I', () => {
    renderActions();
    expect(screen.getByTestId('import-dialog')).toHaveTextContent(
      'IMPORT_CLOSED',
    );
    fireEvent.keyDown(window, { key: 'i', ctrlKey: true });
    expect(screen.getByTestId('import-dialog')).toHaveTextContent(
      'IMPORT_OPEN',
    );
  });

  it('does not open Export on Ctrl+E while the builder is invalid', () => {
    renderActions();
    fireEvent.keyDown(window, { key: 'e', ctrlKey: true });
    expect(screen.getByTestId('export-dialog')).toHaveTextContent(
      'EXPORT_CLOSED',
    );
  });
});
