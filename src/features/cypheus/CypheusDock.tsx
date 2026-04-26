import { useMemo } from 'react';
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
  const cypheusState = useCypheusStore((s) => s.state);
  const activeStepId = useCypheusStore((s) => s.cypheusActiveStepId);
  const stepStatus = useBuilderStore((s) => s.stepStatus);
  const totalSteps = 4;

  // Always reflect actual configured count — works for both Cypheus magic build
  // and manual user setup.
  const completedSteps = useMemo(() => {
    return STEP_ORDER.filter((id) => stepStatus[id] === 'configured').length;
  }, [stepStatus]);

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

  return (
    <AnimatePresence>
      {phase === 'active' && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className={styles.wrapper}
        >
          <div className={styles.progressDots} aria-hidden="true">
            {Array.from({ length: totalSteps }).map((_, i) => {
              const isCompleted = i < completedSteps;
              return (
                <motion.span
                  key={i}
                  className={cn(styles.dot, isCompleted && styles.dotFilled)}
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
              <CypheusAvatar size="lg" layoutId="cypheus-avatar" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
