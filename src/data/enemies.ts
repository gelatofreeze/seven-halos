import type { PostureTuning } from '../combat/Resources';
import type { Rarity } from './items';

export interface EnemyAttackOption {
  attack: string;
  /** Relative selection weight. */
  weight: number;
  /** Weight used instead for the next attack after this enemy has been parried. */
  weightAfterParried?: number;
  /** Only chosen when the target's horizontal distance is within [minRange, maxRange], px. */
  minRange: number;
  maxRange: number;
}

/** One line of a drop table. Rolled independently, once per death. */
export interface LootEntry {
  item: string;
  /** 0..1 probability. */
  chance: number;
  /** Inclusive quantity range; defaults to exactly 1. */
  quantity?: readonly [number, number];
  /** Display rarity of this drop (defaults to the item's own rarity). */
  rarity?: Rarity;
  /** `notOwned`: skipped if the player already owns the item. */
  condition?: 'notOwned';
}

export interface Rewards {
  experience: number;
  gold: number;
  forgePoints: number;
}

export interface EnemyDefinition {
  id: string;
  name: string;
  body: { w: number; h: number };
  maxHealth: number;
  posture: PostureTuning;
  defense: number;
  absorption: number;
  walkSpeed: number;
  /** Horizontal distance at which the enemy notices the player, px. */
  aggroRange: number;
  /** Vertical tolerance for noticing the player, px. */
  aggroHeight: number;
  /** Distance beyond which it gives up and returns to idle, px. */
  leashRange: number;
  /** Preferred fighting distance; it closes to `preferred` and backs off inside `min`, px. */
  spacing: { preferred: number; min: number };
  /** Seconds between the end of one attack and the start of the next. */
  attackCooldown: number;
  attacks: readonly EnemyAttackOption[];
  /** After an attack, chance to hop back out of reach instead of pressing. */
  retreat?: { chance: number; speed: number; frames: number };
  /** Hitstun when hit outside a hyper-armoured attack (a light flinch), frames. 0 = none. */
  flinchFrames: number;
  reactions: {
    /** Stagger after being parried; riposte-able. */
    parriedFrames: number;
    /** Posture damage taken when parried. */
    parryPostureDamage: number;
    /** Stagger after a posture break; riposte-able. */
    postureBrokenFrames: number;
    /** Knock-down after being riposted (not riposte-able again). */
    ripostedFrames: number;
  };
  /** Seconds after death before respawning (training enemies only). */
  respawnDelay: number | null;
  rewards: Rewards;
  loot: readonly LootEntry[];
}

export const ENEMIES: Record<string, EnemyDefinition> = {
  'hollow-sentinel': {
    id: 'hollow-sentinel',
    name: 'Hollow Sentinel',
    body: { w: 20, h: 34 },
    maxHealth: 180,
    posture: { max: 120, regenDelay: 2.5, regenRate: 20 },
    defense: 2,
    absorption: 0.1,
    walkSpeed: 38,
    aggroRange: 150,
    aggroHeight: 56,
    leashRange: 260,
    spacing: { preferred: 34, min: 24 },
    attackCooldown: 0.9,
    attacks: [
      { attack: 'sentinel.cleave', weight: 0.65, weightAfterParried: 0.3, minRange: 0, maxRange: 40 },
      { attack: 'sentinel.cleave.delayed', weight: 0.35, weightAfterParried: 0.7, minRange: 0, maxRange: 40 },
    ],
    flinchFrames: 10,
    reactions: { parriedFrames: 75, parryPostureDamage: 60, postureBrokenFrames: 110, ripostedFrames: 60 },
    respawnDelay: 4,
    rewards: { experience: 40, gold: 12, forgePoints: 1 },
    loot: [{ item: 'grave-dust', chance: 0.2 }],
  },
  'barrow-reaper': {
    id: 'barrow-reaper',
    name: 'Barrow Reaper',
    body: { w: 16, h: 32 },
    // Fragile and fast: lower health and posture than the Sentinel, but it controls space.
    maxHealth: 110,
    posture: { max: 80, regenDelay: 2, regenRate: 25 },
    defense: 0,
    absorption: 0,
    walkSpeed: 74,
    aggroRange: 180,
    aggroHeight: 56,
    leashRange: 300,
    spacing: { preferred: 52, min: 32 },
    attackCooldown: 0.6,
    attacks: [
      { attack: 'reaper.sweep', weight: 0.6, minRange: 0, maxRange: 60 },
      { attack: 'reaper.harvest', weight: 0.4, weightAfterParried: 0.6, minRange: 44, maxRange: 120 },
    ],
    retreat: { chance: 0.5, speed: 150, frames: 16 },
    flinchFrames: 14,
    reactions: { parriedFrames: 70, parryPostureDamage: 50, postureBrokenFrames: 100, ripostedFrames: 60 },
    respawnDelay: 6,
    rewards: { experience: 65, gold: 20, forgePoints: 2 },
    loot: [
      // The headline drop: rare, so finding one should feel like an event.
      { item: 'mourning-crescent', chance: 0.01, rarity: 'rare', condition: 'notOwned' },
      { item: 'grave-dust', chance: 0.35, quantity: [1, 2] },
    ],
  },
};

export function getEnemy(id: string): EnemyDefinition {
  const def = ENEMIES[id];
  if (!def) throw new Error(`Unknown enemy: ${id}`);
  return def;
}
