import { useEffect } from 'react';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';

/**
 * Global keyboard shortcuts for the builder. Bound once in BuilderPage.
 *
 * - Ctrl+/  → switch left panel to Cypheus tab
 * - Ctrl+J  → switch left panel to JSON tab
 * - Esc     → close any open drawer
 *
 * We deliberately ignore Ctrl+E (export) and Ctrl+I (import) here because
 * those flows arrive in M3.
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

      // Tab toggles ignore typing context — they should always work.
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '/') {
          e.preventDefault();
          useCypheusStore.getState().setPanelTab('cypheus');
          return;
        }
        if (e.key.toLowerCase() === 'j') {
          e.preventDefault();
          useCypheusStore.getState().setPanelTab('json');
          return;
        }
      }

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
