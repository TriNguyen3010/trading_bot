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

  it('keeps the header fixed and uses the shared app header pill', () => {
    const { container } = render(
      <MemoryRouter>
        <HeaderToolbar />
      </MemoryRouter>,
    );

    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    const headerClassName = header?.className ?? '';
    expect(headerClassName).toMatch(/fixed/);
    expect(headerClassName).toMatch(/inset-x-0/);
    expect(headerClassName).toMatch(/top-0/);

    const pill = container.querySelector('header > div');
    expect(pill).not.toBeNull();
    const className = pill?.className ?? '';

    expect(className).not.toMatch(/card-coin98/);
    expect(className).toMatch(/app-header-pill/);
    expect(className).toMatch(/max-w-\[1200px\]/);
    expect(className).toMatch(/h-16/);
  });
});
