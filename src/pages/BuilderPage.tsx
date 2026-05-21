import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { ArrowDown, BookOpen } from 'lucide-react';
import { LayoutGroup, motion } from 'framer-motion';
import { dropInItem, dropInStagger } from '@/lib/motion';
import { CypheusPanel } from '@/features/cypheus/CypheusPanel';
import { HeaderToolbar } from '@/features/bot-builder/components/HeaderToolbar';
import { CypheusDock } from '@/features/cypheus/CypheusDock';
import { BotBuilderCanvas } from '@/features/bot-builder/BotBuilderCanvas';
import { DotGridSpotlight } from '@/features/fx/DotGridSpotlight';
import { Button } from '@/components/ui/button';
import { TemplatesDialog } from '@/features/templates/TemplatesDialog';
import { useTemplatesDialogStore } from '@/features/templates/templates-dialog.store';
import { strings } from '@/i18n/en';
import {
  FIXED_DRAWER_WIDTH,
  useBuilderStore,
} from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import { useLayoutPrefsStore } from '@/features/layout-prefs/layout-prefs.store';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export function BuilderPage() {
  useKeyboardShortcuts();
  const allPending = useBuilderStore((s) =>
    Object.values(s.stepStatus).every((status) => status === 'pending'),
  );
  const openStep = useBuilderStore((s) => s.openStep);
  const drawerWidth = FIXED_DRAWER_WIDTH;
  const setTemplatesOpen = useTemplatesDialogStore((s) => s.setOpen);
  const leftPanelCollapsed = useLayoutPrefsStore((s) => s.leftPanelCollapsed);
  const phase = useCypheusStore((s) => s.phase);
  const setPhase = useCypheusStore((s) => s.setPhase);

  const drawerVisible = openStep !== null;

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--drawer-width',
      drawerVisible ? `${drawerWidth}px` : '0px',
    );
  }, [drawerVisible, drawerWidth]);

  // Sync the --layout-left-panel CSS var with the collapsed toggle.
  // IDE-style sidebar: collapsed state keeps a thin 48px strip visible
  // (the section icons rail) instead of hiding the panel entirely. The
  // canvas + DotGridSpotlight + drawer overlayClassName all reflow into
  // whatever space is left, without each component reading the prefs store.
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--layout-left-panel',
      leftPanelCollapsed ? '48px' : '400px',
    );
  }, [leftPanelCollapsed]);

  // Page-level catch-all: the first time any step opens (StepCard click,
  // Strategy card click, template-driven openStep change, etc.) the
  // Cypheus dock transitions from idle → active. The `phase === 'idle'`
  // guard makes the effect inert once we've advanced past idle, so
  // re-opening a step after `completed` does NOT flip back to active.
  useEffect(() => {
    if (openStep !== null && phase === 'idle') {
      setPhase('active');
    }
  }, [openStep, phase, setPhase]);

  // `--dock-height` is owned by <CypheusDock> via ResizeObserver — it knows
  // its own measured height. The canvas just reads the CSS var below.

  return (
    <div className="flex h-screen w-screen flex-col bg-black text-fg">
      {/* Page-level yellow halo (Coin98 brand glow) */}
      <div
        className="pointer-events-none fixed -top-20 left-1/2 z-0 h-[420px] w-[700px] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(240,185,11,0.12), transparent 70%)',
        }}
        aria-hidden="true"
      />
      <HeaderToolbar />
      <div className="flex flex-1 overflow-hidden">
        <CypheusPanel />
        <DotGridSpotlight
          className="pointer-events-none fixed z-0"
          style={{
            top: 0,
            left: 0,
            right: 'var(--drawer-width)',
            bottom: 0,
            transition: 'right 250ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
          dimmed={drawerVisible}
        />
        <LayoutGroup>
          <main
            className="relative z-10 flex-1 overflow-y-auto"
            style={{
              paddingRight: 'var(--drawer-width)',
              transition: 'padding-right 250ms cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
          >
            <div
              className="relative z-10 min-h-full px-6 py-10"
              style={{
                paddingBottom: 'calc(var(--dock-height, 0px) + 2.5rem)',
                transition:
                  'padding-bottom 250ms cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
            >
              {allPending ? (
                <motion.div
                  className="mx-auto mb-8 flex max-w-[var(--layout-step-list)] flex-col items-center gap-3 text-fg-muted"
                  variants={dropInStagger}
                  initial="hidden"
                  animate="visible"
                >
                  <motion.p variants={dropInItem} className="text-sm">
                    {strings.templates.emptyState.hint}
                  </motion.p>
                  <motion.div variants={dropInItem} className="inline-flex">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setTemplatesOpen(true)}
                      className="shadow-glow"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      {strings.templates.emptyState.cta}
                    </Button>
                  </motion.div>
                  <motion.div variants={dropInItem} className="inline-flex">
                    <ArrowDown className="mt-1 h-4 w-4 animate-bounce" />
                  </motion.div>
                </motion.div>
              ) : null}
              <BotBuilderCanvas />
            </div>
          </main>
          <CypheusDock />
        </LayoutGroup>
      </div>
      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          className: 'rounded-2xl card-coin98 text-fg shadow-2xl',
        }}
      />
      {/* Templates gallery — page-level mount so the empty-state CTA,
       * HeaderToolbar button, and any future entry point all share state. */}
      <TemplatesDialog />
    </div>
  );
}
