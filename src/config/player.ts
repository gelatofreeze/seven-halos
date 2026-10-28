import type { StaminaTuning } from '../combat/Resources';

/** Player combat-facing tuning (movement lives in movement.ts). */
export const PLAYER_COMBAT = {
  body: { w: 12, h: 26 },
  maxHealth: 100,
  stamina: { max: 100, regenRate: 40, regenDelay: 0.55, exhaustedRegenDelay: 1.1, busyRegenMultiplier: 0 } satisfies StaminaTuning,
  /** Seconds of invincibility after being hit, to avoid multi-hit stunlocks on mobile. */
  postHitInvulnerability: 0.3,
  /** Seconds before respawning after death. */
  respawnDelay: 2,
  /** Falling this far below the level bounds counts as falling into the abyss, px. */
  abyssMargin: 48,
  abyssDamage: 25,
  /** A respawn point after falling must have solid floor this far beyond both body edges, px. */
  safeGroundMargin: 6,
} as const;
