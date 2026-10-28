import type { Rect } from '../core/Rect';

/** Static level geometry. One-way solids only block downward movement from above. */
export interface Solid extends Rect {
  oneWay: boolean;
}

/**
 * Static collision geometry for a level. Bodies query it with exact, swept,
 * axis-separated movement, so fast bodies cannot tunnel through thin solids.
 * A linear scan is used for now; levels are small, merged rectangles. Swap in
 * a spatial grid here if levels grow beyond a few hundred solids.
 */
export class CollisionWorld {
  constructor(
    readonly solids: readonly Solid[],
    readonly bounds: Rect,
  ) {}

  /** True if the point lies inside any full (non one-way) solid. */
  isSolidAt(x: number, y: number): boolean {
    for (const s of this.solids) {
      if (!s.oneWay && x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) return true;
    }
    return false;
  }

  /** True if the point lies inside any solid, one-way platforms included. */
  isStandableAt(x: number, y: number): boolean {
    for (const s of this.solids) {
      if (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) return true;
    }
    return false;
  }
}
