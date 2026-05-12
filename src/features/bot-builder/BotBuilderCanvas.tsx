import { useEffect, useRef, type ReactNode } from 'react';
import { Sliders } from 'lucide-react';
import { StepCard } from './components/StepCard';
import { StepConnector } from './components/StepConnector';
import { StepDrawer, type StepContentMap } from './components/StepDrawer';
import { StrategyCard } from './components/StrategyCard';
import { StrategyDrawerContent } from './components/StrategyDrawerContent';
import { BotConfigDrawerContent } from './components/BotConfigDrawerContent';
import { AddStrategyButton } from './components/AddStrategyButton';
import { BotSummaryCard } from '@/features/bot-summary/BotSummaryCard';
import {
  BotConfigSetup,
  BotConfigConfigure,
} from './steps/BotConfigStep';
import { EntryStrategySetup } from './steps/EntryStrategyStep';
import { DirectionSetup } from './steps/DirectionStep';
import {
  CloseMethodSetup,
  CloseMethodConfigure,
} from './steps/CloseMethodStep';
import { useBuilderStore } from './store/builder.store';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import { configuredPhaseCount } from '@/lib/phase-helpers';
import { useLayoutPrefsStore } from '@/features/layout-prefs/layout-prefs.store';
import { cn } from '@/lib/utils';
import { strings } from '@/i18n/en';
import type { StepId } from '@/types/builder.types';

/* StepContentMap for StepDrawer's legacy 4-step path. The Strategy phase
 * (entry/direction/close-method) is rendered through `strategyCompositeContent`
 * instead, but we still populate `contentByStep` for those IDs because the
 * drawer header uses `content.title` for non-composite paths (e.g. when
 * `strategyCompositeContent` happens to be null in some future test). */
const CONTENT_BY_STEP: Record<StepId, StepContentMap> = {
  'bot-config': {
    setup: <BotConfigSetup />,
    configure: <BotConfigConfigure />,
    title: strings.phase.botBasics.title,
    description: strings.phase.botBasics.description,
    index: 1,
  },
  'entry-strategy': {
    setup: <EntryStrategySetup />,
    configure: null,
    title: strings.steps.entryStrategy.title,
    description: strings.steps.entryStrategy.description,
    index: 2,
  },
  direction: {
    setup: <DirectionSetup />,
    configure: null,
    title: strings.steps.direction.title,
    description: strings.steps.direction.description,
    index: 3,
  },
  'close-method': {
    setup: <CloseMethodSetup />,
    configure: <CloseMethodConfigure />,
    title: strings.steps.closeMethod.title,
    description: strings.steps.closeMethod.description,
    index: 4,
  },
};

/**
 * Replaces `StepList.tsx` for the 2-phase UI.
 *
 * Renders 2 phase cards:
 *   1. Phase 1 — BotBasics (a thin wrapper around StepCard with stepId='bot-config').
 *   2. Phase 2 — Strategy (composite, aggregates 3 sub-stepStatus IDs).
 *
 * The same `StepDrawer` is mounted once and dispatches between:
 *   - Legacy Setup/Configure tabs when activeStepId === 'bot-config'.
 *   - Composite StrategyDrawerContent when activeStepId ∈ STRATEGY_SUB_STEPS.
 *
 * See Spec/Phase 1/two_phase_ui_plan.md for the full architecture.
 */
export function BotBuilderCanvas() {
  const openStep = useBuilderStore((s) => s.openStep);
  const setOpenStep = useBuilderStore((s) => s.setOpenStep);
  const setStepStatus = useBuilderStore((s) => s.setStepStatus);
  const closeCypheusDrawer = useCypheusStore((s) => s.closeCypheusDrawer);
  const setPanelTab = useCypheusStore((s) => s.setPanelTab);
  const cypheusActiveStepId = useCypheusStore((s) => s.cypheusActiveStepId);
  // Full state read used to decide the canvas layout — `configuredPhaseCount`
  // recomputes whenever stepStatus changes so the layout flips between
  // single-column (pristine) and 2-column (configured) automatically.
  const builderState = useBuilderStore();

  // Same scroll-into-view pattern as the legacy StepList — keeps the
  // active card visible above the dock and below the header.
  const cardRefs = useRef<{ [k: string]: HTMLLIElement | null }>({});
  const activeStepId: StepId | null = cypheusActiveStepId ?? openStep;
  const activePhase = activeStepId
    ? activeStepId === 'bot-config'
      ? 'bot-basics'
      : 'strategy'
    : null;

  useEffect(() => {
    if (!activePhase) return;
    const el = cardRefs.current[activePhase];
    if (!el) return;
    const id = window.requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [activePhase]);

  useEffect(() => {
    if (!activePhase) return;
    const el = cardRefs.current[activePhase];
    if (!el) return;
    const ro = new ResizeObserver(() => {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [activePhase]);

  /* ─── Drawer save handlers ──────────────────────────────────────── */

  const closeManualDrawer = () => setOpenStep(null);

  /** Legacy 4-step Save (used only when openStep === 'bot-config' — Phase 1
   * still uses the wizard with Setup/Configure tabs). */
  const handleLegacySave = (_mode: 'save' | 'skip-save' | 'save-and-finish') => {
    if (!openStep) return;
    setStepStatus(openStep, 'configured');
    closeManualDrawer();
  };

  /** Save & Next from Phase 1 → routes user into Phase 2 by opening the
   * composite Strategy drawer. */
  const handleLegacySaveAndNext = () => {
    if (!openStep) return;
    setStepStatus(openStep, 'configured');
    if (openStep === 'bot-config') {
      setOpenStep('entry-strategy'); // composite Strategy drawer
    } else {
      closeManualDrawer();
    }
  };

  /** Composite Save: marks all 3 strategy sub-stepStatus = configured in a
   * single batch (still 3 store writes, but to the user it feels atomic). */
  const handleCompositeSave = () => {
    setStepStatus('entry-strategy', 'configured');
    setStepStatus('direction', 'configured');
    setStepStatus('close-method', 'configured');
    closeManualDrawer();
  };

  /** hasNext = the wizard's "Save & Next" routes into composite Strategy.
   * For the composite Strategy itself there's no further phase — wizard
   * footer never renders there since composite mode owns its own footer. */
  const hasNext = openStep === 'bot-config';

  const handleSummaryDismiss = () => closeCypheusDrawer();
  const handleSummaryReviewJson = () => {
    closeCypheusDrawer();
    setPanelTab('json');
  };

  const compositeContent: ReactNode = (
    <StrategyDrawerContent
      onCancel={closeManualDrawer}
      onSave={handleCompositeSave}
    />
  );

  /** Phase 1 composite Save: merge Setup + Configure into a single Save —
   * mark the step configured and close the drawer. We intentionally do
   * NOT auto-open Phase 2 here; the wizard flow's "Save & Next" was a
   * legacy 4-step affordance. Users in the new 2-phase UI explicitly
   * click the Strategy card when they want to edit Phase 2. */
  const handleBotConfigCompositeSave = () => {
    setStepStatus('bot-config', 'configured');
    closeManualDrawer();
  };

  const botConfigCompositeContent: ReactNode = (
    <BotConfigDrawerContent
      onCancel={closeManualDrawer}
      onSave={handleBotConfigCompositeSave}
    />
  );

  // 2-column layout when at least one phase is configured AND the user
  // hasn't dismissed the summary. Same canvas reflows automatically when
  // they toggle either condition — pristine state OR a dismissed
  // summary collapses to single-column.
  const summaryHidden = useLayoutPrefsStore((s) => s.botSummaryHidden);
  const showSummaryBeside =
    configuredPhaseCount(builderState) > 0 && !summaryHidden;

  // Phase cards block — extracted so we can render it inside either
  // the single-column or 2-column wrapper without duplicating JSX.
  const phaseCardsBlock = (
    <ol className="space-y-0">
      {/* Phase 1 — Bot Basics */}
      <li
        ref={(el) => {
          cardRefs.current['bot-basics'] = el;
        }}
        className="group flex flex-col"
        style={{
          scrollMarginTop: 'calc(var(--layout-header) + 0.5rem)',
          scrollMarginBottom: 'calc(var(--dock-height, 0px) + 0.5rem)',
        }}
      >
        <StepCard
          stepId="bot-config"
          index={1}
          icon={Sliders}
          title={strings.phase.botBasics.title}
        />
        {/* Connector between Phase 1 and Phase 2 */}
        <StepConnector fromStep="bot-config" toStep="entry-strategy" />
      </li>

      {/* Phase 2 — Strategy (composite) */}
      <li
        ref={(el) => {
          cardRefs.current['strategy'] = el;
        }}
        className="group flex flex-col gap-3"
        style={{
          scrollMarginTop: 'calc(var(--layout-header) + 0.5rem)',
          scrollMarginBottom: 'calc(var(--dock-height, 0px) + 0.5rem)',
        }}
      >
        <StrategyCard />
        <AddStrategyButton />
      </li>
    </ol>
  );

  return (
    <div
      className={cn(
        'mx-auto w-full',
        showSummaryBeside
          ? // Two-column: summary on the LEFT, phase cards on the RIGHT.
            // Phase cards keep their fixed step-list width so their visual
            // identity is unchanged; summary takes whatever's left up to
            // ~480px. Stacks vertically below the `lg` breakpoint so on
            // narrower viewports cards remain readable.
            'max-w-[1080px] grid grid-cols-1 gap-6 items-start lg:grid-cols-[minmax(280px,480px)_var(--layout-step-list)]'
          : // Single column centred — current behaviour for pristine state.
            'flex flex-col max-w-[var(--layout-step-list)]',
      )}
    >
      {showSummaryBeside && (
        <aside
          aria-label="Bot summary sidebar"
          // Sticky so the summary stays visible while the user scrolls
          // through the (potentially tall) phase column on the right.
          // Only sticks at lg+ since below that we stack vertically.
          className="lg:sticky lg:top-[calc(var(--layout-header)+1rem)]"
        >
          <BotSummaryCard />
        </aside>
      )}

      <div>
        {phaseCardsBlock}
      </div>

      <StepDrawer
        contentByStep={CONTENT_BY_STEP}
        onManualClose={closeManualDrawer}
        onManualSave={handleLegacySave}
        onManualSaveAndNext={handleLegacySaveAndNext}
        hasNext={hasNext}
        onSummaryDismiss={handleSummaryDismiss}
        onSummaryReviewJson={handleSummaryReviewJson}
        strategyCompositeContent={compositeContent}
        strategyHeader={{
          title: strings.strategyDrawer.title,
          description: strings.strategyDrawer.description,
        }}
        botConfigCompositeContent={botConfigCompositeContent}
        botConfigHeader={{
          title: strings.botConfigDrawer.title,
          description: strings.botConfigDrawer.description,
        }}
      />
    </div>
  );
}
