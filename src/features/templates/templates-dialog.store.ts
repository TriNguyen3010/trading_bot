/**
 * Shared state for the templates UI:
 *   - `open`     — gallery dialog open/closed.
 *   - `detailId` — id of the template currently shown in the
 *                  TemplateDetailModal, or `null` when no preview is up.
 *
 * Same pattern as `useExportDialogStore` — multiple entry points (empty
 * state CTA, HeaderToolbar button, AppliedTemplateBadge "Based on…" link,
 * future deeplinks) all flip the same switches.
 */
import { create } from 'zustand';

interface TemplatesDialogStore {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Id of the template whose detail modal is open, or `null`. */
  detailId: string | null;
  openDetail: (id: string) => void;
  closeDetail: () => void;
}

export const useTemplatesDialogStore = create<TemplatesDialogStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  detailId: null,
  openDetail: (detailId) => set({ detailId }),
  closeDetail: () => set({ detailId: null }),
}));
