import { describe, it, expect } from 'vitest';
import { translateExit } from '../translators/close-method';
import type { CloseMethodForm } from '@/types/builder.types';

function roiClose(steps: { minutes: number; roi: number }[]): CloseMethodForm {
  return {
    type: 'roi',
    tpEnabled: false,
    tpLevels: [],
    slEnabled: false,
    slValue: -3,
    trailingEnabled: false,
    trailingPositive: 1,
    trailingOffset: 1.5,
    roiSteps: steps,
    exitConditions: { groupConnector: 'AND', groups: [] },
  };
}

describe('translateExit — ROI', () => {
  // B1: roi is a percentage in builder state — the summary must NOT ×100.
  it('shows the percentage directly (1.5 → 1.5% target, not 150%)', () => {
    const res = translateExit(roiClose([{ minutes: 0, roi: 1.5 }]), 'long', []);
    const text = JSON.stringify(res);
    expect(text).toContain('1.5% target');
    expect(text).not.toContain('150');
  });

  it('formats sub-1% targets with 2 decimals (0.5 → 0.50%)', () => {
    const res = translateExit(roiClose([{ minutes: 0, roi: 0.5 }]), 'long', []);
    expect(JSON.stringify(res)).toContain('0.50% target');
  });

  it('renders a 0 step as break-even', () => {
    const res = translateExit(roiClose([{ minutes: 60, roi: 0 }]), 'long', []);
    expect(JSON.stringify(res)).toContain('break-even');
  });
});
