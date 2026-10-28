import type { Rect } from '../core/Rect';
import type { CollisionWorld } from './CollisionWorld';

const EPSILON = 1e-4;

/**
 * Axis-aligned kinematic body. Position is the top-left of the collision box.
 * Velocity is in px/s; gameplay code owns velocity, the body owns collision.
 */
export class KinematicBody implements Rect {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  /** Position at the start of the last step, for render interpolation. */
  prevX: number;
  prevY: number;

  grounded = false;
  wasGrounded = false;
  hitCeiling = false;
  hitWall: -1 | 0 | 1 = 0;
  /** Seconds remaining during which one-way platforms are ignored (drop-through). */
  dropThroughTime = 0;

  constructor(
    footX: number,
    footY: number,
    public w: number,
    public h: number,
  ) {
    this.x = footX - w / 2;
    this.y = footY - h;
    this.prevX = this.x;
    this.prevY = this.y;
  }

  get footX(): number {
    return this.x + this.w / 2;
  }

  get footY(): number {
    return this.y + this.h;
  }

  get centerY(): number {
    return this.y + this.h / 2;
  }

  /** Place the body so its feet are at the given point, without interpolation. */
  teleport(footX: number, footY: number): void {
    this.x = footX - this.w / 2;
    this.y = footY - this.h;
    this.prevX = this.x;
    this.prevY = this.y;
    this.vx = 0;
    this.vy = 0;
  }

  /** Integrate velocity for one fixed step and resolve collisions. */
  step(world: CollisionWorld, dt: number): void {
    this.prevX = this.x;
    this.prevY = this.y;
    this.wasGrounded = this.grounded;
    this.hitCeiling = false;
    this.hitWall = 0;
    if (this.dropThroughTime > 0) this.dropThroughTime = Math.max(0, this.dropThroughTime - dt);

    const dx = this.vx * dt;
    if (dx !== 0) {
      const moved = this.moveX(world, dx);
      if (moved !== dx) {
        this.hitWall = dx > 0 ? 1 : -1;
        this.vx = 0;
      }
    }

    const dy = this.vy * dt;
    if (dy !== 0) {
      const moved = this.moveY(world, dy);
      if (moved !== dy) {
        if (dy < 0) this.hitCeiling = true;
        this.vy = 0;
      }
    }

    this.grounded = this.vy >= 0 && this.probeGround(world);
  }

  /** Swept horizontal move. Returns the distance actually travelled. */
  moveX(world: CollisionWorld, dx: number): number {
    let allowed = dx;
    const top = this.y;
    const bottom = this.y + this.h;
    const left = this.x;
    const right = this.x + this.w;
    for (const s of world.solids) {
      if (s.oneWay) continue;
      if (bottom <= s.y || top >= s.y + s.h) continue;
      if (dx > 0 && s.x >= right - EPSILON) {
        allowed = Math.min(allowed, s.x - right);
      } else if (dx < 0 && s.x + s.w <= left + EPSILON) {
        allowed = Math.max(allowed, s.x + s.w - left);
      }
    }
    this.x += allowed;
    return allowed;
  }

  /** Swept vertical move. Returns the distance actually travelled. */
  moveY(world: CollisionWorld, dy: number): number {
    let allowed = dy;
    const left = this.x;
    const right = this.x + this.w;
    const top = this.y;
    const bottom = this.y + this.h;
    const ignoreOneWay = this.dropThroughTime > 0;
    for (const s of world.solids) {
      if (right <= s.x || left >= s.x + s.w) continue;
      if (dy > 0 && s.y >= bottom - EPSILON) {
        if (s.oneWay && ignoreOneWay) continue;
        allowed = Math.min(allowed, s.y - bottom);
      } else if (dy < 0 && !s.oneWay && s.y + s.h <= top + EPSILON) {
        allowed = Math.max(allowed, s.y + s.h - top);
      }
    }
    this.y += allowed;
    return allowed;
  }

  /** True when standing exactly on top of a solid (or a one-way platform). */
  probeGround(world: CollisionWorld): boolean {
    const bottom = this.y + this.h;
    const left = this.x;
    const right = this.x + this.w;
    for (const s of world.solids) {
      if (right <= s.x || left >= s.x + s.w) continue;
      if (Math.abs(s.y - bottom) > 0.01) continue;
      if (s.oneWay && this.dropThroughTime > 0) continue;
      return true;
    }
    return false;
  }

  /** True when the body stands on a one-way platform (and nothing solid). */
  standingOnOneWayOnly(world: CollisionWorld): boolean {
    const bottom = this.y + this.h;
    let oneWay = false;
    for (const s of world.solids) {
      if (this.x + this.w <= s.x || this.x >= s.x + s.w) continue;
      if (Math.abs(s.y - bottom) > 0.01) continue;
      if (!s.oneWay) return false;
      oneWay = true;
    }
    return oneWay;
  }
}
