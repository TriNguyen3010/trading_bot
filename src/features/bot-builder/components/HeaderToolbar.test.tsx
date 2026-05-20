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

  // Regression guard for Figma glass refresh (2026-05-19).
  // Spec: docs/superpowers/specs/2026-05-19-header-figma-glass-refresh-design.md
  // The outer pill container MUST drop `card-coin98` (solid gradient) and adopt
  // glass utilities. We assert a few signature classes — full string match is too
  // brittle, full snapshot too noisy, this is the middle ground.
  it('outer pill uses glass styling (no card-coin98)', () => {
    const { container } = render(
      <MemoryRouter>
        <HeaderToolbar />
      </MemoryRouter>,
    );

    const pill = container.querySelector('header > div');
    expect(pill).not.toBeNull();
    const className = pill?.className ?? '';

    // Removed
    expect(className).not.toMatch(/card-coin98/);

    // Added — glass signature
    expect(className).toMatch(/bg-white\/\[0\.05\]/);
    expect(className).toMatch(/border-white\/\[0\.08\]/);
    expect(className).toMatch(/backdrop-blur-\[100px\]/);
    expect(className).toMatch(/max-w-\[1200px\]/);
    // Pill total height = 64px = h-16 (Figma 1172×40 content + 12+12 padding)
    expect(className).toMatch(/h-16/);
  });
});
