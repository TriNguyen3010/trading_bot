import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StrategySection } from './StrategySection';

describe('StrategySection', () => {
  it('renders the title and child body when defaultOpen', () => {
    render(
      <StrategySection title="Capital" defaultOpen>
        <div data-testid="child">body</div>
      </StrategySection>,
    );
    expect(screen.getByText('Capital')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('hides the child body when toggled closed', () => {
    render(
      <StrategySection title="Capital" defaultOpen>
        <div data-testid="child">body</div>
      </StrategySection>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Capital/i }));
    expect(screen.queryByTestId('child')).not.toBeInTheDocument();
  });

  it('shows "{n} fields" hint next to the chevron when collapsed and fieldCount is provided', () => {
    render(
      <StrategySection title="Capital" fieldCount={7} defaultOpen={false}>
        <div>body</div>
      </StrategySection>,
    );
    expect(screen.getByText('7 fields')).toBeInTheDocument();
  });

  it('uses singular "1 field" when fieldCount is exactly 1', () => {
    render(
      <StrategySection title="Name" fieldCount={1} defaultOpen={false}>
        <div>body</div>
      </StrategySection>,
    );
    expect(screen.getByText('1 field')).toBeInTheDocument();
    expect(screen.queryByText('1 fields')).not.toBeInTheDocument();
  });

  it('hides the field count when the section is open (fields are visible)', () => {
    render(
      <StrategySection title="Capital" fieldCount={7} defaultOpen>
        <div>body</div>
      </StrategySection>,
    );
    expect(screen.queryByText(/7 fields/i)).not.toBeInTheDocument();
  });

  it('renders no count badge at all when fieldCount is undefined', () => {
    render(
      <StrategySection title="Mystery" defaultOpen={false}>
        <div>body</div>
      </StrategySection>,
    );
    expect(screen.queryByText(/\d+ fields?$/)).not.toBeInTheDocument();
  });
});
