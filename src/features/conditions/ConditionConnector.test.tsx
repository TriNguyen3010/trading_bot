import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConditionConnector } from './ConditionConnector';

describe('ConditionConnector', () => {
  it('renders both AND and OR labels', () => {
    render(<ConditionConnector operator="AND" onChange={() => {}} />);
    expect(screen.getByText('AND')).toBeInTheDocument();
    expect(screen.getByText('OR')).toBeInTheDocument();
  });

  it('highlights AND when operator is AND', () => {
    render(<ConditionConnector operator="AND" onChange={() => {}} />);
    const andBtn = screen.getByRole('button', { name: 'AND' });
    expect(andBtn).toHaveAttribute('data-active', 'true');
    const orBtn = screen.getByRole('button', { name: 'OR' });
    expect(orBtn).toHaveAttribute('data-active', 'false');
  });

  it('highlights OR when operator is OR', () => {
    render(<ConditionConnector operator="OR" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'OR' })).toHaveAttribute(
      'data-active',
      'true',
    );
    expect(screen.getByRole('button', { name: 'AND' })).toHaveAttribute(
      'data-active',
      'false',
    );
  });

  it('calls onChange with OR when AND-active and user clicks OR', () => {
    const onChange = vi.fn();
    render(<ConditionConnector operator="AND" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'OR' }));
    expect(onChange).toHaveBeenCalledWith('OR');
  });

  it('calls onChange with AND when OR-active and user clicks AND', () => {
    const onChange = vi.fn();
    render(<ConditionConnector operator="OR" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'AND' }));
    expect(onChange).toHaveBeenCalledWith('AND');
  });

  it('does not fire onChange when the already-active button is clicked', () => {
    const onChange = vi.fn();
    render(<ConditionConnector operator="AND" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'AND' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
