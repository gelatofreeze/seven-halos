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
 * Charged attacks hold on `holdFrame` while the button is held, up to
 * `maxFrames`. Damage and posture damage scale linearly with charge.
 */
export interface ChargeSpec {
  holdFrame: number;
  maxFrames: number;
  maxDamageMultiplier: number;
  maxPostureMultiplier: number;
  /** Extra stamina spent on release, scaled by charge level. */
  staminaCost: number;
}

export type AttackKind = 'light' | 'heavy' | 'riposte' | 'enemy';

/**
 * Data-driven attack. Frame counts are 60 Hz simulation frames, so frame data
 * is identical on every device. Phases: startup → active → recovery.
 */
export interface AttackDefinition {
  id: string;
  name: string;
  kind: AttackKind;
  startupFrames: number;
  activeFrames: number;
  recoveryFrames: number;
  staminaCost: number;
  damage: DamageSpec;
  /** Posture damage dealt on hit (fills the target's posture meter). */
  postureDamage: number;
  /** Stamina drained from a guard that blocks this attack. */
  guardStaminaDamage: number;
  blockable: boolean;
  parryable: boolean;
  /** Knockback applied to the target, px/s (x is along the attacker's facing). */
  knockbackX: number;
  knockbackY: number;
  /** Frames of global hit-stop when this attack connects. */
  hitstopFrames: number;
  /** Frames the target is stunned when it flinches or has no poise. */
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
    /** From this frame, a buffered dodge, jump or guard cancels recovery. */
    dodgeFrom: number;
  };
  /** Next attack in the combo chain, if any. */
  next?: string;
  /** Committed attack: hits during startup/active do not flinch the attacker (posture still fills). */
  hyperArmor?: boolean;
  charge?: ChargeSpec;
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
  postureDamage: number;
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
  /** 0..1 charge level of a charged attack (0 for uncharged). */
  chargeLevel: number;
  rect: Rect;
}

export interface HitboxSink {
  add(owner: Combatant, attack: AttackDefinition, instanceId: number, facing: Facing, chargeLevel: number, x: number, y: number, w: number, h: number): void;
}

/** What a defender is doing right now, for guard/parry resolution. */
export interface DefenseState {
  mode: 'none' | 'guard' | 'parry';
  facing: Facing;
  stamina: number;
}

export interface Combatant {
  readonly combatId: number;
  readonly faction: Faction;
  readonly stats: CombatStats;
  /** Horizontal centre, for front/back checks. */
  readonly centerX: number;
  /** Defeated combatants deal no further damage, even later in the step they died. */
  readonly isDead: boolean;
  /** Fill `out` with the current hurtbox; false if the combatant cannot be hit at all (e.g. dead). */
  getHurtbox(out: Rect): boolean;
  /** True while invincibility frames are active. */
  isInvulnerable(): boolean;
  /** Write any hitboxes that are active on the current frame. */
  writeHitboxes(sink: HitboxSink): void;
  /** Apply a resolved, undefended hit. May return extra hit-stop frames (e.g. on a posture break). */
  receiveHit(result: DamageResult, hit: ActiveHitbox): number | void;
  /** Current guard/parry state; omit for combatants that never defend. */
  defense?(): DefenseState;
  /** The hit was blocked (or broke the guard). */
  receiveBlock?(result: DamageResult, hit: ActiveHitbox, staminaCost: number, guardBroken: boolean): void;
  /** This combatant parried `hit`. */
  receiveParrySuccess?(hit: ActiveHitbox): void;
  /** This combatant's attack was parried. */
  onAttackParried?(hit: ActiveHitbox): void;
}

/** An enemy that can be riposted while it is staggered (parried or posture-broken). */
export interface RiposteTarget {
  readonly combatId: number;
  readonly body: { readonly footX: number; readonly footY: number };
  canBeRiposted(): boolean;
  /** Consume the opening; a riposte opportunity can be used once. */
  claimRiposte(): void;
}
