import { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useCypheusStore } from './store/cypheus.store';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { CypheusAvatar } from './CypheusAvatar';
import type { StepId } from '@/types/builder.types';
import styles from './CypheusDock.module.css';

const BUILDING_TEXT: Record<StepId, string> = {
  'bot-config': 'Configuring bot…',
  'entry-strategy': 'Defining entry conditions…',
  'direction': 'Setting direction & order…',
  'close-method': 'Configuring exit method…',
};

const STEP_ORDER: StepId[] = [
  'bot-config',
  'entry-strategy',
  'direction',
  'close-method',
];

export function CypheusDock() {
  const phase = useCypheusStore((s) => s.phase);
  const setPhase = useCypheusStore((s) => s.setPhase);
  const cypheusState = useCypheusStore((s) => s.state);
  const activeStepId = useCypheusStore((s) => s.cypheusActiveStepId);
  const stepStatus = useBuilderStore((s) => s.stepStatus);
  const openStep = useBuilderStore((s) => s.openStep);
  const totalSteps = 4;

  // Always reflect actual configured count — works for both Cypheus magic build
  // and manual user setup.
  const completedSteps = useMemo(() => {
    return STEP_ORDER.filter((id) => stepStatus[id] === 'configured').length;
  }, [stepStatus]);

  // Index of the step currently being configured (Cypheus pinned step takes
  // priority; otherwise whichever step the user has opened manually). −1 when
  // nothing is active.
  const activeIndex = useMemo(() => {
    const id = activeStepId ?? openStep;
    if (!id) return -1;
    return STEP_ORDER.indexOf(id);
  }, [activeStepId, openStep]);

  const allDone = completedSteps === totalSteps;

  const statusText = useMemo(() => {
    if (cypheusState === 'thinking') return 'Thinking…';
    if (cypheusState === 'building') {
      return activeStepId ? BUILDING_TEXT[activeStepId] : 'Building…';
    }
    if (allDone) return 'All set – ready to export';
    if (completedSteps === 0) return 'Set up your bot to get started';
    return `${completedSteps} of ${totalSteps} steps configured`;
  }, [cypheusState, activeStepId, completedSteps, allDone, totalSteps]);

  // Auto-dismiss the dock 3s after the user finishes configuring all
  // four steps and the build is no longer in flight. If the user opens a
  // step manually during the grace window (which un-completes them) the
  // condition flips back and the timer is cleared. Keeping the dock
  // around for ~3s lets the celebratory "All set – ready to export"
  // status text register before it disappears.
  useEffect(() => {
    if (phase !== 'active') return;
    if (!allDone) return;
    if (cypheusState === 'thinking' || cypheusState === 'building') return;
    const t = window.setTimeout(() => setPhase('idle'), 3000);
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
    // wrapper bottom: 32px is set in CypheusDock.module.css. Add it so the
    // canvas's content stops 32px above the dock instead of touching it.
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
          // Slight delay so the Step 1 anchor finishes fading out (~180ms)
          // before the dock fades in. Avoids the cross-fade ghost where
          // both avatars are visible at once.
          transition={{ duration: 0.28, ease: 'easeOut', delay: 0.18 }}
          className={styles.wrapper}
        >
          <div className={styles.progressDots} aria-hidden="true">
            {Array.from({ length: totalSteps }).map((_, i) => {
              const isCompleted = i < completedSteps;
              const isActive = !isCompleted && i === activeIndex;
              return (
                <motion.span
                  key={i}
                  className={cn(
                    styles.dot,
                    isCompleted && styles.dotFilled,
                    isActive && styles.dotActive,
                  )}
                  animate={i === completedSteps - 1 ? { scale: [1, 1.2, 1] } : { scale: 1 }}
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
