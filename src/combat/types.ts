import type { Facing } from '../core/math';
import type { Rect } from '../core/Rect';

export type Faction = 'player' | 'enemy';

/**
 * Hitbox authored relative to the attacker's feet, for an attacker facing
 * right. `x` is the near edge's forward distance from the feet centre, `y` the
 * top edge relative to the feet (negative is up). Mirrored automatically.
 */
export interface HitboxSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Optional sub-window within the active phase, in frames from the first active frame. */
  fromFrame?: number;
  toFrame?: number;
}

export interface DamageSpec {
  physical: number;
  /** Future: magic, fire, holy, etc. Kept as a record so new types need no refactor. */
  [type: string]: number;
}

/**
 * Data-driven attack. Frame counts are 60 Hz simulation frames, so frame data
 * is identical on every device. Phases: startup → active → recovery.
 */
export interface AttackDefinition {
  id: string;
  name: string;
  startupFrames: number;
  activeFrames: number;
  recoveryFrames: number;
  staminaCost: number;
  damage: DamageSpec;
  poiseDamage: number;
  /** Knockback applied to the target, px/s (x is along the attacker's facing). */
  knockbackX: number;
  knockbackY: number;
  /** Frames of global hit-stop when this attack connects. */
  hitstopFrames: number;
  /** Frames the target is stunned when its poise breaks (or it has none). */
  hitstunFrames: number;
  hitboxes: readonly HitboxSpec[];
  movement: {
    /** Frame on which the lunge impulse is applied. */
    lungeFrame: number;
    lungeSpeed: number;
    /** Horizontal speed lost per second while grounded during the attack. */
    friction: number;
  };
  cancels: {
    /** From this frame, a buffered attack chains into `next`. */
    chainFrom: number;
    /** From this frame, a buffered dodge or jump cancels recovery. */
    dodgeFrom: number;
  };
  /** Next attack in the combo chain, if any. */
  next?: string;
  /** Poise bonus while performing this attack (hyper-armor), added to base poise. */
  hyperArmor?: number;
}

export type AttackPhase = 'startup' | 'active' | 'recovery' | 'done';

export interface CombatStats {
  /** Flat reduction per damage type before percentage absorption. */
  defense: number;
  /** 0..1 fraction of damage absorbed. */
  absorption: number;
  /** Multiplier applied to outgoing damage (from attributes, buffs, weapon scaling). */
  attackMultiplier: number;
}

/** Result of damage calculation, applied by the target. */
export interface DamageResult {
  damage: number;
  poiseDamage: number;
  knockbackX: number;
  knockbackY: number;
  hitstunFrames: number;
}

/** An active hitbox written by an attacker for this simulation step. */
export interface ActiveHitbox {
  owner: Combatant;
  attack: AttackDefinition;
  /** Unique per attack execution; one execution hits each target at most once. */
  instanceId: number;
  facing: Facing;
  rect: Rect;
}

export interface HitboxSink {
  add(owner: Combatant, attack: AttackDefinition, instanceId: number, facing: Facing, x: number, y: number, w: number, h: number): void;
}

export interface Combatant {
  readonly combatId: number;
  readonly faction: Faction;
  readonly stats: CombatStats;
  /** Fill `out` with the current hurtbox; false if the combatant cannot be hit at all (e.g. dead). */
  getHurtbox(out: Rect): boolean;
  /** True while invincibility frames are active. */
  isInvulnerable(): boolean;
  /** Write any hitboxes that are active on the current frame. */
  writeHitboxes(sink: HitboxSink): void;
  /** Apply a resolved hit. */
  receiveHit(result: DamageResult, hit: ActiveHitbox): void;
}
