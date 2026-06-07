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
});
