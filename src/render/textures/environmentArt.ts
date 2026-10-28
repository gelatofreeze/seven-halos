import { createCanvas, quantizeAlpha, seeded } from './canvas';
import { PALETTE as C } from './palette';

/** Tileset frame indices (16 x 16 each, laid out horizontally). */
export const TILESET = { top: 0, innerA: 1, innerB: 2, wall: 3, oneWay: 4, count: 5 } as const;

export function buildTileset(ts: number): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(ts * TILESET.count, ts);
  const rand = seeded(7);
  const bricks = (ox: number, shade: string) => {
    ctx.fillStyle = C.stone;
    ctx.fillRect(ox, 0, ts, ts);
    ctx.fillStyle = C.stoneDark;
    // Mortar lines: two courses of offset bricks
    ctx.fillRect(ox, 7, ts, 1);
    ctx.fillRect(ox, 15, ts, 1);
    ctx.fillRect(ox + 5, 0, 1, 7);
    ctx.fillRect(ox + 12, 8, 1, 7);
    ctx.fillStyle = shade;
    ctx.fillRect(ox, 0, 5, 1);
    ctx.fillRect(ox + 6, 0, 9, 1);
    ctx.fillRect(ox, 8, 12, 1);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = rand() > 0.5 ? C.stoneLight : C.stoneDark;
      ctx.fillRect(ox + Math.floor(rand() * ts), Math.floor(rand() * ts), 1, 1);
    }
  };
  bricks(TILESET.top * ts, C.stoneLight);
  // Mossy, lit top edge
  const tx = TILESET.top * ts;
  ctx.fillStyle = C.stoneHighlight;
  ctx.fillRect(tx, 0, ts, 2);
  ctx.fillStyle = C.moss;
  ctx.fillRect(tx, 0, ts, 1);
  for (let x = 0; x < ts; x++) if (rand() > 0.55) ctx.fillRect(tx + x, 2, 1, 1 + Math.floor(rand() * 2));
  ctx.fillStyle = C.mossLight;
  for (let x = 0; x < ts; x += 3) if (rand() > 0.4) ctx.fillRect(tx + x, 0, 1, 1);
  bricks(TILESET.innerA * ts, C.stoneLight);
  bricks(TILESET.innerB * ts, C.stone);
  ctx.fillStyle = C.stoneDark;
  ctx.fillRect(TILESET.innerB * ts + 9, 2, 1, 4);
  ctx.fillRect(TILESET.innerB * ts + 10, 5, 2, 1);
  // Exposed wall face: darker with a vertical highlight
  bricks(TILESET.wall * ts, C.stoneLight);
  ctx.fillStyle = 'rgba(10,8,20,0.35)';
  ctx.fillRect(TILESET.wall * ts, 0, ts, ts);
  // One-way platform: ancient beam with iron bands
  const ox = TILESET.oneWay * ts;
  ctx.fillStyle = C.wood;
  ctx.fillRect(ox, 0, ts, 5);
  ctx.fillStyle = C.woodLight;
  ctx.fillRect(ox, 0, ts, 1);
  ctx.fillStyle = C.iron;
  ctx.fillRect(ox + 3, 0, 2, 5);
  ctx.fillRect(ox + 11, 0, 2, 5);
  ctx.fillStyle = C.stoneDark;
  ctx.fillRect(ox, 5, ts, 1);
  ctx.fillRect(ox + 7, 6, 2, 3);
  return canvas;
}

/** Vertical gradient sky with stars. Tiles horizontally. */
export function buildSky(w: number, h: number): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, C.skyTop);
  g.addColorStop(0.55, C.skyMid);
  g.addColorStop(1, C.skyHorizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Dither bands to keep the gradient reading as pixel art
  const rand = seeded(3);
  for (let i = 0; i < 90; i++) {
    const y = Math.floor(rand() * h * 0.7);
    ctx.fillStyle = rand() > 0.85 ? '#d6d0ff' : '#6d64a0';
    ctx.globalAlpha = 0.4 + rand() * 0.6;
    ctx.fillRect(Math.floor(rand() * w), y, 1, 1);
  }
  ctx.globalAlpha = 1;
  return canvas;
}

export function buildMoon(): HTMLCanvasElement {
  const size = 72;
  const { canvas, ctx } = createCanvas(size, size);
  const c = size / 2;
  const halo = ctx.createRadialGradient(c, c, 10, c, c, c);
  halo.addColorStop(0, 'rgba(216,210,234,0.35)');
  halo.addColorStop(1, 'rgba(216,210,234,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = C.moon;
  ctx.beginPath();
  ctx.arc(c, c, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b3abcc';
  ctx.fillRect(c - 6, c - 4, 4, 3);
  ctx.fillRect(c + 3, c + 3, 5, 3);
  ctx.fillRect(c - 2, c + 7, 3, 2);
  return canvas;
}

/** Draw `fn` at x, x - w and x + w so silhouettes wrap seamlessly. */
function wrapped(w: number, fn: (dx: number) => void): void {
  fn(0);
  fn(-w);
  fn(w);
}

/** Distant castle spires of the fallen gods. */
export function buildFarLayer(w: number, h: number): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(w, h);
  const rand = seeded(11);
  ctx.fillStyle = C.farSilhouette;
  ctx.fillRect(0, h - 40, w, 40);
  const towers: { x: number; tw: number; th: number }[] = [];
  for (let x = 0; x < w; x += 18 + Math.floor(rand() * 26)) towers.push({ x, tw: 8 + Math.floor(rand() * 14), th: 40 + Math.floor(rand() * 90) });
  for (const t of towers) {
    wrapped(w, (dx) => {
      const x = t.x + dx;
      ctx.fillStyle = C.farSilhouette;
      ctx.fillRect(x, h - t.th, t.tw, t.th);
      // Spire
      ctx.beginPath();
      ctx.moveTo(x - 1, h - t.th);
      ctx.lineTo(x + t.tw / 2, h - t.th - 14 - t.tw);
      ctx.lineTo(x + t.tw + 1, h - t.th);
      ctx.fill();
    });
  }
  // A great central keep
  wrapped(w, (dx) => {
    const kx = w * 0.62 + dx;
    ctx.fillStyle = C.farSilhouette;
    ctx.fillRect(kx, h - 150, 34, 150);
    ctx.beginPath();
    ctx.moveTo(kx - 2, h - 150);
    ctx.lineTo(kx + 17, h - 190);
    ctx.lineTo(kx + 36, h - 150);
    ctx.fill();
  });
  // Faint windows
  for (let i = 0; i < 40; i++) {
    const t = towers[Math.floor(rand() * towers.length)]!;
    ctx.fillStyle = C.farWindow;
    ctx.globalAlpha = 0.5 + rand() * 0.5;
    ctx.fillRect(t.x + 2 + Math.floor(rand() * Math.max(1, t.tw - 4)), h - Math.floor(rand() * t.th), 1, 2);
  }
  ctx.globalAlpha = 1;
  quantizeAlpha(ctx, w, h, 60);
  return canvas;
}

/** Ruined gothic arcade and dead trees. */
export function buildMidLayer(w: number, h: number): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(w, h);
  const rand = seeded(23);
  ctx.fillStyle = C.midSilhouette;
  ctx.fillRect(0, h - 26, w, 26);
  for (let x = 0; x < w; x += 64) {
    const broken = rand() > 0.6;
    const archTop = h - 120 + Math.floor(rand() * 20);
    wrapped(w, (dx) => {
      const ax = x + dx;
      ctx.fillStyle = C.midSilhouette;
      ctx.fillRect(ax, archTop, 10, h - archTop);
      ctx.fillStyle = C.midRim;
      ctx.fillRect(ax + 8, archTop, 2, h - archTop);
      ctx.fillStyle = C.midSilhouette;
      if (!broken) {
        ctx.beginPath();
        ctx.moveTo(ax + 10, archTop + 10);
        ctx.quadraticCurveTo(ax + 37, archTop - 34, ax + 64, archTop + 10);
        ctx.lineTo(ax + 64, archTop + 2);
        ctx.quadraticCurveTo(ax + 37, archTop - 44, ax + 10, archTop + 2);
        ctx.fill();
      } else {
        ctx.fillRect(ax + 10, archTop + 4, 12, 5);
      }
    });
  }
  // Dead trees
  for (let i = 0; i < 4; i++) {
    const tx = Math.floor(rand() * w);
    wrapped(w, (dx) => {
      const x = tx + dx;
      ctx.strokeStyle = C.midSilhouette;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + 2, h - 70);
      ctx.stroke();
      ctx.lineWidth = 1;
      for (let b = 0; b < 6; b++) {
        const by = h - 30 - b * 8;
        const dir = b % 2 === 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(x + 1, by);
        ctx.lineTo(x + dir * (8 + b), by - 8);
        ctx.stroke();
      }
    });
  }
  quantizeAlpha(ctx, w, h, 80);
  return canvas;
}

/** Soft horizontal fog bank; intentionally not alpha-quantized. */
export function buildFog(w: number, h: number): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(w, h);
  const rand = seeded(5);
  for (let i = 0; i < 26; i++) {
    const x = rand() * w;
    const y = h * 0.35 + rand() * h * 0.5;
    const r = 20 + rand() * 40;
    wrapped(w, (dx) => {
      const g = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, r);
      g.addColorStop(0, 'rgba(122,114,168,0.22)');
      g.addColorStop(1, 'rgba(122,114,168,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x + dx - r, y - r, r * 2, r * 2);
    });
  }
  return canvas;
}

export function buildRadialGlow(size: number): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(size, size);
  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

export function buildVignette(w: number, h: number): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(w, h);
  const g = ctx.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.35, w / 2, h * 0.55, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(4,3,10,0)');
  g.addColorStop(1, 'rgba(4,3,10,0.75)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return canvas;
}

export function buildPixel(size: number, color: string): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(size, size);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/** Shrine (checkpoint): a weathered statue holding an empty halo. 32 x 48, feet at bottom. */
export function buildShrine(): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(32, 48);
  ctx.fillStyle = C.stoneDark;
  ctx.fillRect(4, 40, 24, 8);
  ctx.fillStyle = C.stoneLight;
  ctx.fillRect(4, 40, 24, 2);
  ctx.fillStyle = C.stone;
  ctx.fillRect(11, 18, 10, 22);
  ctx.fillRect(9, 24, 14, 10);
  ctx.fillStyle = C.stoneLight;
  ctx.fillRect(13, 11, 6, 7);
  ctx.fillRect(11, 18, 2, 20);
  ctx.strokeStyle = C.hilt;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(16, 7, 7, 2.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  quantizeAlpha(ctx, 32, 48);
  return canvas;
}

/** Iron brazier, 16 x 24; the flame is a separate glow + particles. */
export function buildBrazier(): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(16, 24);
  ctx.fillStyle = C.iron;
  ctx.fillRect(3, 8, 10, 4);
  ctx.fillRect(7, 12, 2, 10);
  ctx.fillRect(4, 22, 8, 2);
  ctx.fillStyle = C.stoneDark;
  ctx.fillRect(4, 11, 8, 1);
  ctx.fillStyle = C.flame;
  ctx.fillRect(5, 5, 6, 3);
  ctx.fillStyle = '#ffe2a8';
  ctx.fillRect(7, 3, 2, 4);
  return canvas;
}

/** Lore stone marking a secret, 12 x 16. */
export function buildLoreStone(): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(12, 16);
  ctx.fillStyle = C.stone;
  ctx.fillRect(2, 3, 8, 13);
  ctx.fillRect(3, 1, 6, 2);
  ctx.fillStyle = C.spectral;
  ctx.fillRect(5, 6, 2, 1);
  ctx.fillRect(4, 8, 4, 1);
  ctx.fillRect(5, 10, 2, 2);
  return canvas;
}
