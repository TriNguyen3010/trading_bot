import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HeaderToolbar } from './HeaderToolbar';

describe('HeaderToolbar', () => {
  it('renders a "Create new bot" button', () => {
    render(
      <MemoryRouter>
        <HeaderToolbar />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('button', { name: /Create new bot/i }),
    ).toBeInTheDocument();
  });
});
