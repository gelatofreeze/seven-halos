import { createCanvas, quantizeAlpha, seeded } from './canvas';
import { PALETTE as C } from './palette';

/**
 * Placeholder architecture and landmark art for the sanctuary and the forest
 * road. Still procedural and deliberately simple (the final art pass replaces
 * it), but composed: every symmetric piece is drawn as its left half and
 * mirrored, so its centre is exact. All textures anchor at bottom centre.
 */

const WARM_TOP = '#ffe9b8';
const WARM_BOTTOM = '#d9844f';
const WALL = '#2a2538';
const WALL_LIGHT = '#3a334c';
const WALL_DARK = '#1d1a29';
const GOLD = '#d9b866';
const GOLD_LIGHT = '#f4dc94';
const LEAF = ['#2f5a3c', '#3f7049', '#56885a', '#6f9e5e'];
const FLOWERS = ['#e8c0e8', '#ffe2a8', '#c8e0ff', '#ffffff'];

/** Copy the left half onto the right half, mirrored: the texture becomes exactly symmetric about w/2. */
export function mirrorLeftHalf(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w / 2; x++) {
      const src = (y * w + x) * 4;
      const dst = (y * w + (w - 1 - x)) * 4;
      for (let k = 0; k < 4; k++) d[dst + k] = d[src + k]!;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** An arched opening: rectangle with a semicircular head, top of the arch at y. */
function arch(ctx: CanvasRenderingContext2D, cx: number, w: number, top: number, bottom: number): void {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(cx - r, bottom);
  ctx.lineTo(cx - r, top + r);
  ctx.arc(cx, top + r, r, Math.PI, 0);
  ctx.lineTo(cx + r, bottom);
  ctx.closePath();
}

function warmGlass(ctx: CanvasRenderingContext2D, top: number, bottom: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, WARM_TOP);
  g.addColorStop(1, WARM_BOTTOM);
  return g;
}

/** Sanctuary hall geometry, shared by the wall, frame and ivy layers (texture px, centre = W/2). */
export const HALL = {
  w: 496,
  h: 112,
  /** Window centres as offsets from the axis, and their sizes. The central arch is the largest. */
  windows: [
    { dx: 0, w: 56, top: 10 },
    { dx: 96, w: 32, top: 34 },
    { dx: 192, w: 32, top: 34 },
  ],
  sill: 98,
  /** Column centres as offsets from the axis. */
  columns: [48, 144, 238],
} as const;

/** Back wall of the hall: coursed stone with five tall windows full of warm light. */
export function buildSanctuaryWall(): HTMLCanvasElement {
  const { w, h } = HALL;
  const { canvas, ctx } = createCanvas(w, h);
  const rand = seeded(3);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, WALL_DARK);
  g.addColorStop(1, WALL);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = WALL_DARK;
  for (let y = 8; y < h; y += 8) ctx.fillRect(0, y, w, 1);
  for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? 0 : 12; x < w / 2; x += 24) ctx.fillRect(x, y, 1, 8);
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = rand() > 0.5 ? WALL_LIGHT : WALL_DARK;
    ctx.fillRect(Math.floor(rand() * (w / 2)), Math.floor(rand() * h), 2, 1);
  }
  const cx = w / 2;
  for (const win of HALL.windows) {
    for (const x of win.dx === 0 ? [cx] : [cx - win.dx]) {
      // Deep reveal, then glass.
      ctx.fillStyle = WALL_DARK;
      arch(ctx, x, win.w + 6, win.top - 3, HALL.sill + 2);
      ctx.fill();
      ctx.fillStyle = warmGlass(ctx, win.top, HALL.sill);
      arch(ctx, x, win.w, win.top, HALL.sill);
      ctx.fill();
      // Tracery: a central mullion and a transom, and a rose in the big arch.
      ctx.fillStyle = '#4a3f58';
      ctx.fillRect(x - 1, win.top + win.w / 4, 2, HALL.sill - win.top - win.w / 4);
      ctx.fillRect(x - win.w / 2, Math.round((win.top + HALL.sill) / 2 + 8), win.w, 2);
      if (win.dx === 0) {
        ctx.strokeStyle = '#4a3f58';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, win.top + 16, 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#fff6d8';
        ctx.fillRect(x - 2, win.top + 14, 4, 4);
      }
      // Sill.
      ctx.fillStyle = C.stoneLight;
      ctx.fillRect(x - win.w / 2 - 4, HALL.sill, win.w + 8, 3);
    }
  }
  mirrorLeftHalf(ctx, w, h);
  return canvas;
}

/** Columns, arcade arches and cornice: the hall's structure, in front of the back wall. */
export function buildSanctuaryFrame(): HTMLCanvasElement {
  const { w, h } = HALL;
  const { canvas, ctx } = createCanvas(w, h);
  const cx = w / 2;
  // Cornice band.
  ctx.fillStyle = C.stoneLight;
  ctx.fillRect(0, 0, w, 6);
  ctx.fillStyle = C.stoneHighlight;
  ctx.fillRect(0, 6, w, 1);
  ctx.fillStyle = GOLD;
  for (let x = 4; x < w / 2; x += 12) ctx.fillRect(x, 2, 4, 2);
  // Columns with bases and capitals.
  for (const dx of HALL.columns) {
    const x = cx - dx;
    ctx.fillStyle = C.stone;
    ctx.fillRect(x - 6, 7, 12, h - 7);
    ctx.fillStyle = C.stoneHighlight;
    ctx.fillRect(x - 6, 7, 2, h - 7);
    ctx.fillStyle = C.stoneDark;
    ctx.fillRect(x + 4, 7, 2, h - 7);
    ctx.fillStyle = C.stoneLight;
    ctx.fillRect(x - 8, 7, 16, 5);
    ctx.fillRect(x - 9, h - 8, 18, 8);
    ctx.fillStyle = GOLD;
    ctx.fillRect(x - 8, 11, 16, 1);
  }
  // Arcade arches between columns, framing each window.
  ctx.strokeStyle = C.stoneLight;
  ctx.lineWidth = 4;
  const spans: [number, number][] = [
    [-48, 48],
    [48, 144],
    [144, 238],
  ];
  for (const [a, b] of spans) {
    for (const sign of [-1, 1]) {
      const x0 = cx + sign * a;
      const x1 = cx + sign * b;
      const mid = (x0 + x1) / 2;
      const r = Math.abs(x1 - x0) / 2 - 6;
      ctx.beginPath();
      ctx.arc(mid, 12 + r, r, Math.PI, 0);
      ctx.stroke();
    }
  }
  // Keystone over the central arch.
  ctx.fillStyle = GOLD_LIGHT;
  ctx.fillRect(cx - 3, 7, 6, 7);
  quantizeAlpha(ctx, w, h);
  mirrorLeftHalf(ctx, w, h);
  return canvas;
}

/** Ivy, moss and fallen masonry over the hall: the one deliberately asymmetric layer (decay). */
export function buildSanctuaryIvy(): HTMLCanvasElement {
  const { w, h } = HALL;
  const { canvas, ctx } = createCanvas(w, h);
  const rand = seeded(29);
  // Strands hanging from the cornice, denser at the edges and over the broken roof.
  for (let i = 0; i < 46; i++) {
    const edge = rand() < 0.5 ? rand() * 120 : w - rand() * 120;
    const x = Math.floor(i % 4 === 0 ? 160 + rand() * 176 : edge);
    const len = 8 + Math.floor(rand() * (i % 4 === 0 ? 26 : 60));
    for (let y = 6; y < 6 + len; y += 2) {
      ctx.fillStyle = LEAF[Math.floor(rand() * LEAF.length)]!;
      ctx.fillRect(x + Math.round(Math.sin(y * 0.3 + i) * 1.5), y, 2 + Math.floor(rand() * 2), 2);
    }
    if (rand() > 0.6) {
      ctx.fillStyle = FLOWERS[Math.floor(rand() * FLOWERS.length)]!;
      ctx.fillRect(x, 6 + len, 1, 1);
    }
  }
  // Rubble at the foot of the walls.
  for (const x0 of [6, w - 58]) {
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = rand() > 0.5 ? C.stoneLight : C.stone;
      const bw = 4 + Math.floor(rand() * 8);
      ctx.fillRect(x0 + Math.floor(rand() * 44), h - 3 - Math.floor(rand() * 5), bw, 3 + Math.floor(rand() * 3));
    }
    ctx.fillStyle = C.mossLight;
    ctx.fillRect(x0 + 10, h - 4, 18, 1);
  }
  return canvas;
}

/** The roofline pediment, with a halo oculus on the axis. Width matches the hall's outer walls. */
export function buildGable(): HTMLCanvasElement {
  const w = 560;
  const h = 44;
  const { canvas, ctx } = createCanvas(w, h);
  const cx = w / 2;
  ctx.fillStyle = C.stone;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(cx, 4);
  ctx.lineTo(w, h);
  ctx.fill();
  ctx.strokeStyle = C.stoneHighlight;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, h - 1);
  ctx.lineTo(cx, 4);
  ctx.lineTo(w, h - 1);
  ctx.stroke();
  ctx.fillStyle = C.stoneLight;
  ctx.fillRect(0, h - 4, w, 4);
  // Oculus.
  ctx.fillStyle = WALL_DARK;
  ctx.beginPath();
  ctx.arc(cx, 28, 11, 0, Math.PI * 2);
  ctx.fill();
  quantizeAlpha(ctx, w, h);
  mirrorLeftHalf(ctx, w, h);
  // A missing block of the cornice: weathering, not structure.
  ctx.clearRect(84, h - 4, 14, 4);
  return canvas;
}

/** A golden Halo: ring and rays. The sacred emblem, used on the sanctuary's axis. */
export function buildHalo(): HTMLCanvasElement {
  const s = 28;
  const { canvas, ctx } = createCanvas(s, s);
  const c = s / 2;
  ctx.strokeStyle = GOLD_LIGHT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(c, c, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = GOLD;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.fillRect(Math.round(c + Math.cos(a) * 11) - 1, Math.round(c + Math.sin(a) * 11) - 1, 2, 2);
  }
  quantizeAlpha(ctx, s, s);
  return canvas;
}

/** Door lintel geometry: exactly a two-tile wall's thickness, sitting on the opening's top edge. */
export const LINTEL = { w: 32, h: 14 } as const;

/**
 * A flat (jack) arch over a doorway through a two-tile-thick wall: wedge
 * stones with a keystone, set into the wall above the opening. It is exactly
 * as wide as the wall and its bottom edge is the top of the opening, so it
 * never hangs past the masonry or into the passage.
 */
export function buildDoorArch(): HTMLCanvasElement {
  const { w, h } = LINTEL;
  const { canvas, ctx } = createCanvas(w, h);
  const cx = w / 2;
  ctx.fillStyle = C.stoneLight;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = C.stoneDark;
  // Radial joints between the wedge stones, fanning out from below the opening.
  for (let i = 1; i < 8; i++) {
    if (i === 4) continue;
    const xb = (i / 8) * w;
    const xt = cx + (xb - cx) * 1.35;
    ctx.beginPath();
    ctx.moveTo(xb, h);
    ctx.lineTo(xt, 0);
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.stoneDark;
    ctx.stroke();
  }
  ctx.fillRect(0, h - 1, w, 1);
  ctx.fillStyle = C.stoneHighlight;
  ctx.fillRect(0, 0, w, 1);
  ctx.fillStyle = GOLD;
  ctx.fillRect(cx - 3, 1, 6, h - 2);
  ctx.fillStyle = GOLD_LIGHT;
  ctx.fillRect(cx - 3, 1, 6, 1);
  quantizeAlpha(ctx, w, h);
  mirrorLeftHalf(ctx, w, h);
  return canvas;
}

/** A shaft of light falling through the broken roof; soft, additive. */
export function buildLightShaft(): HTMLCanvasElement {
  const w = 104;
  const h = 112;
  const { canvas, ctx } = createCanvas(w, h);
  for (let x = 0; x < w; x++) {
    const edge = Math.min(1, Math.min(x, w - 1 - x) / 26);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `rgba(255,248,220,${0.42 * edge})`);
    g.addColorStop(0.75, `rgba(255,240,200,${0.16 * edge})`);
    g.addColorStop(1, `rgba(255,236,190,${0.05 * edge})`);
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 1, h);
  }
  return canvas;
}

/** Wayside stele with a carved halo and a small lantern: marks a road between regions. */
export function buildWaymarker(): HTMLCanvasElement {
  const w = 16;
  const h = 38;
  const { canvas, ctx } = createCanvas(w, h);
  ctx.fillStyle = C.stone;
  ctx.fillRect(3, 8, 10, 28);
  ctx.fillRect(1, 34, 14, 4);
  ctx.beginPath();
  ctx.arc(8, 9, 5, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = C.stoneHighlight;
  ctx.fillRect(3, 8, 1, 26);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(8, 15, 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = C.iron;
  ctx.fillRect(12, 20, 3, 1);
  ctx.fillStyle = '#ffe2a8';
  ctx.fillRect(13, 21, 2, 3);
  ctx.fillStyle = C.mossLight;
  ctx.fillRect(3, 32, 5, 2);
  quantizeAlpha(ctx, w, h);
  return canvas;
}

/** Wall sconce geometry: the plate must sit on masonry (a column or a wall). */
export const SCONCE = { w: 10, h: 22, plate: { w: 8, h: 12 } } as const;

/**
 * A wall sconce: a riveted iron plate fixed to the stone, and the torch held
 * out from it in a ring (the flame is animated separately).
 */
export function buildTorch(): HTMLCanvasElement {
  const { w, h } = SCONCE;
  const { canvas, ctx } = createCanvas(w, h);
  // Plate.
  ctx.fillStyle = C.iron;
  ctx.fillRect(1, 8, 8, 12);
  ctx.fillStyle = C.stoneDark;
  ctx.fillRect(1, 19, 8, 1);
  ctx.fillStyle = GOLD;
  ctx.fillRect(2, 9, 1, 1);
  ctx.fillRect(7, 9, 1, 1);
  ctx.fillRect(2, 18, 1, 1);
  ctx.fillRect(7, 18, 1, 1);
  // Ring and torch.
  ctx.fillStyle = '#7a7f92';
  ctx.fillRect(3, 6, 4, 2);
  ctx.fillStyle = C.wood;
  ctx.fillRect(4, 2, 2, 12);
  ctx.fillStyle = C.woodLight;
  ctx.fillRect(4, 2, 1, 12);
  return canvas;
}

/** A free-standing torch post (iron bowl on a pole, on a stone foot), 10 x 44. */
export function buildTorchPost(): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(10, 44);
  ctx.fillStyle = C.stone;
  ctx.fillRect(1, 38, 8, 6);
  ctx.fillStyle = C.stoneHighlight;
  ctx.fillRect(1, 38, 8, 1);
  ctx.fillStyle = C.wood;
  ctx.fillRect(4, 6, 2, 32);
  ctx.fillStyle = C.iron;
  ctx.fillRect(1, 3, 8, 3);
  ctx.fillRect(3, 6, 4, 2);
  ctx.fillStyle = '#ffb35c';
  ctx.fillRect(2, 2, 6, 1);
  return canvas;
}

/** Brazier bowl without flame (the flame is animated separately), 16 x 24. */
export function buildBrazierBase(): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(16, 24);
  ctx.fillStyle = C.iron;
  ctx.fillRect(3, 8, 10, 4);
  ctx.fillRect(7, 12, 2, 10);
  ctx.fillRect(4, 22, 8, 2);
  ctx.fillStyle = C.stoneDark;
  ctx.fillRect(4, 11, 8, 1);
  ctx.fillStyle = '#ffb35c';
  ctx.fillRect(4, 7, 8, 1);
  return canvas;
}

/** Flame animation: `frames` frames of 10 x 14 side by side (bottom centre anchored). */
export function buildFlameSheet(frames: number): HTMLCanvasElement {
  const fw = 10;
  const fh = 14;
  const { canvas, ctx } = createCanvas(fw * frames, fh);
  for (let f = 0; f < frames; f++) {
    const ox = f * fw;
    const sway = [0, 1, 0, -1][f % 4]!;
    const tall = [12, 10, 13, 11][f % 4]!;
    ctx.fillStyle = '#ff7a30';
    ctx.beginPath();
    ctx.ellipse(ox + 5, fh - 4, 4, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(ox + 1, fh - 4);
    ctx.quadraticCurveTo(ox + 5 + sway * 2, fh - tall - 2, ox + 5 + sway, fh - tall);
    ctx.quadraticCurveTo(ox + 6 + sway, fh - tall + 4, ox + 9, fh - 4);
    ctx.fill();
    ctx.fillStyle = '#ffc070';
    ctx.beginPath();
    ctx.ellipse(ox + 5, fh - 4, 2.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff2c8';
    ctx.fillRect(ox + 4 + Math.max(0, sway), fh - 6, 2, 3);
  }
  quantizeAlpha(ctx, fw * frames, fh);
  return canvas;
}

/** The forest's ancient tree: a vast trunk and canopy the climb is built around, 176 x 236. */
export function buildAncientTree(): HTMLCanvasElement {
  const w = 176;
  const h = 236;
  const { canvas, ctx } = createCanvas(w, h);
  const rand = seeded(61);
  const bark = '#3a2c26';
  const barkLight = '#5a453a';
  // Roots.
  ctx.fillStyle = bark;
  ctx.beginPath();
  ctx.moveTo(50, h);
  ctx.quadraticCurveTo(76, h - 30, 74, h - 60);
  ctx.lineTo(104, h - 60);
  ctx.quadraticCurveTo(102, h - 30, 130, h);
  ctx.fill();
  // Trunk.
  ctx.fillRect(74, 60, 30, h - 110);
  ctx.fillStyle = barkLight;
  ctx.fillRect(77, 60, 3, h - 110);
  ctx.fillRect(92, 90, 2, 60);
  // Branch stubs where the climb's branches meet the trunk.
  ctx.fillStyle = bark;
  for (const [y, dir] of [
    [h - 56, -1],
    [h - 104, 1],
    [h - 152, -1],
  ] as const) {
    ctx.fillRect(dir < 0 ? 52 : 104, y, 22, 7);
  }
  // Moss.
  ctx.fillStyle = C.moss;
  for (let y = 70; y < h - 40; y += 7) if (rand() > 0.35) ctx.fillRect(98, y, 4, 4);
  // Canopy.
  for (let i = 0; i < 60; i++) {
    const cx = 88 + (rand() - 0.5) * 168;
    const cy = 44 + (rand() - 0.5) * 80;
    ctx.fillStyle = LEAF[Math.floor(rand() * LEAF.length)]!;
    ctx.beginPath();
    ctx.arc(cx, cy, 10 + rand() * 14, 0, Math.PI * 2);
    ctx.fill();
  }
  quantizeAlpha(ctx, w, h);
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = FLOWERS[i % FLOWERS.length]!;
    ctx.fillRect(Math.floor(20 + rand() * 136), Math.floor(14 + rand() * 70), 1, 1);
  }
  return canvas;
}

/** A ruined colonnade (distant): columns, one fallen, under a broken architrave. 256 x 104. */
export function buildColonnade(): HTMLCanvasElement {
  const w = 256;
  const h = 104;
  const { canvas, ctx } = createCanvas(w, h);
  const xs = [16, 72, 128, 184, 240];
  ctx.fillStyle = '#2b2740';
  ctx.fillRect(0, 10, 150, 8);
  ctx.fillRect(170, 14, 86, 6);
  xs.forEach((x, i) => {
    const top = i === 3 ? 58 : 16;
    ctx.fillStyle = '#2b2740';
    ctx.fillRect(x - 7, top, 14, h - top);
    ctx.fillStyle = '#3a3554';
    ctx.fillRect(x - 7, top, 2, h - top);
    ctx.fillRect(x - 9, h - 6, 18, 6);
  });
  // The fallen drum.
  ctx.fillStyle = '#2b2740';
  ctx.fillRect(196, h - 12, 30, 10);
  quantizeAlpha(ctx, w, h);
  return canvas;
}

/** A fallen column lying in the grass, 48 x 14. */
export function buildFallenColumn(): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(48, 14);
  ctx.fillStyle = C.stone;
  ctx.fillRect(2, 4, 26, 10);
  ctx.fillRect(30, 6, 16, 8);
  ctx.fillStyle = C.stoneHighlight;
  ctx.fillRect(2, 4, 26, 1);
  ctx.fillRect(30, 6, 16, 1);
  ctx.fillStyle = C.mossLight;
  ctx.fillRect(8, 3, 6, 2);
  ctx.fillRect(36, 5, 4, 1);
  return canvas;
}

/** A small cluster of flowers, 16 x 8. */
export function buildFlowers(): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(16, 8);
  const rand = seeded(13);
  ctx.fillStyle = '#3f7049';
  for (let x = 1; x < 15; x += 2) ctx.fillRect(x, 3 + Math.floor(rand() * 3), 1, 5);
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = FLOWERS[i % FLOWERS.length]!;
    ctx.fillRect(1 + Math.floor(rand() * 14), 1 + Math.floor(rand() * 4), 2, 2);
  }
  return canvas;
}

/** The old stone bridge under the ravine crossing: arches with the middle span fallen. 224 x 84. */
export function buildBridgeRuin(): HTMLCanvasElement {
  const w = 224;
  const h = 84;
  const { canvas, ctx } = createCanvas(w, h);
  ctx.fillStyle = '#2e2a40';
  // Piers.
  ctx.fillRect(0, 0, 18, h);
  ctx.fillRect(w - 18, 0, 18, h);
  ctx.fillRect(96, 26, 32, h - 26);
  // The surviving arches, either side of the fallen span.
  ctx.fillRect(18, 0, 60, 10);
  ctx.fillRect(w - 78, 0, 60, 10);
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = '#3c3654';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(57, 30, 40, Math.PI, 1.6 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w - 57, 30, 40, 1.4 * Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = C.mossLight;
  for (const x of [6, 104, w - 12]) ctx.fillRect(x, 0, 6, 3);
  quantizeAlpha(ctx, w, h);
  return canvas;
}

/** A thin stream at the bottom of the ravine, 192 x 8. */
export function buildStream(): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(192, 8);
  const rand = seeded(9);
  ctx.fillStyle = '#25435a';
  ctx.fillRect(0, 2, 192, 6);
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = rand() > 0.5 ? '#6fb0d0' : '#9fd8ee';
    ctx.fillRect(Math.floor(rand() * 190), 2 + Math.floor(rand() * 4), 3, 1);
  }
  return canvas;
}

/** A small sacred arch that frames a wilderness shrine, 96 x 84. */
export function buildShrineArch(): HTMLCanvasElement {
  const w = 96;
  const h = 84;
  const { canvas, ctx } = createCanvas(w, h);
  const cx = w / 2;
  ctx.fillStyle = C.stoneLight;
  arch(ctx, cx, 80, 6, h);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  arch(ctx, cx, 60, 16, h);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = C.stoneHighlight;
  ctx.fillRect(8, 40, 2, h - 40);
  ctx.fillStyle = GOLD;
  ctx.fillRect(cx - 3, 6, 6, 9);
  ctx.fillStyle = C.mossLight;
  ctx.fillRect(10, 60, 4, 10);
  quantizeAlpha(ctx, w, h);
  mirrorLeftHalf(ctx, w, h);
  return canvas;
}

/** The first castle, far away: a dark silhouette with a few lit windows, 320 x 200. */
export function buildCastle(): HTMLCanvasElement {
  const w = 320;
  const h = 200;
  const { canvas, ctx } = createCanvas(w, h);
  ctx.fillStyle = '#2c2650';
  ctx.fillRect(40, 90, 240, 110);
  const towers: [number, number, number][] = [
    [40, 50, 30],
    [100, 20, 26],
    [160, 0, 34],
    [220, 30, 26],
    [270, 60, 30],
  ];
  for (const [x, top, tw] of towers) {
    ctx.fillRect(x - tw / 2, top + 12, tw, h);
    ctx.beginPath();
    ctx.moveTo(x - tw / 2 - 2, top + 14);
    ctx.lineTo(x, top);
    ctx.lineTo(x + tw / 2 + 2, top + 14);
    ctx.fill();
  }
  ctx.fillStyle = '#c89cff';
  for (const [x, y] of [
    [160, 40],
    [100, 64],
    [220, 70],
    [140, 120],
    [190, 130],
  ] as const) ctx.fillRect(x - 1, y, 2, 4);
  // The base dissolves into mist: no hard bottom edge wherever the trees leave a gap.
  ctx.globalCompositeOperation = 'destination-out';
  const mist = ctx.createLinearGradient(0, 110, 0, h);
  mist.addColorStop(0, 'rgba(0,0,0,0)');
  mist.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = mist;
  ctx.fillRect(0, 110, w, h - 110);
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}
