import { useEffect } from 'react';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';

/**
 * Global keyboard shortcuts for the builder. Bound once in BuilderPage.
 *
 * - Esc → close any open drawer
 *
 * The Ctrl+/ and Ctrl+J tab toggles are gone — the left panel no longer
 * has tabs (JSON moved into the Export dialog; chat is the only section).
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (e.key === 'Escape' && !isTyping) {
        const open = useBuilderStore.getState().openStep;
        if (open) {
          e.preventDefault();
          useBuilderStore.getState().setOpenStep(null);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
