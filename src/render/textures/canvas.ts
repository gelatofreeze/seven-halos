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

export { seeded } from '../../core/random';
