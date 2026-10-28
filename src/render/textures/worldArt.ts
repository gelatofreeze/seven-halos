import { createCanvas, quantizeAlpha, seeded } from './canvas';
import { PALETTE as C } from './palette';

/**
 * Placeholder world props for the sanctuary and the forest road. Procedural
 * and deliberately simple: the final art pass replaces them, keeping the
 * texture keys and foot anchors (bottom centre).
 */

const LEAF = ['#2f5a3c', '#3f7049', '#56885a', '#6f9e5e'];
const BARK = '#3a2c26';
const BARK_LIGHT = '#57423a';
const FLOWERS = ['#e8c0e8', '#ffe2a8', '#c8e0ff'];

/** A tall forest tree with a mossy trunk, 64 x 112. */
export function buildTree(): HTMLCanvasElement {
  const w = 64;
  const h = 112;
  const { canvas, ctx } = createCanvas(w, h);
  const rand = seeded(17);
  ctx.fillStyle = BARK;
  ctx.fillRect(28, 40, 9, 72);
  ctx.fillRect(24, 104, 17, 8);
  ctx.fillStyle = BARK_LIGHT;
  ctx.fillRect(29, 40, 2, 70);
  ctx.fillStyle = C.moss;
  for (let y = 60; y < 108; y += 5) if (rand() > 0.4) ctx.fillRect(34, y, 3, 3);
  for (let i = 0; i < 26; i++) {
    const cx = 32 + (rand() - 0.5) * 46;
    const cy = 30 + (rand() - 0.5) * 42;
    const r = 7 + rand() * 9;
    ctx.fillStyle = LEAF[Math.floor(rand() * LEAF.length)]!;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  quantizeAlpha(ctx, w, h);
  return canvas;
}

/** A low flowering bush, 24 x 12. */
export function buildBush(): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(24, 12);
  const rand = seeded(5);
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = LEAF[Math.floor(rand() * 3)]!;
    ctx.beginPath();
    ctx.arc(4 + rand() * 16, 7 + rand() * 3, 3 + rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  quantizeAlpha(ctx, 24, 12);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = FLOWERS[i % FLOWERS.length]!;
    ctx.fillRect(3 + Math.floor(rand() * 18), 2 + Math.floor(rand() * 6), 1, 1);
  }
  return canvas;
}

/** A broken, overgrown column, 16 x 44. */
export function buildRuin(): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(16, 44);
  ctx.fillStyle = C.stone;
  ctx.fillRect(3, 8, 10, 32);
  ctx.fillStyle = C.stoneLight;
  ctx.fillRect(3, 8, 2, 32);
  ctx.fillRect(1, 38, 14, 6);
  ctx.fillStyle = C.stoneDark;
  ctx.fillRect(8, 8, 1, 32);
  ctx.beginPath();
  ctx.moveTo(3, 8);
  ctx.lineTo(7, 3);
  ctx.lineTo(10, 7);
  ctx.lineTo(13, 4);
  ctx.lineTo(13, 8);
  ctx.fillStyle = C.stone;
  ctx.fill();
  ctx.fillStyle = C.mossLight;
  for (let y = 12; y < 38; y += 4) ctx.fillRect(y % 8 === 0 ? 3 : 11, y, 2, 3);
  quantizeAlpha(ctx, 16, 44);
  return canvas;
}

/** An empty stone plinth (a reserved place in the sanctuary), 16 x 12. */
export function buildPlinth(): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(16, 12);
  ctx.fillStyle = C.stone;
  ctx.fillRect(3, 2, 10, 8);
  ctx.fillStyle = C.stoneLight;
  ctx.fillRect(1, 0, 14, 2);
  ctx.fillRect(1, 10, 14, 2);
  return canvas;
}

/**
 * The sanctuary hall's back wall, 544 x 128: tall arched windows full of warm
 * light, columns, and ivy taking the stone back. Drawn behind the playfield.
 */
export function buildSanctuaryFacade(): HTMLCanvasElement {
  const w = 544;
  const h = 128;
  const { canvas, ctx } = createCanvas(w, h);
  const rand = seeded(41);
  ctx.fillStyle = '#252235';
  ctx.fillRect(0, 0, w, h);
  // Arched windows with warm light.
  for (let i = 0; i < 7; i++) {
    const x = 30 + i * 74;
    const g = ctx.createLinearGradient(0, 18, 0, 110);
    g.addColorStop(0, '#ffe7b0');
    g.addColorStop(1, '#c8774a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, 110);
    ctx.lineTo(x, 40);
    ctx.arc(x + 14, 40, 14, Math.PI, 0);
    ctx.lineTo(x + 28, 110);
    ctx.fill();
    ctx.fillStyle = '#3a3550';
    ctx.fillRect(x + 13, 26, 2, 84);
    ctx.fillRect(x, 70, 28, 2);
  }
  // Columns.
  for (let i = 0; i < 8; i++) {
    const x = 8 + i * 74;
    ctx.fillStyle = C.stoneLight;
    ctx.fillRect(x, 0, 14, h);
    ctx.fillStyle = C.stoneHighlight;
    ctx.fillRect(x, 0, 3, h);
    ctx.fillStyle = C.stoneDark;
    ctx.fillRect(x - 3, h - 8, 20, 8);
  }
  // Ivy and flowers.
  for (let i = 0; i < 160; i++) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(rand() * rand() * h);
    ctx.fillStyle = LEAF[Math.floor(rand() * LEAF.length)]!;
    ctx.fillRect(x, y, 2 + Math.floor(rand() * 3), 2 + Math.floor(rand() * 4));
  }
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = FLOWERS[i % FLOWERS.length]!;
    ctx.fillRect(Math.floor(rand() * w), Math.floor(rand() * 40), 1, 1);
  }
  return canvas;
}

/** The sealed gate at the end of the forest road, 40 x 72. */
export function buildGate(): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(40, 72);
  ctx.fillStyle = C.stoneLight;
  ctx.fillRect(0, 10, 40, 62);
  ctx.fillStyle = '#0d0b16';
  ctx.beginPath();
  ctx.moveTo(6, 72);
  ctx.lineTo(6, 28);
  ctx.arc(20, 28, 14, Math.PI, 0);
  ctx.lineTo(34, 72);
  ctx.fill();
  ctx.fillStyle = C.iron;
  for (let x = 9; x < 34; x += 5) ctx.fillRect(x, 16, 2, 56);
  ctx.fillRect(6, 40, 28, 2);
  ctx.fillRect(6, 56, 28, 2);
  ctx.fillStyle = C.hilt;
  ctx.fillRect(18, 4, 4, 6);
  ctx.fillStyle = C.mossLight;
  for (let y = 12; y < 70; y += 6) ctx.fillRect(y % 12 === 0 ? 1 : 36, y, 3, 4);
  quantizeAlpha(ctx, 40, 72);
  return canvas;
}

/** Treasure cache, 18 x 14: `open` shows the lid thrown back and an empty glow. */
export function buildCache(open: boolean): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(18, 14);
  ctx.fillStyle = C.wood;
  ctx.fillRect(1, 6, 16, 8);
  ctx.fillStyle = C.woodLight;
  ctx.fillRect(1, 6, 16, 1);
  ctx.fillStyle = C.iron;
  ctx.fillRect(1, 9, 16, 1);
  ctx.fillRect(8, 6, 2, 4);
  if (open) {
    ctx.fillStyle = C.wood;
    ctx.fillRect(1, 0, 16, 3);
    ctx.fillStyle = '#120f1e';
    ctx.fillRect(2, 5, 14, 2);
  } else {
    ctx.fillStyle = C.woodLight;
    ctx.fillRect(1, 2, 16, 4);
    ctx.fillStyle = C.hilt;
    ctx.fillRect(8, 4, 2, 3);
  }
  return canvas;
}
