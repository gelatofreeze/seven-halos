import { createCanvas, quantizeAlpha, seeded } from './canvas';
import { PALETTE as C } from './palette';

/**
 * Placeholder art for caves (Root Hollow): natural rock tiles, an underground
 * backdrop with no sky, glowing moss, and the relic stone a single treasure
 * rests on. Procedural and deliberately simple, like the rest.
 */

const ROCK = '#2a2d36';
const ROCK_DARK = '#1a1c23';
const ROCK_LIGHT = '#3d414d';
const ROCK_EDGE = '#566070';
const LICHEN = '#4d6a5c';
const GLOW = '#9fe8d8';

/**
 * Natural rock in the tileset's six slots (top, two inner variants, wall,
 * one-way shelf, slab unused here): no mortar lines, irregular cracks, a
 * worn lit edge on top. Distinct from worked masonry (`%`) at a glance.
 */
export function drawRock(ctx: CanvasRenderingContext2D, ts: number, base: number, slots: { top: number; innerA: number; innerB: number; wall: number; oneWay: number; slab: number }, rand: () => number): void {
  const mass = (ox: number) => {
    ctx.fillStyle = ROCK;
    ctx.fillRect(ox, 0, ts, ts);
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = rand() > 0.5 ? ROCK_LIGHT : ROCK_DARK;
      ctx.fillRect(ox + Math.floor(rand() * (ts - 2)), Math.floor(rand() * ts), 2 + Math.floor(rand() * 3), 1);
    }
    // A crack wandering across.
    ctx.fillStyle = ROCK_DARK;
    let x = Math.floor(rand() * ts);
    for (let y = 0; y < ts; y++) {
      if (rand() > 0.6) x += rand() > 0.5 ? 1 : -1;
      if (rand() > 0.3) ctx.fillRect(ox + Math.max(0, Math.min(ts - 1, x)), y, 1, 1);
    }
  };
  const top = base + slots.top * ts;
  mass(top);
  ctx.fillStyle = ROCK_EDGE;
  ctx.fillRect(top, 0, ts, 1);
  ctx.fillStyle = ROCK_LIGHT;
  ctx.fillRect(top, 1, ts, 1);
  for (let x = 0; x < ts; x++) if (rand() > 0.6) ctx.fillRect(top + x, 2, 1, 1);
  ctx.fillStyle = LICHEN;
  for (let x = 0; x < ts; x += 4) if (rand() > 0.55) ctx.fillRect(top + x, 0, 2, 1);
  mass(base + slots.innerA * ts);
  mass(base + slots.innerB * ts);
  const wall = base + slots.wall * ts;
  mass(wall);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(wall, 0, ts, ts);
  // A rock shelf: a thin natural ledge, ragged underneath.
  const sh = base + slots.oneWay * ts;
  ctx.fillStyle = ROCK;
  ctx.fillRect(sh, 0, ts, 5);
  ctx.fillStyle = ROCK_EDGE;
  ctx.fillRect(sh, 0, ts, 1);
  ctx.fillStyle = ROCK_DARK;
  ctx.fillRect(sh + 2, 5, 4, 2);
  ctx.fillRect(sh + 9, 5, 5, 1);
  ctx.fillRect(sh + 11, 6, 2, 2);
  // The slab slot repeats the shelf (caves have no dressed slabs).
  ctx.drawImage(ctx.canvas, sh, 0, ts, ts, base + slots.slab * ts, 0, ts, ts);
}

/** The darkness behind everything underground: a faint cold gradient, no stars. Tiles horizontally. */
export function buildCaveBack(w: number, h: number): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#05060a');
  g.addColorStop(0.6, '#0b1016');
  g.addColorStop(1, '#101a1f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const rand = seeded(17);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = rand() > 0.5 ? '#141a22' : '#0d1218';
    ctx.fillRect(Math.floor(rand() * w), Math.floor(rand() * h), 3 + Math.floor(rand() * 8), 1);
  }
  return canvas;
}

/** Rock formations for the parallax layers: columns and spires rising from a floor, silhouettes only. */
export function buildCaveLayer(w: number, h: number, tone: 'far' | 'near'): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(w, h);
  const rand = seeded(tone === 'far' ? 41 : 43);
  ctx.fillStyle = tone === 'far' ? '#10151c' : '#161b24';
  ctx.fillRect(0, h - 18, w, 18);
  const step = tone === 'far' ? 40 : 64;
  for (let x = 0; x < w; x += step) {
    const cx = x + Math.floor(rand() * step * 0.6);
    const top = Math.floor(h * (tone === 'far' ? 0.15 : 0.35) + rand() * h * 0.4);
    const half = 6 + Math.floor(rand() * (tone === 'far' ? 10 : 16));
    ctx.beginPath();
    ctx.moveTo(cx - half * 2, h);
    ctx.quadraticCurveTo(cx - half, h - (h - top) * 0.4, cx - 1, top);
    ctx.lineTo(cx + 1, top);
    ctx.quadraticCurveTo(cx + half, h - (h - top) * 0.4, cx + half * 2, h);
    ctx.fill();
  }
  if (tone === 'near') {
    ctx.fillStyle = '#1f2630';
    for (let x = 0; x < w; x += 64) ctx.fillRect(x + 20, h - 18, 10, 1);
  }
  quantizeAlpha(ctx, w, h);
  return canvas;
}

/** A low cushion of glowing moss (its light is a `glowmoss` light). 12 x 6. */
export function buildGlowMoss(): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(12, 6);
  ctx.fillStyle = '#2f5a52';
  ctx.fillRect(1, 3, 10, 3);
  ctx.fillRect(3, 2, 6, 1);
  ctx.fillStyle = GLOW;
  for (const [x, y] of [
    [2, 3],
    [5, 2],
    [8, 3],
    [10, 4],
    [4, 4],
  ] as const)
    ctx.fillRect(x, y, 1, 1);
  return canvas;
}

/** A stalagmite, for distant decoration. 16 x 28. */
export function buildStalagmite(): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(16, 28);
  ctx.fillStyle = ROCK;
  ctx.beginPath();
  ctx.moveTo(0, 28);
  ctx.quadraticCurveTo(5, 14, 8, 0);
  ctx.quadraticCurveTo(10, 14, 16, 28);
  ctx.fill();
  ctx.fillStyle = ROCK_LIGHT;
  ctx.fillRect(6, 8, 1, 14);
  quantizeAlpha(ctx, 16, 28);
  return canvas;
}

/**
 * A worked stone set out like an altar, with one treasure resting on it: a
 * pale ring standing on its edge, catching the light. `taken`: the bare
 * stone. 20 x 18.
 */
export function buildRelic(taken: boolean): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(20, 18);
  ctx.fillStyle = C.stone;
  ctx.fillRect(3, 10, 14, 8);
  ctx.fillRect(1, 16, 18, 2);
  ctx.fillStyle = C.stoneLight;
  ctx.fillRect(3, 10, 14, 1);
  ctx.fillStyle = C.stoneDark;
  ctx.fillRect(9, 12, 2, 4);
  ctx.fillStyle = C.mossLight;
  ctx.fillRect(3, 17, 4, 1);
  if (!taken) {
    // The ring: a small upright loop, pale metal with one bright glint.
    ctx.fillStyle = '#d8e4ec';
    ctx.fillRect(8, 3, 4, 1);
    ctx.fillRect(8, 9, 4, 1);
    ctx.fillRect(7, 4, 1, 5);
    ctx.fillRect(12, 4, 1, 5);
    ctx.fillStyle = '#8fa8b8';
    ctx.fillRect(8, 8, 4, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(8, 4, 1, 1);
    ctx.fillStyle = GLOW;
    ctx.fillRect(10, 1, 1, 1);
    ctx.fillRect(5, 6, 1, 1);
    ctx.fillRect(14, 5, 1, 1);
  }
  return canvas;
}
