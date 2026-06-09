/**
 * Unique-ish default names for a fresh bot, so each "Create new bot" doesn't
 * collide with the previous default.
 *
 * Suffix = `<wallet last 3, lowercased>_<mmss>` — e.g. "b3f_3045". The wallet
 * fragment says *whose* bot it is; the minute:second gives second-level
 * uniqueness (a single user effectively never collides). No wallet connected →
 * 3 random base36 chars keep the same `xxx_3045` shape.
 *
 * The strategy name is sanitized to a PascalCase Python class name by the
 * serializer (`toPythonClassName`) before it reaches the BE — the alphanumeric
 * suffix survives, so uniqueness is preserved there too.
 */

function rand3(): string {
  return Math.random().toString(36).slice(2, 5).padEnd(3, '0');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** `<w3>_<mmss>` from the wallet address (or random) + the given time. */
export function defaultNameSuffix(address: string | null, now: Date): string {
  const w3 =
    address && address.length >= 3 ? address.slice(-3).toLowerCase() : rand3();
  const mmss = pad2(now.getMinutes()) + pad2(now.getSeconds());
  return `${w3}_${mmss}`;
}

/** Bot + strategy default names sharing one suffix (so the two match). */
export function makeDefaultNames(
  address: string | null,
  now: Date,
): { botName: string; strategyName: string } {
  const suffix = defaultNameSuffix(address, now);
  return {
    botName: `Bot Basic ${suffix}`,
    strategyName: `Entry Strategy ${suffix}`,
  };
}
