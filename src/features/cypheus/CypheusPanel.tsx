import { useEffect } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CypheusChat } from './CypheusChat';
import { useCypheusStore } from './store/cypheus.store';
import { useLayoutPrefsStore } from '@/features/layout-prefs/layout-prefs.store';
import { runGreeting } from './script/greeting.script';
import { strings } from '@/i18n/en';

/**
 * Cypheus left panel — one-way intro surface until real AI ships.
 *
 * - Expanded (~400px): title + collapse toggle + greeting bubbles.
 * - Collapsed (~48px): just the collapse toggle anchored to the left.
 *
 * Width is owned by `--layout-left-panel` (driven by BuilderPage), so
 * the canvas + drawer overlay reflow consistently.
 */
export function CypheusPanel() {
  const collapsed = useLayoutPrefsStore((s) => s.leftPanelCollapsed);
  const toggleCollapse = useLayoutPrefsStore((s) => s.toggleLeftPanel);

  const messages = useCypheusStore((s) => s.messages);

  // Auto-run greeting on first render with empty chat.
  useEffect(() => {
    if (messages.length === 0) {
      void runGreeting();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TooltipProvider delayDuration={collapsed ? 100 : 250}>
      <aside
        className={cn(
          'card-coin98 flex h-full flex-shrink-0 flex-col',
          'transition-[width] duration-fast ease-out-quick',
        )}
        style={{ width: 'var(--layout-left-panel)' }}
        aria-label="Cypheus assistant panel"
      >
        <header
          className={cn(
            'flex items-center',
            collapsed
              ? 'justify-center px-1.5 py-3'
              : 'justify-between gap-2 px-4 py-3',
          )}
        >
          {!collapsed && (
            <h2 className="truncate text-xs font-semibold uppercase tracking-wider text-fg-muted">
              {strings.cypheus.panelTitle}
            </h2>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleCollapse}
                aria-label={
                  collapsed
                    ? strings.layoutToggles.cypheusShowAria
                    : strings.layoutToggles.cypheusHideAria
                }
                aria-expanded={!collapsed}
                className={cn(
                  'inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-fg-muted',
                  'transition-colors duration-fast hover:bg-[#1a1a1f] hover:text-fg',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                )}
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed
                ? strings.layoutToggles.cypheusShowTooltip
                : strings.layoutToggles.cypheusHideTooltip}
            </TooltipContent>
          </Tooltip>
        </header>

        {!collapsed && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <CypheusChat />
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
