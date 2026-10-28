/** Move `current` toward `target` by at most `maxDelta`, never overshooting. */
export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return target;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Sign that treats zero as zero. */
export function sign(value: number): -1 | 0 | 1 {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

/** Frame-rate independent exponential smoothing factor for a rate in 1/seconds. */
export function smoothingFactor(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

export type Facing = 1 | -1;
