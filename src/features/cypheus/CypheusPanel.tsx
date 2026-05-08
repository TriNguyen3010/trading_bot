import { useEffect, type ReactNode } from 'react';
import {
  Braces,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CypheusChat } from './CypheusChat';
import { CypheusInput } from './CypheusInput';
import { CreateNewBotButton } from './CreateNewBotButton';
import { JsonLiveView } from './JsonLiveView';
import {
  useCypheusStore,
  type LeftPanelTab,
} from './store/cypheus.store';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useLayoutPrefsStore } from '@/features/layout-prefs/layout-prefs.store';
import { runGreeting } from './script/greeting.script';
import { runMagicBuild } from './script/magic-build.script';
import { strings } from '@/i18n/en';

/**
 * Cypheus left panel — IDE-style sidebar with two states:
 *
 * - Expanded (~400px): vertical section list (Cypheus + JSON) with
 *   labels next to icons; the active section's content fills the
 *   remaining space below.
 *
 * - Collapsed (~48px): same vertical section list but icon-only,
 *   anchored to the left edge so the panel never disappears entirely.
 *   Clicking a section icon both expands the panel AND switches to
 *   that section, mirroring VS Code / Linear / Notion sidebars.
 *
 * The width is owned by `--layout-left-panel` (driven by BuilderPage
 * based on the persisted `leftPanelCollapsed` flag), so the canvas /
 * spotlight / drawer overlay all reflow consistently.
 */
export function CypheusPanel() {
  const collapsed = useLayoutPrefsStore((s) => s.leftPanelCollapsed);
  const toggleCollapse = useLayoutPrefsStore((s) => s.toggleLeftPanel);
  const setCollapsed = useLayoutPrefsStore((s) => s.setLeftPanelCollapsed);

  const tab = useCypheusStore((s) => s.panelTab);
  const setTab = useCypheusStore((s) => s.setPanelTab);
  const state = useCypheusStore((s) => s.state);
  const messages = useCypheusStore((s) => s.messages);
  const pushMessage = useCypheusStore((s) => s.pushMessage);
  const setPhase = useCypheusStore((s) => s.setPhase);
  const jsonViewedAt = useCypheusStore((s) => s.jsonViewedAt);
  const lastSavedAt = useBuilderStore((s) => s.lastSavedAt);

  // Red dot on the JSON section when the user has unviewed builder
  // changes. Suppressed while the JSON section is the active one.
  const hasJsonUpdates =
    tab !== 'json' &&
    lastSavedAt !== null &&
    lastSavedAt > (jsonViewedAt ?? 0);

  // Auto-run greeting on first render with empty chat.
  useEffect(() => {
    if (state === 'idle' && messages.length === 0) {
      void runGreeting();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUserSubmit = (text: string) => {
    pushMessage({ role: 'user', text });
    if (state === 'building' || state === 'thinking') return;
    if (state === 'done') {
      pushMessage({ role: 'cypheus', text: strings.cypheus.afterDone });
      return;
    }
    setPhase('active');
    void runMagicBuild();
  };

  const inputDisabled = state === 'thinking' || state === 'building';

  /** Click handler shared by both states: switching sections while
   * collapsed also expands the panel so users immediately see the
   * content they just picked. */
  const handleSelectSection = (next: LeftPanelTab) => {
    setTab(next);
    if (collapsed) setCollapsed(false);
  };

  return (
    <TooltipProvider delayDuration={collapsed ? 100 : 250}>
      <aside
        className={cn(
          'flex h-full flex-shrink-0 flex-col bg-black',
          'transition-[width] duration-fast ease-out-quick',
        )}
        style={{ width: 'var(--layout-left-panel)' }}
        aria-label="Cypheus assistant panel"
      >
        {/* Header: panel title + collapse / expand chevron. When expanded
         * the title sits left and the chevron right; collapsed mode hides
         * the title and centres the chevron in the 48px strip. */}
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

        {/* Section list — vertical nav rail. Always visible (collapsed
         * just hides the labels). */}
        <nav
          aria-label="Panel sections"
          className={cn('flex flex-col gap-1', collapsed ? 'p-1.5' : 'p-2')}
        >
          <SectionItem
            id="cypheus"
            icon={Sparkles}
            label={strings.cypheus.tabLabel}
            active={tab === 'cypheus'}
            collapsed={collapsed}
            onClick={() => handleSelectSection('cypheus')}
          />
          <SectionItem
            id="json"
            icon={Braces}
            label={strings.cypheus.jsonTabLabel}
            active={tab === 'json'}
            collapsed={collapsed}
            onClick={() => handleSelectSection('json')}
            badge={hasJsonUpdates}
          />
        </nav>

        {/* Active section content — only when expanded. Collapsed strip
         * deliberately leaves no content space. */}
        {!collapsed && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {tab === 'cypheus' && <CypheusSectionBody
              onSubmit={handleUserSubmit}
              inputDisabled={inputDisabled}
            />}
            {tab === 'json' && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <JsonLiveView />
              </div>
            )}
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section item                                                                */
/* -------------------------------------------------------------------------- */

interface SectionItemProps {
  id: LeftPanelTab;
  icon: LucideIcon;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  badge?: boolean;
}

function SectionItem({
  id,
  icon: Icon,
  label,
  active,
  collapsed,
  onClick,
  badge,
}: SectionItemProps) {
  // The button itself is the trigger; the tooltip is only useful in
  // collapsed mode (where the label isn't visible). When expanded the
  // label is right next to the icon, so we drop the tooltip.
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? `Open ${label} section` : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-full text-sm font-medium',
        'transition-colors duration-fast ease-out-quick',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        collapsed
          ? 'mx-auto h-9 w-9 justify-center'
          : 'h-9 w-full justify-start px-4',
        active
          ? 'bg-brand text-black font-semibold shadow-[0_0_10px_rgba(240,185,11,0.35)]'
          : 'text-fg-secondary hover:bg-[#1a1a1f] hover:text-fg',
      )}
      data-section={id}
    >
      <Icon
        className={cn('h-4 w-4 flex-shrink-0', active && 'text-brand')}
        aria-hidden="true"
      />
      {!collapsed && <span>{label}</span>}
      {badge && (
        <span
          aria-label="Unviewed JSON changes"
          className={cn(
            'pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-bearish ring-2 ring-bearish/30 motion-safe:animate-pulse',
            collapsed ? 'right-1 top-1' : 'right-3 top-1/2 -translate-y-1/2',
          )}
        />
      )}
    </button>
  );

  if (!collapsed) return button;

  // Collapsed: wrap in a tooltip so users hover the icon and see the
  // section name. This is the equivalent of the expanded label.
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/* -------------------------------------------------------------------------- */
/*  Cypheus section body — chat + input + create-new-bot                       */
/* -------------------------------------------------------------------------- */

function CypheusSectionBody({
  onSubmit,
  inputDisabled,
}: {
  onSubmit: (text: string) => void;
  inputDisabled: boolean;
}): ReactNode {
  return (
    <>
      <CypheusChat />
      <div className="bg-black">
        <CypheusInput onSubmit={onSubmit} disabled={inputDisabled} />
        <div className="px-4 pb-3">
          <CreateNewBotButton />
        </div>
      </div>
    </>
  );
}
