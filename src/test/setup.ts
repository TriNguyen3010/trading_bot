import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Force the auth-bypass demo flag OFF for tests — `.env.local` carries
// `VITE_BYPASS_AUTH=true` for local demo purposes and would otherwise
// leak into vitest's Vite env, masking the real 401-redirect behaviour
// http.test.ts exercises.
vi.stubEnv('VITE_BYPASS_AUTH', 'false');

// jsdom doesn't ship ResizeObserver. DrawerProgressGlow uses it to
// re-evaluate overflow state when content height changes; without a
// global stub any test that mounts a drawer (StepDrawer integration
// tests, future composite-drawer tests) throws "ResizeObserver is not
// defined". A noop polyfill is enough — tests that care about resize
// behavior install their own mock locally.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// jsdom doesn't implement Element.scrollTo. CypheusChat calls it when
// new messages arrive — without this polyfill mounting the panel during
// tests crashes the React tree with "el.scrollTo is not a function".
if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function () {};
}

// jsdom doesn't ship `window.matchMedia`. DotGridSpotlight (mounted by
// BuilderPage) and drawer-scroll both read it for prefers-reduced-motion
// detection. Default `matches: true` routes consumers through the
// reduced-motion code path, which skips the canvas/animation code that
// jsdom can't run and silences "HTMLCanvasElement.prototype.getContext
// not implemented" warnings.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom 25 ships a Storage stub whose `setItem` may not be a function in
// some Node + vitest combinations — surfaces as "storage.setItem is not a
// function" the first time zustand's persist middleware tries to write.
// Detect that case and install a plain in-memory replacement so every
// test starts with a working localStorage. Idempotent — does nothing if
// the existing implementation is already healthy.
if (
  typeof globalThis.localStorage === 'undefined' ||
  typeof globalThis.localStorage.setItem !== 'function'
) {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      },
    } as Storage,
  });
}
