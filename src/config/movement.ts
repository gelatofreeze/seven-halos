/**
 * Player movement tuning. Every value here is gameplay-facing and safe to
 * tweak; units are pixels, seconds and 60 Hz frames as noted. The world uses
 * 16 px tiles and the player collision box is 12 x 26 px.
 */
export interface HorizontalTuning {
  /** Top speed, px/s. */
  maxSpeed: number;
  /** Speed gained per second while pushing in the direction of motion. */
  acceleration: number;
  /** Speed lost per second with no input (or when above max speed). */
  deceleration: number;
  /** Speed change per second while reversing direction. */
  turnAcceleration: number;
}

export interface JumpTuning {
  /** Apex height of a fully held jump before apex hang, px. */
  height: number;
  /** Seconds from takeoff to apex for a fully held jump. */
  timeToApex: number;
  /** Upward velocity is clamped to this fraction of takeoff speed when jump is released early. */
  releaseVelocityCut: number;
  /** Gravity multiplier while rising without the button held. */
  lowJumpGravityMultiplier: number;
  /** Gravity multiplier while falling. */
  fallGravityMultiplier: number;
  /** |vy| below which the apex hang applies while jump is held, px/s. */
  apexThreshold: number;
  /** Gravity multiplier during apex hang. */
  apexGravityMultiplier: number;
  /** Terminal fall speed, px/s. */
  maxFallSpeed: number;
  /** Terminal fall speed while holding down, px/s. */
  fastFallSpeed: number;
  fastFallGravityMultiplier: number;
  /** Grace period after leaving a ledge during which a jump is still allowed, s. */
  coyoteTime: number;
  /** A jump pressed this long before landing still fires on landing, s. */
  bufferTime: number;
  /**
   * Stamina spent per jump. Jumping is never blocked by low stamina (that
   * could trap the player in a pit); it just drains the meter and delays regen.
   */
  staminaCost: number;
}

/**
 * The extra midair jump granted by equipment (`extraAirJumps`). Without such
 * equipment none of this applies and jumping is exactly the base jump.
 */
export interface AirJumpTuning {
  /** Height of a fully held air jump from where it starts, px (under the same gravity as the base jump). */
  height: number;
  /** Stamina spent per air jump (never blocks it, like the base jump). */
  staminaCost: number;
}

export interface LandingTuning {
  /** Duration of the soft landing state; fully cancellable, s. */
  softDuration: number;
  /** Fall speed at or above which a landing counts as hard, px/s. */
  hardLandingSpeed: number;
  /** Duration of a hard landing, s. */
  hardDuration: number;
  /** Max speed multiplier during a hard landing. */
  hardSpeedMultiplier: number;
}

export interface DodgeTuning {
  staminaCost: number;
  /** Frames before invincibility starts (committed, no i-frames). */
  startupFrames: number;
  /** Invincible frames, immediately after startup. */
  invulnerableFrames: number;
  /** Vulnerable recovery frames after i-frames end. */
  recoveryFrames: number;
  /** From this frame on, buffered jump/attack/dodge input may cancel the recovery. */
  cancelFrame: number;
  startupSpeed: number;
  activeSpeed: number;
  /** Speed decays toward this during recovery, px/s. */
  recoveryEndSpeed: number;
  /** Whether a dodge can be started in the air. */
  allowInAir: boolean;
}

export interface MovementTuning {
  ground: HorizontalTuning;
  air: HorizontalTuning;
  jump: JumpTuning;
  airJump: AirJumpTuning;
  landing: LandingTuning;
  dodge: DodgeTuning;
  /** Attack and dodge presses are remembered this long while busy, s. */
  actionBufferTime: number;
  /** Duration that one-way platforms are ignored after a drop-through, s. */
  dropThroughTime: number;
}

export const PLAYER_MOVEMENT: MovementTuning = {
  ground: { maxSpeed: 132, acceleration: 1500, deceleration: 2100, turnAcceleration: 3000 },
  air: { maxSpeed: 132, acceleration: 1000, deceleration: 520, turnAcceleration: 1500 },
  jump: {
    height: 52,
    timeToApex: 0.36,
    releaseVelocityCut: 0.5,
    lowJumpGravityMultiplier: 1.8,
    fallGravityMultiplier: 1.7,
    apexThreshold: 40,
    apexGravityMultiplier: 0.6,
    maxFallSpeed: 420,
    fastFallSpeed: 520,
    fastFallGravityMultiplier: 2.2,
    coyoteTime: 0.1,
    bufferTime: 0.13,
    staminaCost: 8,
  },
  airJump: { height: 48, staminaCost: 8 },
  landing: { softDuration: 0.08, hardLandingSpeed: 415, hardDuration: 0.16, hardSpeedMultiplier: 0.45 },
  dodge: {
    staminaCost: 28,
    startupFrames: 2,
    invulnerableFrames: 13,
    recoveryFrames: 8,
    cancelFrame: 18,
    startupSpeed: 200,
    activeSpeed: 270,
    recoveryEndSpeed: 40,
    allowInAir: false,
  },
  actionBufferTime: 0.2,
  dropThroughTime: 0.2,
};

/** Takeoff speed of an air jump reaching `airJump.height` under the base jump's gravity. */
export function airJumpSpeed(tuning: MovementTuning, dt = 1 / 60): number {
  const { gravity } = jumpPhysics(tuning.jump, dt);
  const half = (gravity * dt) / 2;
  return half + Math.sqrt(half * half + 2 * gravity * tuning.airJump.height);
}

/**
 * Derive gravity and takeoff speed from designer-facing height/time. The
 * takeoff speed is corrected for discrete fixed-step integration so a held
 * jump really reaches `height` (semi-implicit Euler loses about v·dt/2).
 */
export function jumpPhysics(jump: JumpTuning, dt = 1 / 60): { gravity: number; takeoffSpeed: number } {
  const gravity = (2 * jump.height) / (jump.timeToApex * jump.timeToApex);
  const half = (gravity * dt) / 2;
  return { gravity, takeoffSpeed: half + Math.sqrt(half * half + 2 * gravity * jump.height) };
}
