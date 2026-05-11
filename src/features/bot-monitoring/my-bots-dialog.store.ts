import { create } from 'zustand';

interface MyBotsDialogStore {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useMyBotsDialogStore = create<MyBotsDialogStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
