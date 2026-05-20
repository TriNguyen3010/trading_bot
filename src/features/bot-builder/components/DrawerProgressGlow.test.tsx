import { describe, it, expect } from 'vitest';
import { useRef } from 'react';
import { render, act } from '@testing-library/react';
import { DrawerProgressGlow } from './DrawerProgressGlow';

// Helper: stamp scroll metrics on a DOM node after mount.
function stampScrollMetrics(
  el: HTMLElement,
  scrollHeight: number,
  clientHeight: number,
) {
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(el, 'clientHeight', {
    configurable: true,
    value: clientHeight,
  });
}

function PanelHarness({ panelHeight = 600 }: { panelHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      data-testid="panel"
      style={{ position: 'relative', height: panelHeight, width: 400 }}
    >
      <div ref={ref} data-testid="scroll" />
      <DrawerProgressGlow scrollRef={ref} />
    </div>
  );
}

describe('DrawerProgressGlow', () => {
  it('renders the line and glow elements', () => {
    const { container } = render(<PanelHarness />);
    expect(
      container.querySelector('.drawer-progress-line'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('.drawer-progress-glow'),
    ).toBeInTheDocument();
  });

  it('marks both elements aria-hidden', () => {
    const { container } = render(<PanelHarness />);
    expect(
      container
        .querySelector('.drawer-progress-line')
        ?.getAttribute('aria-hidden'),
    ).toBe('true');
    expect(
      container
        .querySelector('.drawer-progress-glow')
        ?.getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('parks the glow at the top inset when content does not overflow', () => {
    const { getByTestId, container } = render(<PanelHarness />);
    // Stamp metrics on the scroll node, then dispatch a scroll event so
    // the component re-evaluates.
    const scroll = getByTestId('scroll');
    stampScrollMetrics(scroll, 400, 400);
    act(() => {
      scroll.dispatchEvent(new Event('scroll'));
    });

    // Both line and glow remain visible — the glow doubles as a status
    // pointer that sits at the top when there's nothing to scroll.
    expect(
      container
        .querySelector('.drawer-progress-line')
        ?.getAttribute('data-visible'),
    ).toBe('true');
    const glow = container.querySelector<HTMLElement>('.drawer-progress-glow');
    expect(glow?.getAttribute('data-visible')).toBe('true');
    // Parked at the panel's top inset (24px = the rounded-l-3xl corner).
    expect(glow?.style.top).toBe('24px');
  });

  it('sets data-visible="true" when content overflows', () => {
    const { getByTestId, container } = render(<PanelHarness />);
    const scroll = getByTestId('scroll');
    stampScrollMetrics(scroll, 1200, 400);
    act(() => {
      scroll.dispatchEvent(new Event('scroll'));
    });

    expect(
      container
        .querySelector('.drawer-progress-line')
        ?.getAttribute('data-visible'),
    ).toBe('true');
    expect(
      container
        .querySelector('.drawer-progress-glow')
        ?.getAttribute('data-visible'),
    ).toBe('true');
  });

  it('updates glow top in proportion to scroll', () => {
    const { getByTestId, container } = render(
      <PanelHarness panelHeight={600} />,
    );
    const scroll = getByTestId('scroll');
    stampScrollMetrics(scroll, 1200, 400);

    // Panel = 600px, glow height = 160px (per .drawer-progress-glow CSS).
    // jsdom doesn't apply stylesheets, so glow.clientHeight defaults to
    // 0. We need to stamp it too.
    const glow = container.querySelector(
      '.drawer-progress-glow',
    ) as HTMLElement;
    Object.defineProperty(glow, 'clientHeight', {
      configurable: true,
      value: 160,
    });

    // Also stamp panel.clientHeight (the offsetParent) — jsdom gives 0.
    const panel = getByTestId('panel');
    Object.defineProperty(panel, 'clientHeight', {
      configurable: true,
      value: 600,
    });

    // Scroll to 50%: scrollTop = 0.5 * (1200 - 400) = 400.
    scroll.scrollTop = 400;
    act(() => {
      scroll.dispatchEvent(new Event('scroll'));
    });

    // Expected top = inset + ratio * (panelH - 2*inset - glowH)
    //              = 24 + 0.5 * (600 - 48 - 160) = 24 + 196 = 220.
    expect(glow.style.top).toBe('220px');
  });
});
