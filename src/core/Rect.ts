/** Axis-aligned rectangle. `x`/`y` is the top-left corner, in world pixels. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function makeRect(x = 0, y = 0, w = 0, h = 0): Rect {
  return { x, y, w, h };
}

/** Strict overlap: rectangles that merely touch edges do not overlap. */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function setRect(out: Rect, x: number, y: number, w: number, h: number): Rect {
  out.x = x;
  out.y = y;
  out.w = w;
  out.h = h;
  return out;
}
