/**
 * Shared open/close state for the templates gallery so the empty-state
 * CTA on the canvas, the HeaderToolbar "Templates" button, and any
 * future entry point (Cypheus chat command, deeplink) all hit the same
 * switch — same pattern as `useExportDialogStore`.
 */
import { create } from 'zustand';

interface TemplatesDialogStore {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useTemplatesDialogStore = create<TemplatesDialogStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
