/**
 * Exit block: how the bot closes positions. Dispatches on
 * `closeMethod.type`:
 *
 *   - 'manual'    → "Manual exit only — bot keeps trades open until …"
 *   - 'tp_sl'     → TP levels (multi-tier), SL, optional trailing
 *   - 'roi'       → time-based ROI ladder
 *   - 'indicator' → reuses condition translator on exitConditions
 *
 * Returns lines + an optional block-level warning when the configured
 * exit is essentially a no-op (e.g. tp_sl picked but neither side enabled).
 */
import type {
  CloseMethodForm,
  Direction,
  RoiStep,
  TpLevel,
} from '@/types/builder.types';
import type { SummaryLine, TranslationGap } from '../types';
import { t, line } from '../types';
import { translateConditionGroup } from './condition';

export interface TranslateExitResult {
  lines: SummaryLine[];
  warning?: string;
}

export function translateExit(
  close: CloseMethodForm,
  direction: Direction,
  gaps: TranslationGap[],
): TranslateExitResult {
  switch (close.type) {
    case 'manual':
      return {
        lines: [
          line(
            t(
              'Manual exit only — bot keeps trades open until you close them by hand.',
            ),
          ),
        ],
      };

    case 'tp_sl':
      return translateTpSl(close, gaps);

    case 'roi':
      return translateRoi(close.roiSteps);

    case 'indicator':
      return translateIndicatorExit(close, direction, gaps);

    default: {
      const _exhaustive: never = close.type;
      void _exhaustive;
      return { lines: [line(t('Exit method not recognised.', 'warning'))] };
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  TP / SL                                                                    */
/* -------------------------------------------------------------------------- */

function translateTpSl(
  close: CloseMethodForm,
  gaps: TranslationGap[],
): TranslateExitResult {
  const lines: SummaryLine[] = [];
  let warning: string | undefined;

  const tpActive = close.tpEnabled && close.tpLevels.length > 0;
  const slActive = close.slEnabled;

  // No-op configuration.
  if (!tpActive && !slActive) {
    if (close.tpEnabled && close.tpLevels.length === 0) {
      gaps.push({
        section: 'exit',
        field: 'tpLevels',
        rawValue: '[]',
        reason: 'Take-profit enabled but no levels defined',
      });
    }
    return {
      lines: [line(t('No automated exits configured.', 'warning'))],
      warning: 'Neither take-profit nor stop-loss is active.',
    };
  }

  // Take-profit
  if (tpActive) {
    lines.push(...formatTpLevels(close.tpLevels));
  } else if (close.tpEnabled) {
    // Toggled on but empty — flag.
    gaps.push({
      section: 'exit',
      field: 'tpLevels',
      rawValue: '[]',
      reason: 'Take-profit enabled but no levels defined',
    });
    lines.push(
      line(
        t('Take-profit enabled but no levels set.', 'warning'),
      ),
    );
  }

  // Stop-loss
  if (slActive) {
    lines.push(
      line(
        t('Stop loss at '),
        t(`${close.slValue}%`, 'bearish'),
        t('.'),
      ),
    );
  }

  // Trailing — only render if it'll actually do something. Defensive
  // guard against `trailingPositive=0` (a default that means
  // effectively "off").
  if (close.trailingEnabled && close.trailingPositive > 0) {
    lines.push(
      line(
        t(
          `Trailing stop: activates after +${close.trailingPositive}% profit, follows ${close.trailingOffset}% behind.`,
        ),
      ),
    );
  }

  return { lines, warning };
}

function formatTpLevels(levels: TpLevel[]): SummaryLine[] {
  if (levels.length === 1) {
    const lvl = levels[0];
    const closeAmount =
      lvl.amount === 100
        ? 'closes the full position'
        : `closes ${lvl.amount}% of position`;
    return [
      line(
        t('Take profit at '),
        t(`+${lvl.profit}%`, 'bullish'),
        t(` (${closeAmount}).`),
      ),
    ];
  }

  // Multi-tier: render as "Take profit: +5% closes 50%, +10% closes 25%."
  const inlines = [t('Take profit: ')];
  levels.forEach((lvl, idx) => {
    if (idx > 0) inlines.push(t(', '));
    inlines.push(t(`+${lvl.profit}%`, 'bullish'));
    inlines.push(t(` closes ${lvl.amount}%`));
  });
  inlines.push(t('.'));
  return [inlines];
}

/* -------------------------------------------------------------------------- */
/*  ROI ladder                                                                 */
/* -------------------------------------------------------------------------- */

function translateRoi(roiSteps: RoiStep[]): TranslateExitResult {
  if (roiSteps.length === 0) {
    return {
      lines: [
        line(
          t(
            'Time-based ROI exit — no steps defined yet.',
            'warning',
          ),
        ),
      ],
      warning: 'ROI exit method picked but no steps configured.',
    };
  }

  const sorted = [...roiSteps].sort((a, b) => a.minutes - b.minutes);
  const stepDescs = sorted.map((s) => {
    const time = s.minutes === 0 ? 'immediately' : `after ${humanMinutes(s.minutes)}`;
    if (s.roi === 0) return `break-even ${time}`;
    // ROI is a ratio (0.005 = 0.5%). Show as percentage.
    const pct = (s.roi * 100).toFixed(s.roi < 0.01 && s.roi > 0 ? 2 : 1);
    return `${pct}% target ${time}`;
  });

  return {
    lines: [
      line(t(`Time-based ROI: ${stepDescs.join(', ')}.`)),
    ],
  };
}

function humanMinutes(m: number): string {
  if (m < 60) return `${m} min`;
  if (m % 60 === 0) {
    const hours = m / 60;
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  return `${hours}h ${mins}m`;
}

/* -------------------------------------------------------------------------- */
/*  Indicator-based exit                                                       */
/* -------------------------------------------------------------------------- */

function translateIndicatorExit(
  close: CloseMethodForm,
  direction: Direction,
  gaps: TranslationGap[],
): TranslateExitResult {
  if (close.exitConditions.conditions.length === 0) {
    return {
      lines: [
        line(
          t(
            'Indicator-based exit — no conditions defined yet.',
            'warning',
          ),
        ),
      ],
      warning: 'Indicator exit picked but no conditions configured.',
    };
  }

  // Reuse the entry condition translator. Verb depends on direction:
  // long position → "Sells when …"; short position → "Buys to cover when …".
  const verb = direction === 'long' ? 'Sells when' : 'Covers when';
  const lines = translateConditionGroup(close.exitConditions, {
    verb,
    emptyPhrase: 'Indicator-based exit (no conditions defined yet).',
    section: 'exit',
    gaps,
  });
  return { lines };
}
