import { useEffect, useRef } from 'react';

/**
 * Yellow dot-grid background — Coin98 SwapX reference.
 *
 * Visual layers (back-to-front):
 *  1. Connecting beam — 3 perpendicular segments (H-V-H) joining the
 *     two beacon centres. Single gradient stroke with shadow blur.
 *  2. Normal grid dots — every grid intersection. Each dot's alpha is
 *     base + halo dot-field contribution (radial × angular falloff
 *     aligned with the active cardinal of its nearest beacon). The
 *     "glow" corona is composed of these brightened dots, not a
 *     separate gradient layer.
 *  3. Beacon plus dots — 5 per beacon (centre + 4 cardinals) drawn
 *     larger with strong shadowBlur per dot. Cardinals rotate
 *     intensity clockwise (top → right → bottom → left) — Cardinal
 *     Rotation animation. Centre stays at a constant high intensity.
 *  4. Cursor spotlight — soft radial brightening of dots near the
 *     pointer; fades when pointer is idle or off.
 *
 * Behavior:
 *  - prefers-reduced-motion: static base grid only.
 *  - hover: none (touch): beacons + beam + rotation play; mouse skipped.
 *  - desktop: all four layers active.
 */

// Grid spacing — 10px centre-to-centre.
const SPACING = 10;
// Sizes (diameter → radius). Three tiers per spec:
//   dim background dot:    size 4   → radius 2
//   beacon cardinal (×4):  size 8   → radius 4
//   beacon centre (nhuỵ):  size 12  → radius 6
const DOT_RADIUS = 2;

// Sprite for dim background dots — pre-rendered once with TWO shadow
// passes baked in (a wide soft outer haze + a tight inner core), so
// every dot carries a layered gaussian glow. Drawing the sprite via
// `drawImage` + globalAlpha then keeps render cost flat. The 2-pass
// bake produces a much smoother fall-off than a single shadowBlur,
// matching the lush feel of the flower's plus-dot glow.
const DIM_DOT_SPRITE_SIZE = 36;        // logical (CSS) px sprite canvas
const DIM_DOT_OUTER_BLUR = 18;         // wide soft halo
const DIM_DOT_INNER_BLUR = 6;          // tight core glow

// Color palette.
const COLOR = [255, 210, 80] as const;
const BRIGHT_COLOR = [255, 217, 96] as const;
const BASE_ALPHA = 0.12;
const PEAK_ALPHA = 0.98;
// Cursor hover dims to 50% so the spotlight is gentler than the
// flower / halo corona (which keep the full PEAK_ALPHA).
const CURSOR_PEAK_ALPHA = 0.49;

// Cursor spotlight — smaller radius so the hover halo reads as a tight
// soft cluster (not a giant spotlight). Combines with the bigger dim
// dot sprite blur for a lush cursor feel.
const RADIUS = 100;
const FADE_IN_RATE = 0.06;
const FADE_OUT_RATE = 0.022;
const IDLE_MS = 80;
const LERP = 0.18;

// Beacons no longer fixed — every BEAM_CYCLE_MS we generate a new
// "session" with two random grid positions for A and B and a random
// 3-segment perpendicular path connecting them.
interface BeaconConfig {
  phase: number;  // rotation phase offset (radians)
}
const BEACON_A_PHASE = 0;
const BEACON_B_PHASE = Math.PI;

// Halo dot-field — radius within which surrounding dots brighten.
// No gradient layer; the corona emerges from the dim dots themselves.
const BEACON_HALO_RADIUS = 110;
// Cardinal Rotation — full 360° cycle duration.
const BEACON_ROTATION_MS = 3200;
// Plus dot rendering. Glow is per-dot via shadowBlur only — no
// atmospheric outer halo behind. The halo dot-field corona (handled in
// the main dot loop) provides ambient corona instead.
const BEACON_PLUS_CARDINAL_RADIUS = 4;     // diameter 8 (at scale 1)
const BEACON_PLUS_CENTER_RADIUS = 5;       // diameter 10 (nhuỵ)
// Both cardinals and the centre render in 3 passes (outer bloom + crisp
// core + inner highlight). Cardinals stay slightly bigger / blurrier
// than the centre — keeps them "rực" — but both share the soft fuzzy
// glow profile from the reference.
const BEACON_CENTER_SHADOW_BLUR = 32;       // up from 24
const BEACON_CARDINAL_SHADOW_BLUR = 38;     // up from 32
// Outer bloom — wide soft atmospheric halo via shadowBlur only (no
// extra fill layer). Drawn behind the core, gives the smooth gaussian
// fall-off seen in the reference.
const PLUS_OUTER_BLOOM_BLUR_BONUS = 12;     // outer pass blur = core blur + this
const PLUS_OUTER_BLOOM_FILL_ALPHA = 0.4;
const PLUS_OUTER_BLOOM_SHADOW_ALPHA = 0.55;
// Inner highlight — tight near-white spot stacked on top.
const PLUS_HIGHLIGHT_SCALE = 0.55;          // highlight radius = core × this
const PLUS_HIGHLIGHT_BLUR = 14;
const PLUS_HIGHLIGHT_COLOR = [255, 245, 180] as const; // near-white yellow
// Plus dot intensity: centre stays bright, cardinals rotate. Idle
// cardinal floor lifted so even the non-active 3 still glow vividly.
const CENTER_INTENSITY = 0.92;
const CARD_BASE_INTENSITY = 0.6;
// Halo dot-field strength — how much the surrounding dots brighten.
// Final halo alpha = BASE_ALPHA + halo × HALO_FIELD_STRENGTH × (PEAK - BASE).
const HALO_FIELD_STRENGTH = 0.55;
// Breathing animation — each of the 4 cardinals breathes independently
// (its own random phase, 1.5s period). Scale ranges 0.5x..1.0x of the
// base cardinal radius, so the rendered diameter sweeps 4..8 px (= one
// background-dot up to one full cardinal) and never approaches the
// centre's size 12. The halo dot-field corona pulses with the AVERAGE
// of the 4 cardinal scales — corona dim when most petals are inhaling,
// bright when most are exhaling.
const CARDINAL_BREATHE_MS = 1500;
const CARDINAL_SCALE_MIN = 0.5;            // radius × 0.5 = 2 (diameter 4)
const CARDINAL_SCALE_MAX = 1.0;            // radius × 1.0 = 4 (diameter 8)
const HALO_BREATHE_LOW = 0.7;              // halo strength multiplier when avg cardinal at min
const HALO_BREATHE_HIGH = 1.3;             // halo strength multiplier when avg cardinal at max

// Connecting beam — 3 perpendicular segments. Lifecycle per session:
//   1. Spawn A → fade in (BEACON_FADE_IN_MS)
//   2. Random gap (SPAWN_GAP_MIN..MAX) → spawn B → fade in
//   3. Grace pause (BEAM_GRACE_MS) once both fully visible
//   4. Beam draws A → B (BEAM_DRAW_MS)
//   5. Beam fades by *geometric shrinking* from A end → B (BEAM_FADE_MS)
//   6. Both beacons fade out (BEACON_FADE_OUT_MS)
//   7. Idle (IDLE_GAP_MIN..MAX) → next session at random new positions
const BEAM_LINE_WIDTH = 1.4;
const BEAM_SHADOW_BLUR = 12;
const BEAM_HEAD_RADIUS = 3.2;
const BEAM_HEAD_BLUR = 14;
const BEAM_DRAW_MS = 500;
const BEAM_FADE_MS = 600;
const BEAM_GRACE_MS = 200;
const BEACON_FADE_IN_MS = 300;
const BEACON_FADE_OUT_MS = 400;
// Per-member stagger window. Within each beacon's spawn, the 5 plus
// members (centre + 4 cardinals) each pick a random offset in [0, this]
// before they begin their own fade-in. Result: dots pop in one-by-one,
// not all 5 at once.
const MEMBER_SPAWN_WINDOW_MS = 600;
const SPAWN_GAP_MIN_MS = 2000;
const SPAWN_GAP_MAX_MS = 4000;
const IDLE_GAP_MIN_MS = 3000;
const IDLE_GAP_MAX_MS = 4000;
// Random session position tuning.
const BEAM_EDGE_MARGIN = 70;
const BEAM_MIN_DIST_FRAC = 0.4;
const BEAM_MID_FRAC_MIN = 0.35;
const BEAM_MID_FRAC_MAX = 0.65;

type PlusSlot = 'center' | 'top' | 'right' | 'bottom' | 'left';
type MemberMap<T> = Record<PlusSlot, T>;

function randomMemberOffsets(): MemberMap<number> {
  return {
    center: Math.random() * MEMBER_SPAWN_WINDOW_MS,
    top: Math.random() * MEMBER_SPAWN_WINDOW_MS,
    right: Math.random() * MEMBER_SPAWN_WINDOW_MS,
    bottom: Math.random() * MEMBER_SPAWN_WINDOW_MS,
    left: Math.random() * MEMBER_SPAWN_WINDOW_MS,
  };
}

function maxOffset(o: MemberMap<number>): number {
  return Math.max(o.center, o.top, o.right, o.bottom, o.left);
}

interface CardinalPhases {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Independent random breathe phase (radians) per cardinal so the 4
 * petals never inhale/exhale together. */
function randomCardinalPhases(): CardinalPhases {
  return {
    top: Math.random() * Math.PI * 2,
    right: Math.random() * Math.PI * 2,
    bottom: Math.random() * Math.PI * 2,
    left: Math.random() * Math.PI * 2,
  };
}

/** Convert a phase + current time into a 0.5..1.0 scale factor. */
function cardinalBreatheScale(now: number, phase: number): number {
  const t = (now / CARDINAL_BREATHE_MS) * Math.PI * 2 + phase;
  // sin -1..1 → 0..1 → CARDINAL_SCALE_MIN..MAX
  return (
    CARDINAL_SCALE_MIN +
    (CARDINAL_SCALE_MAX - CARDINAL_SCALE_MIN) * (Math.sin(t) + 1) * 0.5
  );
}

/** Returns which slot of the plus pattern (dotX, dotY) sits in
 * relative to a snapped-to-grid beacon. null if not part of the plus. */
function plusSlotName(
  dotX: number,
  dotY: number,
  beaconX: number,
  beaconY: number,
): PlusSlot | null {
  const eps = 0.6;
  const dx = dotX - beaconX;
  const dy = dotY - beaconY;
  if (Math.abs(dx) < eps && Math.abs(dy) < eps) return 'center';
  if (Math.abs(dx) < eps && Math.abs(dy + SPACING) < eps) return 'top';
  if (Math.abs(dy) < eps && Math.abs(dx - SPACING) < eps) return 'right';
  if (Math.abs(dx) < eps && Math.abs(dy - SPACING) < eps) return 'bottom';
  if (Math.abs(dy) < eps && Math.abs(dx + SPACING) < eps) return 'left';
  return null;
}

interface BeaconState {
  x: number;
  y: number;
  rotPhase: number;          // 0..1, 0=top active, 0.25=right, 0.5=bottom, 0.75=left
  centerIntensity: number;
  cardinals: { top: number; right: number; bottom: number; left: number };
  /** Highest intensity across centre + cardinals — used as overall glow factor. */
  peak: number;
  /** Highest visibility across all 5 members — used by halo dot-field
   * (the corona starts forming as soon as any member is present). */
  visibleAlpha: number;
  /** Individual fade-in alpha for each plus member. Lets the 5 dots
   * pop in one-by-one rather than all together. */
  memberAlphas: MemberMap<number>;
  /** Per-cardinal scale (each in [CARDINAL_SCALE_MIN, CARDINAL_SCALE_MAX])
   * — the 4 petals breathe independently with their own phase. */
  cardinalScales: { top: number; right: number; bottom: number; left: number };
  /** Multiplier on halo dot-field strength this frame, derived from the
   * average of the 4 cardinal scales. Corona pulses with the petals. */
  haloBreathe: number;
}

/** Cardinal Rotation + per-cardinal flower breathing: returns intensity
 * per plus member, the rotation phase, scale factors for each of the 4
 * cardinals (each driven by its own random phase), and an averaged
 * halo-breathe multiplier. */
function computeBeaconState(
  now: number,
  cfg: BeaconConfig,
  x: number,
  y: number,
  memberAlphas: MemberMap<number>,
  cardPhases: CardinalPhases,
): BeaconState {
  const rotPhase =
    (((now / BEACON_ROTATION_MS) + cfg.phase / (Math.PI * 2)) % 1 + 1) % 1;
  const slot = Math.floor(rotPhase * 4);
  const slotP = (rotPhase * 4) % 1;
  const cards = [
    CARD_BASE_INTENSITY,
    CARD_BASE_INTENSITY,
    CARD_BASE_INTENSITY,
    CARD_BASE_INTENSITY,
  ];
  cards[slot] = 1.0;
  cards[(slot + 1) % 4] = CARD_BASE_INTENSITY + (1.0 - CARD_BASE_INTENSITY) * slotP;
  const breatheRot = 0.08 * Math.sin((now / BEACON_ROTATION_MS) * Math.PI * 2);
  const centerI = CENTER_INTENSITY + breatheRot;
  const visibleAlpha = Math.max(
    memberAlphas.center,
    memberAlphas.top,
    memberAlphas.right,
    memberAlphas.bottom,
    memberAlphas.left,
  );

  // Per-cardinal scale (independent timers).
  const cardinalScales = {
    top: cardinalBreatheScale(now, cardPhases.top),
    right: cardinalBreatheScale(now, cardPhases.right),
    bottom: cardinalBreatheScale(now, cardPhases.bottom),
    left: cardinalBreatheScale(now, cardPhases.left),
  };
  // Halo strength tracks the average petal scale, mapped from the
  // [MIN..MAX] domain to [HALO_LOW..HALO_HIGH] multiplier range.
  const avgScale =
    (cardinalScales.top +
      cardinalScales.right +
      cardinalScales.bottom +
      cardinalScales.left) /
    4;
  const norm =
    (avgScale - CARDINAL_SCALE_MIN) /
    (CARDINAL_SCALE_MAX - CARDINAL_SCALE_MIN); // 0..1
  const haloBreathe =
    HALO_BREATHE_LOW + (HALO_BREATHE_HIGH - HALO_BREATHE_LOW) * norm;

  return {
    x,
    y,
    rotPhase,
    centerIntensity: centerI,
    cardinals: { top: cards[0], right: cards[1], bottom: cards[2], left: cards[3] },
    peak: Math.max(centerI, cards[0], cards[1], cards[2], cards[3]),
    visibleAlpha,
    memberAlphas,
    cardinalScales,
    haloBreathe,
  };
}

/** Map a slot name to the corresponding intensity from a BeaconState. */
function slotIntensity(slot: PlusSlot, bs: BeaconState): number {
  switch (slot) {
    case 'center': return bs.centerIntensity;
    case 'top': return bs.cardinals.top;
    case 'right': return bs.cardinals.right;
    case 'bottom': return bs.cardinals.bottom;
    case 'left': return bs.cardinals.left;
  }
}

type PathPoint = { x: number; y: number };

/** Total length of a polyline path. */
function pathTotalLength(points: PathPoint[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.hypot(
      points[i + 1].x - points[i].x,
      points[i + 1].y - points[i].y,
    );
  }
  return total;
}

/** 3-segment perpendicular path between A and B.
 *  type 'H-V-H': horizontal · vertical · horizontal (mid joint on x-axis)
 *  type 'V-H-V': vertical   · horizontal · vertical (mid joint on y-axis)
 */
function buildPerpendicularPath(
  a: PathPoint,
  b: PathPoint,
  type: 'H-V-H' | 'V-H-V',
  midFrac: number,
): PathPoint[] {
  if (type === 'H-V-H') {
    const midX = a.x + (b.x - a.x) * midFrac;
    return [a, { x: midX, y: a.y }, { x: midX, y: b.y }, b];
  } else {
    const midY = a.y + (b.y - a.y) * midFrac;
    return [a, { x: a.x, y: midY }, { x: b.x, y: midY }, b];
  }
}

/** Snap arbitrary canvas coords to the nearest grid intersection. */
function snapToGrid(
  x: number,
  y: number,
  gridOffsetX: number,
  gridOffsetY: number,
  cols: number,
  rows: number,
): PathPoint {
  const c = Math.max(
    0,
    Math.min(cols - 1, Math.round((x - gridOffsetX) / SPACING)),
  );
  const r = Math.max(
    0,
    Math.min(rows - 1, Math.round((y - gridOffsetY) / SPACING)),
  );
  return { x: gridOffsetX + c * SPACING, y: gridOffsetY + r * SPACING };
}

interface BeamSession {
  a: PathPoint;
  b: PathPoint;
  pathPoints: PathPoint[];
  totalLen: number;
  // Absolute performance.now() timestamps for each milestone.
  tA_in: number;          // A spawn moment (slowest member starts fading later via offset)
  tB_in: number;          // B spawn moment
  tDraw_start: number;    // beam begins drawing (after every member of both is visible + grace)
  tDraw_end: number;      // beam fully drawn (head reached B)
  tFade_end: number;      // beam fully consumed from A side
  tBeacon_out: number;    // beacons start fading out (= tFade_end)
  tBeacon_end: number;    // beacons fully gone
  tNext: number;          // next session spawns
  // Per-member fade-in offsets (each in [0, MEMBER_SPAWN_WINDOW_MS]).
  // Each plus member starts its own fade-in at tA_in/tB_in + offset.
  offsetsA: MemberMap<number>;
  offsetsB: MemberMap<number>;
  // Independent breathe phase (radians) per cardinal so the 4 petals
  // never pulse together. Stable for the whole session.
  cardPhasesA: CardinalPhases;
  cardPhasesB: CardinalPhases;
}

/** Extract the visible sub-path between fromLen and toLen (lengths along
 * the polyline). Returns the actual list of points (clipped at the
 * boundary segments) so we can stroke just that section. */
function pathSubsection(
  points: PathPoint[],
  fromLen: number,
  toLen: number,
): PathPoint[] {
  if (toLen <= fromLen) return [];
  const result: PathPoint[] = [];
  let acc = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const segLen = Math.hypot(dx, dy);
    const segEnd = acc + segLen;

    if (segEnd <= fromLen) {
      acc = segEnd;
      continue;
    }
    if (acc >= toLen) break;

    const tStart = segLen === 0 ? 0 : Math.max(0, (fromLen - acc) / segLen);
    const tEnd = segLen === 0 ? 0 : Math.min(1, (toLen - acc) / segLen);

    if (result.length === 0) {
      result.push({
        x: points[i].x + dx * tStart,
        y: points[i].y + dy * tStart,
      });
    }
    result.push({
      x: points[i].x + dx * tEnd,
      y: points[i].y + dy * tEnd,
    });
    acc = segEnd;
  }
  return result;
}

/** Pick a fresh session: two snapped grid points far apart + random
 * 3-segment perpendicular path + a full lifecycle timeline. */
function generateBeamSession(
  now: number,
  w: number,
  h: number,
  gridOffsetX: number,
  gridOffsetY: number,
  cols: number,
  rows: number,
): BeamSession {
  const margin = BEAM_EDGE_MARGIN;
  const minDist = Math.min(w, h) * BEAM_MIN_DIST_FRAC;
  let a: PathPoint = { x: margin, y: h / 2 };
  let b: PathPoint = { x: w - margin, y: h / 2 };
  const safeW = Math.max(1, w - margin * 2);
  const safeH = Math.max(1, h - margin * 2);
  for (let attempt = 0; attempt < 24; attempt++) {
    const ax = margin + Math.random() * safeW;
    const ay = margin + Math.random() * safeH;
    const bx = margin + Math.random() * safeW;
    const by = margin + Math.random() * safeH;
    if (Math.hypot(bx - ax, by - ay) >= minDist) {
      a = snapToGrid(ax, ay, gridOffsetX, gridOffsetY, cols, rows);
      b = snapToGrid(bx, by, gridOffsetX, gridOffsetY, cols, rows);
      break;
    }
  }
  const type: 'H-V-H' | 'V-H-V' = Math.random() < 0.5 ? 'H-V-H' : 'V-H-V';
  const midFrac =
    BEAM_MID_FRAC_MIN +
    Math.random() * (BEAM_MID_FRAC_MAX - BEAM_MID_FRAC_MIN);
  const pathPoints = buildPerpendicularPath(a, b, type, midFrac);
  const totalLen = pathTotalLength(pathPoints);

  const spawnGap =
    SPAWN_GAP_MIN_MS + Math.random() * (SPAWN_GAP_MAX_MS - SPAWN_GAP_MIN_MS);
  const idleGap =
    IDLE_GAP_MIN_MS + Math.random() * (IDLE_GAP_MAX_MS - IDLE_GAP_MIN_MS);

  const offsetsA = randomMemberOffsets();
  const offsetsB = randomMemberOffsets();

  const tA_in = now;
  const tB_in = tA_in + spawnGap;
  // Beam may not begin until every plus member of BOTH beacons is fully
  // visible — i.e. (beacon spawn) + (slowest member offset) + (fade in).
  const tA_lastVisible = tA_in + maxOffset(offsetsA) + BEACON_FADE_IN_MS;
  const tB_lastVisible = tB_in + maxOffset(offsetsB) + BEACON_FADE_IN_MS;
  const tDraw_start = Math.max(tA_lastVisible, tB_lastVisible) + BEAM_GRACE_MS;
  const tDraw_end = tDraw_start + BEAM_DRAW_MS;
  const tFade_end = tDraw_end + BEAM_FADE_MS;
  const tBeacon_out = tFade_end;
  const tBeacon_end = tBeacon_out + BEACON_FADE_OUT_MS;
  const tNext = tBeacon_end + idleGap;

  return {
    a, b, pathPoints, totalLen,
    tA_in, tB_in, tDraw_start, tDraw_end, tFade_end,
    tBeacon_out, tBeacon_end, tNext,
    offsetsA, offsetsB,
    cardPhasesA: randomCardinalPhases(),
    cardPhasesB: randomCardinalPhases(),
  };
}

/** Per-member visibility 0..1. Each plus member fades in independently
 * at (beacon spawn + this member's offset) and fades out together with
 * the rest of the beacon at session.tBeacon_out. */
function memberAlpha(
  now: number,
  beaconTIn: number,
  offset: number,
  s: BeamSession,
): number {
  const tStart = beaconTIn + offset;
  if (now < tStart) return 0;
  if (now < tStart + BEACON_FADE_IN_MS)
    return (now - tStart) / BEACON_FADE_IN_MS;
  if (now < s.tBeacon_out) return 1;
  if (now < s.tBeacon_end)
    return 1 - (now - s.tBeacon_out) / (s.tBeacon_end - s.tBeacon_out);
  return 0;
}

/** Compute the 5 per-member alphas for one beacon. */
function memberAlphasFor(
  now: number,
  beaconTIn: number,
  offsets: MemberMap<number>,
  s: BeamSession,
): MemberMap<number> {
  return {
    center: memberAlpha(now, beaconTIn, offsets.center, s),
    top: memberAlpha(now, beaconTIn, offsets.top, s),
    right: memberAlpha(now, beaconTIn, offsets.right, s),
    bottom: memberAlpha(now, beaconTIn, offsets.bottom, s),
    left: memberAlpha(now, beaconTIn, offsets.left, s),
  };
}

interface BeamSubVisibility {
  active: boolean;
  fromLen: number;     // start of visible region along path
  toLen: number;       // end of visible region
  drawing: boolean;    // true while head is still travelling
}

/** Where on the path is the beam currently visible. */
function beamSubVisibility(now: number, s: BeamSession): BeamSubVisibility {
  if (now < s.tDraw_start || now >= s.tFade_end)
    return { active: false, fromLen: 0, toLen: 0, drawing: false };
  if (now < s.tDraw_end) {
    const p = (now - s.tDraw_start) / (s.tDraw_end - s.tDraw_start);
    return { active: true, fromLen: 0, toLen: s.totalLen * p, drawing: true };
  }
  // Fade phase — visible region shrinks from A side toward B.
  const p = (now - s.tDraw_end) / (s.tFade_end - s.tDraw_end);
  return {
    active: true,
    fromLen: s.totalLen * p,
    toLen: s.totalLen,
    drawing: false,
  };
}

/** Pre-render a dim dot with two stacked shadowBlur passes — wide soft
 * outer haze + tight inner core. Drawn once into an offscreen canvas
 * so every grid position can drawImage the same sprite with its own
 * globalAlpha (cheap and consistent). The layered baking gives a much
 * smoother gaussian fall-off than a single shadow pass. */
function buildDimDotSprite(dpr: number): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = Math.ceil(DIM_DOT_SPRITE_SIZE * dpr);
  sprite.height = Math.ceil(DIM_DOT_SPRITE_SIZE * dpr);
  const sctx = sprite.getContext('2d');
  if (!sctx) return sprite;
  sctx.scale(dpr, dpr);
  const cx = DIM_DOT_SPRITE_SIZE / 2;
  const cy = DIM_DOT_SPRITE_SIZE / 2;

  // Pass 1 — wide soft outer haze. Lower fill alpha so the core stays
  // crisp once Pass 2 lays on top, but the shadow still bleeds far.
  sctx.shadowColor = `rgba(${COLOR[0]}, ${COLOR[1]}, ${COLOR[2]}, 0.7)`;
  sctx.shadowBlur = DIM_DOT_OUTER_BLUR;
  sctx.fillStyle = `rgba(${COLOR[0]}, ${COLOR[1]}, ${COLOR[2]}, 0.55)`;
  sctx.beginPath();
  sctx.arc(cx, cy, DOT_RADIUS, 0, Math.PI * 2);
  sctx.fill();

  // Pass 2 — tight inner core for sharp centre + close-in glow.
  sctx.shadowColor = `rgba(${COLOR[0]}, ${COLOR[1]}, ${COLOR[2]}, 0.95)`;
  sctx.shadowBlur = DIM_DOT_INNER_BLUR;
  sctx.fillStyle = `rgb(${COLOR[0]}, ${COLOR[1]}, ${COLOR[2]})`;
  sctx.beginPath();
  sctx.arc(cx, cy, DOT_RADIUS, 0, Math.PI * 2);
  sctx.fill();

  return sprite;
}

/** Halo dot-field contribution. Returns 0..1 strength applied to a dot's
 * alpha given its distance from a beacon. Pure radial² falloff — the
 * corona is symmetric around the perimeter, the active cardinal does
 * NOT bias one side brighter. */
function haloContribution(dx: number, dy: number): number {
  const d2 = dx * dx + dy * dy;
  const r2 = BEACON_HALO_RADIUS * BEACON_HALO_RADIUS;
  if (d2 >= r2) return 0;
  const d = Math.sqrt(d2);
  const radial = 1 - d / BEACON_HALO_RADIUS;
  return radial * radial;
}

export function DotGridSpotlight({
  className,
  style,
  dimmed,
}: {
  className?: string;
  style?: React.CSSProperties;
  dimmed?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const noHover =
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: none)').matches;

    if (reduceMotion) {
      renderStaticGrid(canvas, dimmed);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let dots: { x: number; y: number }[] = [];
    let mouseX = -9999;
    let mouseY = -9999;
    let smoothX = mouseX;
    let smoothY = mouseY;
    let lastMoveTime = 0;
    let isInside = false;
    let strength = 0;
    let raf = 0;
    let cachedRect = { width: 0, height: 0 };
    let gridOffsetX = 0;
    let gridOffsetY = 0;
    let gridCols = 0;
    let gridRows = 0;
    let session: BeamSession | null = null;
    const dimDotSprite = buildDimDotSprite(dpr);
    const dimSpriteHalf = DIM_DOT_SPRITE_SIZE / 2;

    const rebuildGrid = () => {
      const rect = canvas.getBoundingClientRect();
      cachedRect = { width: rect.width, height: rect.height };
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      dots = [];
      gridCols = Math.ceil(rect.width / SPACING);
      gridRows = Math.ceil(rect.height / SPACING);
      gridOffsetX = (rect.width - gridCols * SPACING) / 2 + SPACING / 2;
      gridOffsetY = (rect.height - gridRows * SPACING) / 2 + SPACING / 2;
      for (let r = 0; r < gridRows; r++) {
        for (let c = 0; c < gridCols; c++) {
          dots.push({
            x: gridOffsetX + c * SPACING,
            y: gridOffsetY + r * SPACING,
          });
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mouseX = x;
      mouseY = y;
      lastMoveTime = performance.now();
      isInside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
    };
    const onMouseLeave = () => {
      isInside = false;
    };

    const draw = () => {
      const w = cachedRect.width;
      const h = cachedRect.height;
      ctx.clearRect(0, 0, w, h);

      const now = performance.now();
      const dimMul = dimmed ? 0.3 : 1;

      // Spawn / refresh the beam session when the previous one finishes
      // its idle gap. Each new session has its own random positions,
      // path shape, and lifecycle timeline.
      if (!session || now >= session.tNext) {
        session = generateBeamSession(
          now,
          w,
          h,
          gridOffsetX,
          gridOffsetY,
          gridCols,
          gridRows,
        );
      }

      // Each plus member has its own fade-in offset, so the 5 dots of
      // each beacon pop in one-by-one rather than together.
      const memberAlphasA = memberAlphasFor(
        now,
        session.tA_in,
        session.offsetsA,
        session,
      );
      const memberAlphasB = memberAlphasFor(
        now,
        session.tB_in,
        session.offsetsB,
        session,
      );

      const beacons: BeaconState[] = [
        computeBeaconState(
          now,
          { phase: BEACON_A_PHASE },
          session.a.x,
          session.a.y,
          memberAlphasA,
          session.cardPhasesA,
        ),
        computeBeaconState(
          now,
          { phase: BEACON_B_PHASE },
          session.b.x,
          session.b.y,
          memberAlphasB,
          session.cardPhasesB,
        ),
      ];

      // 1. Connecting beam — sub-path between fromLen..toLen of the
      // 3-segment perpendicular path. During DRAW the visible region
      // grows from A toward B (fromLen=0, toLen rising). During FADE
      // the visible region shrinks from A side toward B (fromLen
      // rising, toLen=totalLen) — the line "burns away" from A end.
      const beam = beamSubVisibility(now, session);
      if (beam.active) {
        const subPath = pathSubsection(
          session.pathPoints,
          beam.fromLen,
          beam.toLen,
        );
        if (subPath.length >= 2) {
          const [b0, b1] = beacons;
          const lineIntensity = (b0.peak + b1.peak) / 2;
          ctx.save();
          ctx.shadowColor = `rgba(${COLOR[0]}, ${COLOR[1]}, ${COLOR[2]}, ${0.55 * lineIntensity * dimMul})`;
          ctx.shadowBlur = BEAM_SHADOW_BLUR;

          // Gradient runs ALONG the visible sub-path: tail (start) low
          // alpha, head (end, toward B) high alpha. Same shape during
          // both draw and fade so head/B side stays the brighter end.
          const grad = ctx.createLinearGradient(
            subPath[0].x,
            subPath[0].y,
            subPath[subPath.length - 1].x,
            subPath[subPath.length - 1].y,
          );
          const aTail = 0.05 * lineIntensity * dimMul;
          const aMid = 0.45 * lineIntensity * dimMul;
          const aHead = 0.7 * lineIntensity * dimMul;
          grad.addColorStop(
            0,
            `rgba(${COLOR[0]}, ${COLOR[1]}, ${COLOR[2]}, ${aTail})`,
          );
          grad.addColorStop(
            0.35,
            `rgba(${COLOR[0]}, ${COLOR[1]}, ${COLOR[2]}, ${aMid})`,
          );
          grad.addColorStop(
            1,
            `rgba(${COLOR[0]}, ${COLOR[1]}, ${COLOR[2]}, ${aHead})`,
          );
          ctx.strokeStyle = grad;
          ctx.lineWidth = BEAM_LINE_WIDTH;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(subPath[0].x, subPath[0].y);
          for (let i = 1; i < subPath.length; i++) {
            ctx.lineTo(subPath[i].x, subPath[i].y);
          }
          ctx.stroke();
          ctx.restore();

          // Bright travelling head — only while the line is still
          // growing (draw phase). During fade there is no advancing
          // head — the line is being consumed from the back.
          if (beam.drawing) {
            const head = subPath[subPath.length - 1];
            ctx.save();
            ctx.shadowColor = `rgba(${BRIGHT_COLOR[0]}, ${BRIGHT_COLOR[1]}, ${BRIGHT_COLOR[2]}, ${0.95 * dimMul})`;
            ctx.shadowBlur = BEAM_HEAD_BLUR;
            ctx.fillStyle = `rgba(${BRIGHT_COLOR[0]}, ${BRIGHT_COLOR[1]}, ${BRIGHT_COLOR[2]}, ${0.95 * dimMul})`;
            ctx.beginPath();
            ctx.arc(head.x, head.y, BEAM_HEAD_RADIUS, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }

      // 2. Cursor spotlight strength + smooth follow.
      if (!noHover) {
        smoothX = smoothX + (mouseX - smoothX) * LERP;
        smoothY = smoothY + (mouseY - smoothY) * LERP;
        const idleFor = now - lastMoveTime;
        const target = isInside && idleFor < IDLE_MS ? 1 : 0;
        strength =
          target === 1
            ? Math.min(1, strength + FADE_IN_RATE)
            : Math.max(0, strength - FADE_OUT_RATE);
      } else {
        strength = 0;
      }

      // 3. Normal grid dots — base + halo dot-field + cursor spotlight.
      // Plus members are skipped here, drawn separately in pass 4.
      const cursorRadius2 = RADIUS * RADIUS;
      const haloMaxR2 = BEACON_HALO_RADIUS * BEACON_HALO_RADIUS;
      const plusDots: {
        x: number;
        y: number;
        intensity: number;
        visibleAlpha: number;
        slot: PlusSlot;
        cardinalScale: number;
      }[] = [];

      for (const dot of dots) {
        // Plus pattern check first — if a plus member, defer to pass 4.
        // Each member uses its OWN per-slot fade-in alpha so the 5 dots
        // of a beacon pop in staggered, not all together. We also carry
        // the owning beacon's cardinalScale so the petal can breathe.
        let plusBest: {
          slot: PlusSlot;
          intensity: number;
          visibleAlpha: number;
          cardinalScale: number;
        } | null = null;
        for (const bs of beacons) {
          if (bs.visibleAlpha <= 0) continue;
          const slot = plusSlotName(dot.x, dot.y, bs.x, bs.y);
          if (!slot) continue;
          const memberA = bs.memberAlphas[slot];
          if (memberA <= 0) continue;
          const i = slotIntensity(slot, bs);
          const eff = i * memberA;
          const bestEff =
            plusBest ? plusBest.intensity * plusBest.visibleAlpha : -1;
          if (eff > bestEff) {
            // Centre doesn't breathe; cardinals use the scale matching
            // their own slot (each runs an independent timer).
            const scale =
              slot === 'center'
                ? 1
                : bs.cardinalScales[slot];
            plusBest = {
              slot,
              intensity: i,
              visibleAlpha: memberA,
              cardinalScale: scale,
            };
          }
        }
        if (plusBest) {
          plusDots.push({
            x: dot.x,
            y: dot.y,
            slot: plusBest.slot,
            intensity: plusBest.intensity,
            visibleAlpha: plusBest.visibleAlpha,
            cardinalScale: plusBest.cardinalScale,
          });
          continue;
        }

        // Build alpha from base + cursor + halo dot-field contributions.
        let alpha = BASE_ALPHA;

        if (strength > 0) {
          const dx = dot.x - smoothX;
          const dy = dot.y - smoothY;
          const d2 = dx * dx + dy * dy;
          if (d2 < cursorRadius2) {
            const t = 1 - d2 / cursorRadius2;
            const boost = t * t * strength;
            // Cursor uses CURSOR_PEAK_ALPHA (lower) so the hover halo
            // stays gentler than the flower / halo dot-field corona.
            const cursorAlpha =
              BASE_ALPHA + boost * (CURSOR_PEAK_ALPHA - BASE_ALPHA);
            if (cursorAlpha > alpha) alpha = cursorAlpha;
          }
        }

        // Halo dot-field — each beacon contributes; take max. Multiplied
        // by that beacon's visibleAlpha (per-session fade) AND by its
        // haloBreathe (per-frame inhale/exhale), so the corona pulses
        // along with the cardinal scale.
        for (const bs of beacons) {
          if (bs.visibleAlpha <= 0) continue;
          const dx = dot.x - bs.x;
          const dy = dot.y - bs.y;
          const d2 = dx * dx + dy * dy;
          if (d2 >= haloMaxR2) continue;
          const halo = haloContribution(dx, dy);
          if (halo <= 0) continue;
          const haloAlpha =
            BASE_ALPHA +
            halo *
              HALO_FIELD_STRENGTH *
              bs.peak *
              bs.visibleAlpha *
              bs.haloBreathe *
              (PEAK_ALPHA - BASE_ALPHA);
          if (haloAlpha > alpha) alpha = haloAlpha;
        }

        alpha *= dimMul;
        // Each dim dot is rendered via the pre-built sprite (dot core +
        // baked-in shadowBlur glow). globalAlpha scales the whole sprite,
        // so the glow halo proportions stay consistent and we avoid
        // re-applying a per-dot shadow each frame.
        ctx.globalAlpha = alpha;
        ctx.drawImage(
          dimDotSprite,
          dot.x - dimSpriteHalf,
          dot.y - dimSpriteHalf,
          DIM_DOT_SPRITE_SIZE,
          DIM_DOT_SPRITE_SIZE,
        );
      }
      ctx.globalAlpha = 1;

      // 4. Plus dot bright cores. Both cardinals and the centre render
      // in 3 passes for the soft-fuzzy-glow look from the reference:
      //   A: wide outer bloom (atmospheric halo via shadowBlur)
      //   B: crisp core
      //   C: tight near-white inner highlight
      // Cardinals get a slightly bigger blur than the centre but the
      // structure is identical so both petals + nhuỵ feel cohesive.
      if (plusDots.length > 0) {
        ctx.save();
        for (const pd of plusDots) {
          const visMul = pd.visibleAlpha * dimMul;
          const a = PEAK_ALPHA * pd.intensity * visMul;
          if (a < 0.02) continue;
          const isCardinal = pd.slot !== 'center';
          // Cardinal radius pulses with the beacon's breathing sine —
          // the 4 petals visibly inhale (shrink) and exhale (expand).
          const r = isCardinal
            ? BEACON_PLUS_CARDINAL_RADIUS * pd.cardinalScale
            : BEACON_PLUS_CENTER_RADIUS;
          const blur = isCardinal
            ? BEACON_CARDINAL_SHADOW_BLUR
            : BEACON_CENTER_SHADOW_BLUR;

          // Pass A — wide soft outer bloom (atmospheric halo).
          ctx.shadowColor = `rgba(${BRIGHT_COLOR[0]}, ${BRIGHT_COLOR[1]}, ${BRIGHT_COLOR[2]}, ${PLUS_OUTER_BLOOM_SHADOW_ALPHA * pd.intensity * visMul})`;
          ctx.shadowBlur = blur + PLUS_OUTER_BLOOM_BLUR_BONUS;
          ctx.fillStyle = `rgba(${BRIGHT_COLOR[0]}, ${BRIGHT_COLOR[1]}, ${BRIGHT_COLOR[2]}, ${PLUS_OUTER_BLOOM_FILL_ALPHA * pd.intensity * visMul})`;
          ctx.beginPath();
          ctx.arc(pd.x, pd.y, r * 0.8, 0, Math.PI * 2);
          ctx.fill();

          // Pass B — crisp bright core with the standard blur.
          ctx.shadowColor = `rgba(${BRIGHT_COLOR[0]}, ${BRIGHT_COLOR[1]}, ${BRIGHT_COLOR[2]}, ${0.98 * pd.intensity * visMul})`;
          ctx.shadowBlur = blur;
          ctx.fillStyle = `rgba(${BRIGHT_COLOR[0]}, ${BRIGHT_COLOR[1]}, ${BRIGHT_COLOR[2]}, ${a})`;
          ctx.beginPath();
          ctx.arc(pd.x, pd.y, r, 0, Math.PI * 2);
          ctx.fill();

          // Pass C — tight near-white inner highlight stacked on top.
          const hr = r * PLUS_HIGHLIGHT_SCALE;
          ctx.shadowColor = `rgba(${PLUS_HIGHLIGHT_COLOR[0]}, ${PLUS_HIGHLIGHT_COLOR[1]}, ${PLUS_HIGHLIGHT_COLOR[2]}, ${0.9 * pd.intensity * visMul})`;
          ctx.shadowBlur = PLUS_HIGHLIGHT_BLUR;
          ctx.fillStyle = `rgba(${PLUS_HIGHLIGHT_COLOR[0]}, ${PLUS_HIGHLIGHT_COLOR[1]}, ${PLUS_HIGHLIGHT_COLOR[2]}, ${0.9 * pd.intensity * visMul})`;
          ctx.beginPath();
          ctx.arc(pd.x, pd.y, hr, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    };

    rebuildGrid();
    raf = requestAnimationFrame(draw);

    const resizeObserver = new ResizeObserver(() => rebuildGrid());
    resizeObserver.observe(canvas);

    if (!noHover) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseout', (e) => {
        if (!e.relatedTarget) onMouseLeave();
      });
    }

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      if (!noHover) {
        window.removeEventListener('mousemove', onMouseMove);
      }
    };
  }, [dimmed]);

  return (
    <div aria-hidden style={style} className={className}>
      <canvas
        ref={canvasRef}
        className="pointer-events-none block h-full w-full"
      />
    </div>
  );
}

function renderStaticGrid(canvas: HTMLCanvasElement, dimmed?: boolean) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  for (let y = SPACING / 2; y < rect.height; y += SPACING) {
    for (let x = SPACING / 2; x < rect.width; x += SPACING) {
      let alpha = BASE_ALPHA;
      if (dimmed) alpha *= 0.3;
      ctx.fillStyle = `rgba(${COLOR[0]}, ${COLOR[1]}, ${COLOR[2]}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
