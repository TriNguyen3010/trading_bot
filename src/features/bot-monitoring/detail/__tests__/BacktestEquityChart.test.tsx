import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BacktestEquityChart } from '../BacktestEquityChart';

describe('BacktestEquityChart', () => {
  it('renders an svg path for the curve', () => {
    const { container } = render(
      <BacktestEquityChart curve={[-3.5, -1.5, 0.9, -2]} />,
    );
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBeGreaterThanOrEqual(2); // area + line
  });
  it('renders nothing for empty/too-short curve', () => {
    const { container } = render(<BacktestEquityChart curve={[]} />);
    expect(container.querySelector('path')).toBeNull();
  });

  it('keeps the zero baseline inside the viewport for an all-positive curve', () => {
    const { container } = render(
      <BacktestEquityChart curve={[5, 12, 20, 33]} />,
    );
    const zeroLine = container.querySelector('line');
    expect(zeroLine).not.toBeNull();
    const y1 = Number(zeroLine!.getAttribute('y1'));
    // viewBox height is 150 — the zero line must not fall outside it.
    expect(y1).toBeGreaterThanOrEqual(0);
    expect(y1).toBeLessThanOrEqual(150);
  });
});
