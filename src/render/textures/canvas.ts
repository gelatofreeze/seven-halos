export function createCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

/**
 * Snap every pixel's alpha to fully opaque or transparent so shapes drawn
 * with anti-aliased canvas primitives (rotation, arcs, lines) read as crisp
 * pixel art.
 */
export function quantizeAlpha(ctx: CanvasRenderingContext2D, w: number, h: number, threshold = 110): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i]! >= threshold ? 255 : 0;
  ctx.putImageData(img, 0, 0);
}

/** Deterministic pseudo-random generator so placeholder art is identical every boot. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
