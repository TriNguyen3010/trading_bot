import '@testing-library/jest-dom/vitest';

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
