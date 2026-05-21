import { useEffect, useState } from 'react';
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
  const [seenMessageCount, setSeenMessageCount] = useState(0);
  const unreadCount = collapsed
    ? Math.max(0, messages.length - seenMessageCount)
    : 0;

  // Auto-run greeting on first render with empty chat.
  useEffect(() => {
    if (messages.length === 0) {
      void runGreeting();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!collapsed) {
      setSeenMessageCount(messages.length);
    }
  }, [collapsed, messages.length]);

  return (
    <TooltipProvider delayDuration={collapsed ? 100 : 250}>
      <aside
        className={cn(
          'card-coin98 relative z-20 flex h-full flex-shrink-0 flex-col overflow-hidden rounded-3xl',
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
            <div className="flex items-center gap-2 truncate">
              <h2 className="truncate text-xs font-semibold uppercase tracking-wider text-fg-muted">
                {strings.cypheus.panelTitle}
              </h2>
              <span
                data-pill="coming-soon"
                className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand"
              >
                {strings.cypheus.comingSoonPill}
              </span>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleCollapse}
                aria-label={
                  collapsed
                    ? unreadCount > 0
                      ? `${strings.layoutToggles.cypheusShowAria} (${unreadCount} unread)`
                      : strings.layoutToggles.cypheusShowAria
                    : strings.layoutToggles.cypheusHideAria
                }
                aria-expanded={!collapsed}
                className={cn(
                  'relative inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-fg-muted',
                  'transition-colors duration-fast hover:bg-[#1a1a1f] hover:text-fg',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                )}
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
                )}
                {unreadCount > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border border-black bg-bearish shadow-[0_0_0_2px_rgba(246,70,93,0.18)]"
                  />
                ) : null}
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
