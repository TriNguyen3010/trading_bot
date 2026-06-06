import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardEmptyState } from '../DashboardEmptyState';

describe('DashboardEmptyState', () => {
  it('renders CTA and fires callbacks', () => {
    const onCreate = vi.fn();
    const onImport = vi.fn();
    render(<DashboardEmptyState onCreate={onCreate} onImport={onImport} />);
    expect(screen.getByText(/No bots yet/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Create your first bot/i));
    expect(onCreate).toHaveBeenCalled();
  });
});
