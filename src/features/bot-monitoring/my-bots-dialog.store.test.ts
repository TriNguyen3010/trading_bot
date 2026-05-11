import { describe, it, expect, beforeEach } from 'vitest';
import { useMyBotsDialogStore } from './my-bots-dialog.store';

describe('useMyBotsDialogStore', () => {
  beforeEach(() => {
    useMyBotsDialogStore.setState({ open: false });
  });

  it('starts closed', () => {
    expect(useMyBotsDialogStore.getState().open).toBe(false);
  });

  it('setOpen(true) opens the dialog', () => {
    useMyBotsDialogStore.getState().setOpen(true);
    expect(useMyBotsDialogStore.getState().open).toBe(true);
  });

  it('setOpen(false) closes the dialog', () => {
    useMyBotsDialogStore.setState({ open: true });
    useMyBotsDialogStore.getState().setOpen(false);
    expect(useMyBotsDialogStore.getState().open).toBe(false);
  });
});
