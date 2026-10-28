export interface EnemyDefinition {
  id: string;
  name: string;
  body: { w: number; h: number };
  maxHealth: number;
  poise: number;
  poiseResetDelay: number;
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
  attack: string;
  /** Hitstun when hit without poise break (a light flinch), frames. 0 = none. */
  flinchFrames: number;
  /** Seconds after death before respawning (training enemies only). */
  respawnDelay: number | null;
  rewards: { experience: number; gold: number; forgePoints: number };
}

export const ENEMIES: Record<string, EnemyDefinition> = {
  'hollow-sentinel': {
    id: 'hollow-sentinel',
    name: 'Hollow Sentinel',
    body: { w: 20, h: 34 },
    maxHealth: 140,
    poise: 50,
    poiseResetDelay: 2.5,
    defense: 2,
    absorption: 0.1,
    walkSpeed: 38,
    aggroRange: 150,
    aggroHeight: 56,
    leashRange: 260,
    attackRange: 40,
    attackCooldown: 0.7,
    attack: 'sentinel.cleave',
    flinchFrames: 10,
    respawnDelay: 4,
    rewards: { experience: 40, gold: 12, forgePoints: 1 },
  },
};
