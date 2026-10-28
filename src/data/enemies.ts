import type { PostureTuning } from '../combat/Resources';

export interface EnemyAttackOption {
  attack: string;
  /** Relative selection weight. */
  weight: number;
  /** Weight used instead for the next attack after this enemy has been parried. */
  weightAfterParried?: number;
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
  /** Starts an attack when the player is within this horizontal distance, px. */
  attackRange: number;
  /** Seconds between the end of one attack and the start of the next. */
  attackCooldown: number;
  attacks: readonly EnemyAttackOption[];
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
  rewards: { experience: number; gold: number; forgePoints: number };
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
    attackRange: 40,
    attackCooldown: 0.9,
    attacks: [
      { attack: 'sentinel.cleave', weight: 0.65, weightAfterParried: 0.3 },
      { attack: 'sentinel.cleave.delayed', weight: 0.35, weightAfterParried: 0.7 },
    ],
    flinchFrames: 10,
    reactions: { parriedFrames: 75, parryPostureDamage: 60, postureBrokenFrames: 110, ripostedFrames: 60 },
    respawnDelay: 4,
    rewards: { experience: 40, gold: 12, forgePoints: 1 },
  },
};
