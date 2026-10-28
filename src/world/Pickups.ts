import type { Rarity } from '../data/items';
import type { CollisionWorld } from '../physics/CollisionWorld';
import { KinematicBody } from '../physics/KinematicBody';

/** A collectible lying in the world. Stays until collected, independent of who dropped it. */
export interface Pickup {
  readonly id: number;
  readonly itemId: string;
  readonly quantity: number;
  readonly rarity: Rarity;
  readonly body: KinematicBody;
  /** Seconds since spawning; pickups can't be collected during the first moment of their pop. */
  age: number;
  collected: boolean;
}

const GRAVITY = 900;
const SIZE = 8;
/** Pickups pop out of the defeated enemy before they can be collected, s. */
export const PICKUP_ARM_TIME = 0.35;

let nextPickupId = 1;

export function createPickup(itemId: string, quantity: number, rarity: Rarity, footX: number, footY: number, popVx: number): Pickup {
  const body = new KinematicBody(footX, footY - 2, SIZE, SIZE);
  body.vx = popVx;
  body.vy = -180;
  return { id: nextPickupId++, itemId, quantity, rarity, body, age: 0, collected: false };
}

export function stepPickup(p: Pickup, world: CollisionWorld, dt: number): void {
  p.age += dt;
  const b = p.body;
  b.vy = Math.min(b.vy + GRAVITY * dt, 360);
  if (b.grounded) b.vx *= 0.8;
  b.step(world, dt);
}
