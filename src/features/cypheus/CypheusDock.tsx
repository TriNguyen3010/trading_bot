import { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useCypheusStore } from './store/cypheus.store';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { CypheusAvatar } from './CypheusAvatar';
import {
  PHASE_IDS,
  configuredPhaseCount,
  stepIdToPhase,
  type PhaseId,
} from '@/lib/phase-helpers';
import styles from './CypheusDock.module.css';

/**
 * Per-phase building copy. The 4-step model used to map each sub-step to its
 * own message (e.g. "Setting direction & order…"); in the 2-phase model
 * Cypheus only pins twice — once for Bot Basics, once for Strategy — so we
 * collapse the 4 messages into 2 phase-level lines. See
 * Spec/Phase 1/two_phase_ui_plan.md §6.6.
 */
const BUILDING_PHASE_TEXT: Record<PhaseId, string> = {
  'bot-basics': 'Configuring bot…',
  strategy: 'Building your strategy…',
};

export function CypheusDock() {
  const phase = useCypheusStore((s) => s.phase);
  const setPhase = useCypheusStore((s) => s.setPhase);
  const cypheusState = useCypheusStore((s) => s.state);
  const activeStepId = useCypheusStore((s) => s.cypheusActiveStepId);
  const openStep = useBuilderStore((s) => s.openStep);
  const builderState = useBuilderStore();
  const totalPhases = PHASE_IDS.length; // 2

  // Configured-phase count (0/1/2) — works for both Cypheus magic build and
  // manual user setup.
  const completedPhases = useMemo(
    () => configuredPhaseCount(builderState),
    [builderState],
  );

  // Index of the phase currently being configured. Cypheus pinned step takes
  // priority; otherwise whichever step the user has opened manually.
  // −1 when nothing is active.
  const activeIndex = useMemo(() => {
    const id = activeStepId ?? openStep;
    if (!id) return -1;
    return PHASE_IDS.indexOf(stepIdToPhase(id));
  }, [activeStepId, openStep]);

  const allDone = completedPhases === totalPhases;

  const statusText = useMemo(() => {
    if (cypheusState === 'thinking') return 'Thinking…';
    if (cypheusState === 'building') {
      const id = activeStepId ?? openStep;
      const p = id ? stepIdToPhase(id) : null;
      return p ? BUILDING_PHASE_TEXT[p] : 'Building…';
    }
    if (allDone) return 'All set – ready to export';
    if (completedPhases === 0) return 'Set up your bot to get started';
    return `${completedPhases} of ${totalPhases} phases configured`;
  }, [cypheusState, activeStepId, openStep, completedPhases, allDone, totalPhases]);

  // Auto-dismiss the dock 3s after the user finishes configuring all phases
  // and the build is no longer in flight. We move to the 'completed' phase
  // (NOT 'idle') so subsequent step clicks don't bring the dock back — only
  // resetAll (Create new bot) returns to 'idle'. If the user opens a step
  // during the grace window the timer is cleared, but allDone stays true so
  // the timer re-arms on next render unless the user undoes a configuration.
  useEffect(() => {
    if (phase !== 'active') return;
    if (!allDone) return;
    if (cypheusState === 'thinking' || cypheusState === 'building') return;
    const t = window.setTimeout(() => setPhase('completed'), 3000);
    return () => window.clearTimeout(t);
  }, [phase, allDone, cypheusState, setPhase]);

  // Measure the dock's actual rendered height (progress dots + pill +
  // gaps) and expose it via the `--dock-height` CSS var so the canvas
  // can reserve exactly that much padding-bottom — independent of any
  // hardcoded buffer. ResizeObserver re-fires when the status text grows
  // shorter/longer or the drawer width changes the wrapper bounds.
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (phase !== 'active') {
      document.documentElement.style.setProperty('--dock-height', '0px');
      return;
    }
    const el = wrapperRef.current;
    if (!el) return;
    const BOTTOM_OFFSET = 32;
    const update = () => {
      const h = el.offsetHeight + BOTTOM_OFFSET;
      document.documentElement.style.setProperty('--dock-height', `${h}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.setProperty('--dock-height', '0px');
    };
  }, [phase]);

  return (
    <AnimatePresence>
      {phase === 'active' && (
        <motion.div
          ref={wrapperRef}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut', delay: 0.18 }}
          className={styles.wrapper}
        >
          <div className={styles.progressDots} aria-hidden="true">
            {Array.from({ length: totalPhases }).map((_, i) => {
              const isCompleted = i < completedPhases;
              const isActive = !isCompleted && i === activeIndex;
              return (
                <motion.span
                  key={i}
                  className={cn(
                    styles.dot,
                    isCompleted && styles.dotFilled,
                    isActive && styles.dotActive,
                  )}
                  animate={
                    i === completedPhases - 1
                      ? { scale: [1, 1.2, 1] }
                      : { scale: 1 }
                  }
                  transition={{ duration: 0.3 }}
                />
              );
            })}
          </div>

          <div className={styles.dock}>
            <span className="text-sm font-medium text-fg-secondary whitespace-nowrap">
              {statusText}
            </span>
            <div className="h-12 w-12 flex-shrink-0">
              <CypheusAvatar size="lg" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
