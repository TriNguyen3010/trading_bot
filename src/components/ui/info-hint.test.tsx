import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InfoHint } from './info-hint';

describe('InfoHint', () => {
  it('renders a trigger button with the default aria-label', () => {
    render(<InfoHint text="Some explanatory note" />);
    expect(
      screen.getByRole('button', { name: 'More info' }),
    ).toBeInTheDocument();
  });

  it('uses a custom aria-label when provided', () => {
    render(<InfoHint text="x" label="Win rate help" />);
    expect(
      screen.getByRole('button', { name: 'Win rate help' }),
    ).toBeInTheDocument();
  });
});
