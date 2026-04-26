import { create } from 'zustand';

interface ExportDialogStore {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useExportDialogStore = create<ExportDialogStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
