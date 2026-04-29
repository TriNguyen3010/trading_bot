import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { ArrowDown } from 'lucide-react';
import { LayoutGroup } from 'framer-motion';
import { CypheusPanel } from '@/features/cypheus/CypheusPanel';
import { HeaderToolbar } from '@/features/bot-builder/components/HeaderToolbar';
import { CypheusDock } from '@/features/cypheus/CypheusDock';
import { BotBuilderCanvas } from '@/features/bot-builder/BotBuilderCanvas';
import { DotGridSpotlight } from '@/features/fx/DotGridSpotlight';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export function BuilderPage() {
  useKeyboardShortcuts();
  const allPending = useBuilderStore((s) =>
    Object.values(s.stepStatus).every((status) => status === 'pending'),
  );
  const openStep = useBuilderStore((s) => s.openStep);
  const drawerWidth = useBuilderStore((s) => s.drawerWidth);
  const cypheusDrawerMode = useCypheusStore((s) => s.drawerMode);

  const drawerVisible = openStep !== null || cypheusDrawerMode !== 'closed';

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--drawer-width',
      drawerVisible ? `${drawerWidth}px` : '0px',
    );
  }, [drawerVisible, drawerWidth]);

  // `--dock-height` is owned by <CypheusDock> via ResizeObserver — it knows
  // its own measured height. The canvas just reads the CSS var below.

  return (
    <div className="flex h-screen w-screen flex-col bg-canvas text-fg">
      <HeaderToolbar />
      <div className="flex flex-1 overflow-hidden">
        <CypheusPanel />
        <DotGridSpotlight
          className="fixed pointer-events-none z-0"
          style={{
            top: 'var(--layout-header)',
            left: 'var(--layout-left-panel)',
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
                transition: 'padding-bottom 250ms cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
            >
              {allPending ? (
                <div className="mx-auto mb-6 flex max-w-[var(--layout-step-list)] flex-col items-center gap-2 text-fg-muted">
                  <p className="text-sm">
                    Send a message to Cypheus, or click any step below to start
                    building.
                  </p>
                  <ArrowDown className="h-4 w-4 animate-bounce" />
                </div>
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
          className: 'border border-border bg-surface-elevated text-fg',
        }}
      />
    </div>
  );
}
