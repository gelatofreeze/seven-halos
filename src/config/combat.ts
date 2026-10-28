/**
 * Player defensive mechanics and global combat feel. Frame counts are 60 Hz
 * simulation frames. See docs/COMBAT.md for the reasoning behind each value.
 */
export const GUARD = {
  /** Frames after pressing guard before it blocks. */
  raiseFrames: 3,
  /** Fraction of a blocked hit's damage that is prevented (the rest is chip damage). */
  damageReduction: 0.9,
  /** Fraction of an attack's guard stamina damage the guard absorbs. */
  stability: 0.2,
  /** Walk speed while guarding, as a fraction of run speed. */
  walkSpeedMultiplier: 0.35,
  /** Stamina regeneration while the guard is raised, as a fraction of normal. */
  staminaRegenMultiplier: 0.6,
  /** Frames the player cannot act after blocking a hit. */
  blockStunFrames: 14,
  /** Blocked hits push the player back by this fraction of the attack's knockback. */
  pushbackMultiplier: 0.4,
  /** Frames of helpless stagger after a guard break. */
  breakFrames: 60,
  /** Attacks from up to this many px behind the defender's centre still count as frontal. */
  frontTolerance: 2,
} as const;

export const PARRY = {
  staminaCost: 15,
  /** Frames before the parry window opens (vulnerable). */
  startupFrames: 4,
  /** Frames during which a frontal, parryable hit is deflected. */
  windowFrames: 8,
  /** Vulnerable frames after a whiffed parry. Long by design: parrying is a gamble. */
  recoveryFrames: 26,
  /** Invulnerable frames granted on a successful parry. */
  successInvulnerableFrames: 12,
} as const;

export const RIPOSTE = {
  attack: 'sword.riposte',
  /** Max horizontal distance between feet to start a riposte, px. */
  range: 44,
  /** Max vertical distance between feet, px. */
  maxHeightDifference: 20,
} as const;

/** Hit-stop frames by outcome (attacks define their own for clean hits). */
export const HITSTOP = {
  block: 3,
  guardBreak: 8,
  parry: 10,
  postureBreak: 10,
} as const;
