import { afterEach, describe, expect, it, vi } from 'vitest';
import { DRAWER_ANCHORS, scrollDrawerTo } from './drawer-scroll';

/**
 * jsdom doesn't ship `Element.prototype.scrollIntoView`, so we stub it
 * on the prototype before each test and clean up afterwards. This
 * matches the runtime behaviour we care about (the helper finds the
 * element and invokes the method) without needing a real browser.
 */
function installScrollIntoViewStub(): ReturnType<typeof vi.fn> {
  const fn = vi.fn();
  // @ts-expect-error - jsdom Element doesn't declare scrollIntoView.
  Element.prototype.scrollIntoView = fn;
  return fn;
}

describe('scrollDrawerTo', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    // @ts-expect-error - clean up the stub we installed.
    delete Element.prototype.scrollIntoView;
    vi.restoreAllMocks();
  });

  it('calls scrollIntoView on the matching anchor element', () => {
    const stub = installScrollIntoViewStub();
    const target = document.createElement('div');
    target.setAttribute('data-cy-anchor', 'bot-config:pair');
    document.body.appendChild(target);

    scrollDrawerTo('bot-config:pair');

    expect(stub).toHaveBeenCalledTimes(1);
    expect(stub).toHaveBeenCalledWith(
      expect.objectContaining({
        block: 'center',
        behavior: expect.stringMatching(/^(smooth|auto)$/),
      }),
    );
    // Verify it was the matching element (not a sibling) by checking
    // `this` via the call's bound receiver — vi.fn captures it via
    // .mock.contexts in modern Vitest.
    expect(stub.mock.contexts[0]).toBe(target);
  });

  it('is a no-op when the anchor is missing — animation calls before drawer renders should not throw', () => {
    installScrollIntoViewStub();
    expect(() => scrollDrawerTo('bot-config:does-not-exist')).not.toThrow();
  });

  it('does nothing when called with an anchor that does not match any element', () => {
    const stub = installScrollIntoViewStub();
    // Drawer might host a different stepId's anchors than the one the
    // animation requests — helper must tolerate the mismatch.
    const wrong = document.createElement('div');
    wrong.setAttribute('data-cy-anchor', 'strategy:entry');
    document.body.appendChild(wrong);

    scrollDrawerTo('bot-config:pair');

    expect(stub).not.toHaveBeenCalled();
  });

  it('exposes a stable anchor map so the animation engine and drawer body stay in sync', () => {
    expect(DRAWER_ANCHORS.botConfig.pair).toBe('bot-config:pair');
    expect(DRAWER_ANCHORS.botConfig.leverage).toBe('bot-config:leverage');
    expect(DRAWER_ANCHORS.botConfig.exchange).toBe('bot-config:exchange');
    expect(DRAWER_ANCHORS.strategy.entry).toBe('strategy:entry');
    expect(DRAWER_ANCHORS.strategy.action).toBe('strategy:action');
  });
});
