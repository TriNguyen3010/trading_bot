import type { Variants } from 'framer-motion';

// Shared "drop down on mount" stagger for header/toolbar/empty-state clusters.
// Distance + duration kept small so the effect reads as ambient delight rather
// than something the user has to wait through on every navigation.
export const dropInStagger: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

export const dropInItem: Variants = {
  hidden: { y: -10, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] },
  },
};
