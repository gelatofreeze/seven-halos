import { createCanvas, quantizeAlpha, seeded } from './canvas';
import { PALETTE as C } from './palette';

/**
 * Placeholder art for the forest road's organic pieces: the ancient tree and
 * its roots, the hollow beneath it, the remains of the old bridge, and the
 * small growth that softens broken stone. Procedural and deliberately simple
 * (the final art pass replaces it). Several pieces are drawn to line up with
 * specific tiles in `data/world/forestRoad.ts`; their sizes are exported so the
 * prop footprints use the same numbers.
 */

const BARK = '#3a2c26';
const BARK_DARK = '#261c18';
const BARK_LIGHT = '#5a453a';
const LEAF = ['#2f5a3c', '#3f7049', '#56885a', '#6f9e5e'];
const GRASS = '#3f7049';
const GRASS_LIGHT = '#6f9e5e';

/** A filled tapering limb from (x0, y0, thickness t0) to (x1, y1, t1), as a quad with a curved belly. */
function limb(ctx: CanvasRenderingContext2D, x0: number, y0: number, t0: number, x1: number, y1: number, t1: number, sag = 0): void {
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2 + sag;
  ctx.beginPath();
  ctx.moveTo(x0, y0 - t0 / 2);
  ctx.quadraticCurveTo(mx, my - (t0 + t1) / 4, x1, y1 - t1 / 2);
  ctx.lineTo(x1, y1 + t1 / 2);
  ctx.quadraticCurveTo(mx, my + (t0 + t1) / 4, x0, y0 + t0 / 2);
  ctx.closePath();
  ctx.fill();
}

function leafCluster(ctx: CanvasRenderingContext2D, rand: () => number, cx: number, cy: number, rx: number, ry: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand());
    ctx.fillStyle = LEAF[Math.floor(rand() * LEAF.length)]!;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r, 6 + rand() * 9, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * The ancient tree, 224 x 300, bottom centre on the mound between its root
 * shoulders. In texture coordinates the trunk spans x 80-128; the west limb's
 * platform runs x 0-80 at y 220 and the east limb's x 112-208 at y 172 (the
 * tiles draw the walkable bark; this draws the limbs' thickness and joints).
 */
export const ANCIENT_TREE = { w: 224, h: 300 } as const;

export function buildAncientTree(): HTMLCanvasElement {
  const { w, h } = ANCIENT_TREE;
  const { canvas, ctx } = createCanvas(w, h);
  const rand = seeded(61);
  // Canopy first (the trunk and limbs grow in front of its lower edge).
  leafCluster(ctx, rand, 112, 74, 104, 54, 70);
  leafCluster(ctx, rand, 22, 190, 22, 16, 10);
  leafCluster(ctx, rand, 206, 148, 18, 16, 9);
  // Shade under the canopy.
  ctx.fillStyle = 'rgba(10,16,14,0.35)';
  ctx.fillRect(70, 110, 70, 40);
  // Trunk: wide at the base, leaning slightly, flaring into the roots.
  ctx.fillStyle = BARK;
  ctx.beginPath();
  ctx.moveTo(84, 70);
  ctx.lineTo(122, 70);
  ctx.quadraticCurveTo(126, 180, 130, 250);
  ctx.quadraticCurveTo(136, 284, 150, h);
  ctx.lineTo(62, h);
  ctx.quadraticCurveTo(74, 280, 78, 250);
  ctx.quadraticCurveTo(82, 170, 84, 70);
  ctx.fill();
  // The two limbs, thick where they leave the trunk.
  limb(ctx, 92, 228, 18, 4, 223, 6, 4);
  limb(ctx, 116, 182, 18, 210, 175, 6, 3);
  // A dead upper limb into the canopy.
  limb(ctx, 100, 120, 10, 40, 96, 4, -6);
  limb(ctx, 112, 110, 10, 176, 88, 4, -4);
  // Bark: furrows and a lit edge.
  ctx.fillStyle = BARK_LIGHT;
  ctx.fillRect(86, 76, 3, 170);
  for (let y = 80; y < 270; y += 9) ctx.fillRect(96 + Math.floor(rand() * 20), y, 1, 5 + Math.floor(rand() * 5));
  ctx.fillRect(30, 220, 40, 1);
  ctx.fillRect(132, 172, 50, 1);
  ctx.fillStyle = BARK_DARK;
  for (let y = 84; y < 280; y += 11) ctx.fillRect(104 + Math.floor(rand() * 16), y, 1, 6);
  // A knot hole.
  ctx.fillRect(108, 146, 6, 8);
  ctx.fillStyle = '#0c0b10';
  ctx.fillRect(109, 148, 4, 5);
  // Moss on the north side and the limbs' tops.
  ctx.fillStyle = C.moss;
  for (let y = 90; y < 260; y += 6) if (rand() > 0.4) ctx.fillRect(118 + Math.floor(rand() * 4), y, 3, 4);
  ctx.fillStyle = C.mossLight;
  for (let x = 20; x < 80; x += 7) if (rand() > 0.3) ctx.fillRect(x, 218, 3, 1);
  for (let x = 130; x < 200; x += 7) if (rand() > 0.3) ctx.fillRect(x, 170, 3, 1);
  // Vines hanging from the limbs.
  ctx.fillStyle = GRASS;
  for (const [x, y, len] of [
    [30, 228, 18],
    [52, 230, 10],
    [150, 180, 22],
    [176, 179, 14],
    [196, 178, 26],
  ] as const) {
    for (let k = 0; k < len; k++) ctx.fillRect(x + Math.round(Math.sin(k * 0.5)), y + k, 1, 1);
    ctx.fillStyle = GRASS_LIGHT;
    ctx.fillRect(x - 1, y + len - 2, 3, 2);
    ctx.fillStyle = GRASS;
  }
  quantizeAlpha(ctx, w, h);
  // Pale blossoms high in the canopy.
  for (let i = 0; i < 22; i++) {
    ctx.fillStyle = i % 3 ? '#e8c0e8' : '#ffffff';
    ctx.fillRect(Math.floor(20 + rand() * 184), Math.floor(24 + rand() * 80), 1, 1);
  }
  return canvas;
}

/**
 * The tree's roots, drawn over the root-shoulder tiles (so the mound reads as
 * roots heaving the earth, not a heap of blocks) and arching over the hollow.
 * 128 x 56, bottom centre on the road line under the trunk.
 */
export const TREE_ROOTS = { w: 128, h: 56 } as const;

export function buildTreeRoots(): HTMLCanvasElement {
  const { w, h } = TREE_ROOTS;
  const { canvas, ctx } = createCanvas(w, h);
  // World: x 848-976, y 248-304. The shoulder tiles' tops are at texture y 24
  // (x 16-48) and 40 (x 0-16 and 80-112); the road is at 56. Roots never rise
  // above those lines, so what looks like root is exactly what can be stood on.
  const root = (width: number, color: string, pts: readonly (readonly [number, number])[]) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0]![0], pts[0]![1]);
    for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
    ctx.stroke();
  };
  // Back roots (shaded), then the main ones.
  root(12, BARK_DARK, [
    [42, 46],
    [26, 50],
    [14, 60],
  ]);
  root(10, BARK_DARK, [
    [86, 52],
    [100, 54],
  ]);
  root(14, BARK, [
    [44, 31],
    [24, 31],
  ]);
  root(10, BARK, [
    [22, 33],
    [10, 46],
    [4, 60],
  ]);
  root(12, BARK, [
    [84, 47],
    [100, 47],
    [108, 51],
  ]);
  root(7, BARK, [
    [108, 51],
    [118, 59],
  ]);
  // The arch over the hollow, from the trunk's west root to the east one.
  root(8, BARK, [
    [44, 29],
    [56, 28],
    [70, 31],
    [84, 42],
  ]);
  // Lit tops, furrows, moss.
  ctx.fillStyle = BARK_LIGHT;
  ctx.fillRect(20, 24, 24, 1);
  ctx.fillRect(4, 41, 8, 1);
  ctx.fillRect(84, 41, 18, 1);
  ctx.fillRect(50, 25, 16, 1);
  ctx.fillStyle = BARK_DARK;
  for (const [x, y] of [
    [28, 30],
    [36, 33],
    [14, 44],
    [92, 47],
    [62, 30],
  ] as const)
    ctx.fillRect(x, y, 4, 1);
  ctx.fillStyle = C.mossLight;
  for (const [x, y] of [
    [24, 24],
    [38, 24],
    [6, 41],
    [96, 41],
    [56, 25],
  ] as const)
    ctx.fillRect(x, y, 3, 1);
  // Root tips hanging into the mouth of the hollow.
  ctx.fillStyle = BARK_DARK;
  for (const [x, len] of [
    [54, 8],
    [62, 5],
    [72, 7],
  ] as const)
    ctx.fillRect(x, 32, 1, len);
  quantizeAlpha(ctx, w, h);
  return canvas;
}

/** The dark mouth under the roots, with a faint cold breath of the cave below. 32 x 36. */
export const ROOT_HOLLOW = { w: 32, h: 36 } as const;

export function buildRootHollow(): HTMLCanvasElement {
  const { w, h } = ROOT_HOLLOW;
  const { canvas, ctx } = createCanvas(w, h);
  ctx.fillStyle = '#07070c';
  ctx.beginPath();
  ctx.moveTo(1, h);
  ctx.lineTo(2, 14);
  ctx.quadraticCurveTo(16, -2, 30, 12);
  ctx.lineTo(31, h);
  ctx.closePath();
  ctx.fill();
  // Depth: it goes down, not back.
  const g = ctx.createLinearGradient(0, 8, 0, h);
  g.addColorStop(0, 'rgba(20,32,40,0)');
  g.addColorStop(1, 'rgba(60,110,120,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(4, 14, w - 8, h - 14);
  ctx.fillStyle = '#16141c';
  ctx.fillRect(3, 20, 2, 10);
  ctx.fillRect(26, 16, 2, 14);
  // Two motes of the cave's light.
  ctx.fillStyle = '#9fe8d8';
  ctx.fillRect(12, 28, 1, 1);
  ctx.fillRect(20, 24, 1, 1);
  return canvas;
}

/**
 * What survives of the old bridge's arches: springers and broken arch rings
 * under each span stub and either side of the pier, dim and behind the
 * tiles, so they read as structure, never as somewhere to stand. 208 x 64,
 * bottom centre on the ravine floor under the pier (texture x 0 = the west
 * span stub's face minus 32 px; the pier spans x 80-128).
 */
export const BRIDGE_RUIN = { w: 208, h: 64 } as const;

export function buildBridgeRuin(): HTMLCanvasElement {
  const { w, h } = BRIDGE_RUIN;
  const { canvas, ctx } = createCanvas(w, h);
  ctx.strokeStyle = '#2b2740';
  ctx.lineWidth = 7;
  // West opening (x 32-80): the ring broken off near the crown.
  ctx.beginPath();
  ctx.arc(56, 26, 22, Math.PI, 1.38 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(56, 26, 22, 1.72 * Math.PI, 2 * Math.PI);
  ctx.stroke();
  // East opening (x 128-176): less survives.
  ctx.beginPath();
  ctx.arc(152, 26, 22, Math.PI, 1.22 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(152, 26, 22, 1.62 * Math.PI, 2 * Math.PI);
  ctx.stroke();
  // Voussoir joints on the surviving rings.
  ctx.fillStyle = '#1d1a29';
  for (const [x, y] of [
    [36, 18],
    [42, 10],
    [74, 12],
    [133, 22],
    [170, 13],
  ] as const)
    ctx.fillRect(x, y, 2, 3);
  // Fallen voussoirs half sunk in the silt.
  ctx.fillStyle = '#2b2740';
  ctx.fillRect(58, h - 6, 9, 6);
  ctx.fillRect(140, h - 5, 7, 5);
  ctx.fillStyle = C.mossLight;
  ctx.fillRect(58, h - 6, 5, 1);
  ctx.fillRect(34, 22, 3, 1);
  ctx.fillRect(174, 22, 3, 1);
  quantizeAlpha(ctx, w, h);
  return canvas;
}

/** Roots hanging down a broken face (mounted at the top). 10 x 28. */
export const HANGING_ROOTS = { w: 10, h: 28 } as const;

export function buildHangingRoots(): HTMLCanvasElement {
  const { w, h } = HANGING_ROOTS;
  const { canvas, ctx } = createCanvas(w, h);
  const rand = seeded(23);
  ctx.fillStyle = BARK;
  ctx.fillRect(1, 0, 8, 3);
  for (const [x, len] of [
    [2, 26],
    [5, 18],
    [7, 23],
  ] as const) {
    for (let y = 2; y < len; y++) ctx.fillRect(x + (y % 7 < 3 ? 0 : 1) - (rand() > 0.85 ? 1 : 0), y, 1, 1);
  }
  ctx.fillStyle = C.mossLight;
  ctx.fillRect(1, 0, 4, 1);
  return canvas;
}

/** Ivy trailing down a wall face (mounted at the top). 8 x 24. */
export const IVY = { w: 8, h: 24 } as const;

export function buildIvy(): HTMLCanvasElement {
  const { w, h } = IVY;
  const { canvas, ctx } = createCanvas(w, h);
  const rand = seeded(31);
  for (let y = 0; y < h; y++) {
    const x = 3 + Math.round(Math.sin(y * 0.45) * 2);
    ctx.fillStyle = GRASS;
    ctx.fillRect(x, y, 1, 1);
    if (rand() > 0.45) {
      ctx.fillStyle = rand() > 0.5 ? GRASS_LIGHT : '#56885a';
      ctx.fillRect(x + (rand() > 0.5 ? 1 : -2), y, 2, 2);
    }
  }
  return canvas;
}

/** A few fallen stones on the ground. 16 x 8. */
export function buildRubble(): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(16, 8);
  ctx.fillStyle = C.stone;
  ctx.fillRect(1, 3, 6, 5);
  ctx.fillRect(8, 5, 4, 3);
  ctx.fillRect(12, 6, 3, 2);
  ctx.fillStyle = C.stoneLight;
  ctx.fillRect(1, 3, 6, 1);
  ctx.fillRect(8, 5, 4, 1);
  ctx.fillStyle = C.mossLight;
  ctx.fillRect(2, 2, 3, 1);
  return canvas;
}

/** A low fern. 16 x 10. */
export function buildFern(): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(16, 10);
  ctx.fillStyle = GRASS;
  for (const [x0, dir] of [
    [7, -1],
    [8, 1],
    [7, 0],
  ] as const) {
    for (let k = 0; k < 8; k++) {
      const x = x0 + dir * k;
      const y = 9 - Math.round(Math.sqrt(k) * (dir === 0 ? 3 : 2.2));
      ctx.fillRect(x, y, 1, 1);
      if (k % 2 === 0) ctx.fillRect(x, y - 1, 1, 1);
    }
  }
  ctx.fillStyle = GRASS_LIGHT;
  ctx.fillRect(3, 5, 1, 1);
  ctx.fillRect(12, 5, 1, 1);
  ctx.fillRect(7, 1, 1, 1);
  return canvas;
}
