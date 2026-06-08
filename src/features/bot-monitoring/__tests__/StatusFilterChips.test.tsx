import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusFilterChips } from '../StatusFilterChips';
import type { FilterCategory } from '../bot-filter';

const counts: Record<FilterCategory, number> = {
  all: 9,
  live: 3,
  'dry-run': 1,
  paused: 1,
  working: 2,
  attention: 2,
};

describe('StatusFilterChips', () => {
  it('renders every chip with its count', () => {
    render(
      <StatusFilterChips counts={counts} active="all" onChange={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /All\s*9/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Live\s*3/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Needs attention\s*2/ }),
    ).toBeInTheDocument();
  });

  it('fires onChange with the clicked category', () => {
    const onChange = vi.fn();
    render(
      <StatusFilterChips counts={counts} active="all" onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Working\s*2/ }));
    expect(onChange).toHaveBeenCalledWith('working');
  });

  it('disables a chip with zero count (except All)', () => {
    render(
      <StatusFilterChips
        counts={{ ...counts, attention: 0 }}
        active="all"
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: /Needs attention\s*0/ }),
    ).toBeDisabled();
  });
});
