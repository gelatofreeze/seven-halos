import { AttackRunner } from '../../combat/AttackRunner';
import { Health, Posture } from '../../combat/Resources';
import type { ActiveHitbox, AttackDefinition, Combatant, CombatStats, DamageResult, HitboxSink, RiposteTarget } from '../../combat/types';
import { HITSTOP } from '../../config/combat';
import { approach, type Facing } from '../../core/math';
import { setRect, type Rect } from '../../core/Rect';
import { StateMachine, type State } from '../../core/StateMachine';
import type { EnemyAttackOption, EnemyDefinition } from '../../data/enemies';
import { getAttack } from '../../data/weapons';
import type { CollisionWorld } from '../../physics/CollisionWorld';
import { KinematicBody } from '../../physics/KinematicBody';
import type { SimEventQueue } from '../../world/SimEvents';

/** What an enemy needs to know about its target; keeps AI decoupled from the Player class. */
export interface TargetView {
  readonly body: { readonly footX: number; readonly footY: number };
  readonly isDead: boolean;
  /** True while the target is helpless after a guard break. */
  readonly isGuardBroken: boolean;
}

export type EnemyStateId = 'idle' | 'approach' | 'attack' | 'retreat' | 'stagger' | 'parried' | 'postureBroken' | 'riposted' | 'dead';
type EnemyState = State<Enemy, EnemyStateId>;

const GRAVITY = 1100;
/** Speed of the small shove a killing blow gives the body, px/s. */
const DEATH_SHOVE = 40;
const MAX_FALL = 420;

let nextEnemyId = 100;

/**
 * A melee enemy driven entirely by its `EnemyDefinition`: spacing, attack
 * options (chosen by distance and deterministic weighted randomness), an
 * optional retreat hop, posture, hyper-armour and reactions. The Hollow
 * Sentinel and the Barrow Reaper are both instances of this class with
 * different data; enemy-specific presentation lives in the render layer.
 */
export class Enemy implements Combatant, RiposteTarget {
  readonly combatId = nextEnemyId++;
  readonly faction = 'enemy' as const;
  readonly body: KinematicBody;
  readonly fsm: StateMachine<Enemy, EnemyStateId>;
  readonly health: Health;
  readonly posture: Posture;
  readonly attack = new AttackRunner();
  readonly stats: CombatStats;
  facing: Facing = -1;
  cooldown = 0;
  staggerFrames = 0;
  /** Seconds the hit flash should remain visible; presentation-only. */
  hitFlash = 0;
  /** Number of successful hits taken (training read-out). */
  hitsTaken = 0;
  /** True while a riposte opening exists and has not been used. */
  riposteOpen = false;
  /** Set when this enemy was parried; biases its next attack choice. */
  wasParried = false;
  /** Tests and tooling can force the next attack (still subject to its range). */
  forcedAttack: string | null = null;
  currentAttack: AttackDefinition;
  /** Number of times this enemy has died. */
  deaths = 0;
  /** Stable id of the level spawn this enemy came from (world rules track defeats by it). */
  spawnId = '';
  /** Seconds until it gets back up after dying; null = stays down (until the player rests). */
  respawnDelay: number | null;
  /** Facing of the most recent hit taken, for the death shove. */
  lastHitFacing: Facing = 1;
  /** Set on death, consumed once by the simulation to grant rewards and roll loot. */
  private deathPending = false;
  private nextAttack: AttackDefinition | null = null;

  constructor(
    readonly def: EnemyDefinition,
    readonly world: CollisionWorld,
    readonly events: SimEventQueue,
    readonly target: TargetView,
    readonly spawnX: number,
    readonly spawnY: number,
    private readonly random: () => number,
  ) {
    this.body = new KinematicBody(spawnX, spawnY, def.body.w, def.body.h);
    this.respawnDelay = def.respawnDelay;
    this.health = new Health(def.maxHealth);
    this.posture = new Posture(def.posture);
    this.stats = { defense: def.defense, absorption: def.absorption, attackMultiplier: 1 };
    this.currentAttack = getAttack(def.attacks[0]!.attack);
    this.fsm = new StateMachine<Enemy, EnemyStateId>(this, ENEMY_STATES, 'idle');
  }

  get isDead(): boolean {
    return this.fsm.is('dead');
  }

  get centerX(): number {
    return this.body.footX;
  }

  /** In a stagger that does not regain posture (parried, broken, riposted). */
  get isReeling(): boolean {
    return this.fsm.is('parried') || this.fsm.is('postureBroken') || this.fsm.is('riposted');
  }

  /** Longest reach of any attack option, px. */
  get maxReach(): number {
    let r = 0;
    for (const o of this.def.attacks) r = Math.max(r, o.maxRange);
    return r;
  }

  step(dt: number): void {
    if (!this.isReeling) this.posture.update(dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.fsm.update(dt);
    this.body.vy = Math.min(this.body.vy + GRAVITY * dt, MAX_FALL);
    this.body.step(this.world, dt);
  }

  /** True exactly once per death. */
  consumeDeath(): boolean {
    if (!this.deathPending) return false;
    this.deathPending = false;
    return true;
  }

  /** Signed horizontal distance to the target. */
  dxToTarget(): number {
    return this.target.body.footX - this.body.footX;
  }

  canSeeTarget(range: number): boolean {
    if (this.target.isDead) return false;
    const dy = Math.abs(this.target.body.footY - this.body.footY);
    return Math.abs(this.dxToTarget()) <= range && dy <= this.def.aggroHeight;
  }

  faceTarget(): void {
    const dx = this.dxToTarget();
    if (Math.abs(dx) > 1) this.facing = dx > 0 ? 1 : -1;
  }

  /** True if there is floor just beyond the body in direction `dir` (no walking off ledges). */
  hasGroundToward(dir: number): boolean {
    const probeX = this.body.footX + dir * (this.body.w / 2 + 2);
    return this.world.isStandableAt(probeX, this.body.footY + 2) && !this.world.isSolidAt(probeX, this.body.footY - 4);
  }

  hasGroundAhead(): boolean {
    return this.hasGroundToward(this.facing);
  }

  /**
   * Weighted, deterministic choice among the attacks usable at `distance`.
   * Returns null when nothing is in range.
   */
  chooseAttack(distance = Math.abs(this.dxToTarget())): AttackDefinition | null {
    const inRange = (o: EnemyAttackOption) => distance >= o.minRange && distance <= o.maxRange;
    if (this.forcedAttack) {
      const option = this.def.attacks.find((o) => o.attack === this.forcedAttack);
      return !option || inRange(option) ? getAttack(this.forcedAttack) : null;
    }
    let total = 0;
    let fastest: AttackDefinition | null = null;
    for (const o of this.def.attacks) {
      if (!inRange(o)) continue;
      total += this.weightOf(o);
      const a = getAttack(o.attack);
      if (!fastest || a.startupFrames < fastest.startupFrames) fastest = a;
    }
    if (!fastest) return null;
    // Punish a broken guard with the fastest option.
    if (this.target.isGuardBroken) return fastest;
    let roll = this.random() * total;
    for (const o of this.def.attacks) {
      if (!inRange(o)) continue;
      roll -= this.weightOf(o);
      if (roll < 0) return getAttack(o.attack);
    }
    return fastest;
  }

  private weightOf(o: EnemyAttackOption): number {
    return this.wasParried ? (o.weightAfterParried ?? o.weight) : o.weight;
  }

  /** Begin an attack chosen by the approach logic. */
  startAttack(attack: AttackDefinition): void {
    this.nextAttack = attack;
    this.fsm.transition('attack');
  }

  takeQueuedAttack(): AttackDefinition {
    const a = this.nextAttack ?? this.chooseAttack() ?? getAttack(this.def.attacks[0]!.attack);
    this.nextAttack = null;
    return a;
  }

  rollRetreat(): boolean {
    const r = this.def.retreat;
    return r !== undefined && this.random() < r.chance;
  }

  // ---- RiposteTarget -----------------------------------------------------------------------

  canBeRiposted(): boolean {
    return this.riposteOpen && (this.fsm.is('parried') || this.fsm.is('postureBroken'));
  }

  claimRiposte(): void {
    this.riposteOpen = false;
  }

  // ---- Combatant ---------------------------------------------------------------------------

  getHurtbox(out: Rect): boolean {
    if (this.isDead) return false;
    setRect(out, this.body.x, this.body.y, this.body.w, this.body.h);
    return true;
  }

  isInvulnerable(): boolean {
    return false;
  }

  writeHitboxes(sink: HitboxSink): void {
    if (this.fsm.is('attack')) this.attack.writeHitboxes(sink, this, this.facing, this.body.footX, this.body.footY);
  }

  receiveHit(result: DamageResult, hit: ActiveHitbox): number | void {
    if (this.isDead) return;
    const dealt = this.health.damage(result.damage);
    this.hitsTaken++;
    this.lastHitFacing = hit.facing;
    this.hitFlash = 0.1;
    this.events.push({
      type: 'hit',
      targetFaction: 'enemy',
      kind: hit.attack.kind,
      x: this.body.footX,
      y: this.body.centerY,
      damage: dealt,
      facing: hit.facing,
    });

    if (this.health.isDepleted) {
      this.fsm.transition('dead');
      return;
    }
    if (hit.attack.kind === 'riposte') {
      this.posture.reset();
      this.body.vx = hit.facing * result.knockbackX;
      this.body.vy = result.knockbackY;
      this.fsm.transition('riposted', true);
      return;
    }
    // Already reeling: extra damage, but the opening neither extends nor resets.
    if (this.isReeling) return;

    if (this.posture.damage(result.postureDamage)) {
      this.breakPosture(hit.facing, result.knockbackX);
      return HITSTOP.postureBreak;
    }
    const phase = this.attack.phase;
    const armored = this.fsm.is('attack') && this.currentAttack.hyperArmor === true && (phase === 'startup' || phase === 'active');
    if (!armored) {
      this.staggerFrames = Math.max(this.def.flinchFrames, Math.round(result.hitstunFrames * 0.4));
      this.body.vx = hit.facing * result.knockbackX * 0.5;
      this.fsm.transition('stagger', true);
    }
    // Otherwise hyper-armour absorbs the flinch: damage and posture land, the swing continues.
  }

  onAttackParried(hit: ActiveHitbox): void {
    if (this.isDead) return;
    this.wasParried = true;
    this.body.vx = -hit.facing * 60;
    if (this.posture.damage(this.def.reactions.parryPostureDamage)) {
      this.breakPosture(-hit.facing, 60);
      return;
    }
    this.riposteOpen = true;
    this.fsm.transition('parried', true);
  }

  private breakPosture(pushFacing: number, knockback: number): void {
    this.body.vx = pushFacing * knockback * 0.4;
    this.riposteOpen = true;
    this.events.push({ type: 'postureBreak', x: this.body.footX, y: this.body.y });
    this.fsm.transition('postureBroken', true);
  }

  /** Called by the dead state's enter. */
  markDead(): void {
    this.deaths++;
    this.deathPending = true;
    this.riposteOpen = false;
  }

  respawn(): void {
    this.health.reset();
    this.posture.reset();
    this.body.teleport(this.spawnX, this.spawnY);
    this.facing = -1;
    this.cooldown = 0;
    this.riposteOpen = false;
    this.wasParried = false;
    this.fsm.transition('idle', true);
    this.events.push({ type: 'respawn', faction: 'enemy', x: this.spawnX, y: this.spawnY });
  }
}

// ---- Shared states ----------------------------------------------------------------------------

const idle: EnemyState = {
  update(e, dt) {
    if (e.canSeeTarget(e.def.aggroRange)) return 'approach';
    e.body.vx = approach(e.body.vx, 0, 600 * dt);
  },
};

/** Close to the preferred distance, back off when crowded, attack when an option is in range. */
const approachState: EnemyState = {
  update(e, dt) {
    if (!e.canSeeTarget(e.def.leashRange)) return 'idle';
    e.faceTarget();
    const distance = Math.abs(e.dxToTarget());
    // A guard-broken target is punished immediately.
    if (e.target.isGuardBroken && distance <= e.maxReach * 1.4) e.cooldown = 0;
    if (e.cooldown <= 0) {
      const attack = e.chooseAttack(distance);
      if (attack) {
        e.startAttack(attack);
        return;
      }
    }
    const s = e.def.spacing;
    let want = 0;
    if (distance > s.preferred && e.hasGroundAhead()) want = e.facing * e.def.walkSpeed;
    else if (distance < s.min && e.hasGroundToward(-e.facing)) want = -e.facing * e.def.walkSpeed * 0.7;
    e.body.vx = approach(e.body.vx, want, 500 * dt);
  },
};

const attackState: EnemyState = {
  enter(e) {
    e.faceTarget();
    e.currentAttack = e.takeQueuedAttack();
    e.wasParried = false;
    e.attack.start(e.currentAttack);
    e.events.push({ type: 'telegraph', x: e.body.footX, y: e.body.y, facing: e.facing, attackId: e.currentAttack.id });
  },
  update(e, dt) {
    const r = e.attack;
    r.tick();
    const def = e.currentAttack;
    if (r.isDone) {
      e.cooldown = e.def.attackCooldown;
      return e.rollRetreat() ? 'retreat' : 'approach';
    }
    // A broken guard is punished: cut the recovery short and swing again at once.
    if (r.phase === 'recovery' && e.target.isGuardBroken) {
      e.cooldown = 0;
      return 'approach';
    }
    if (r.isFirstActiveFrame) {
      e.events.push({ type: 'attack', faction: 'enemy', kind: def.kind, attackId: def.id, x: e.body.footX, y: e.body.footY, facing: e.facing, chargeLevel: 0 });
    }
    if (r.frame === def.movement.lungeFrame && e.hasGroundAhead()) e.body.vx = e.facing * def.movement.lungeSpeed;
    else e.body.vx = approach(e.body.vx, 0, def.movement.friction * dt);
    // Never lunge off a ledge.
    if (!e.hasGroundAhead() && Math.sign(e.body.vx) === e.facing) e.body.vx = 0;
  },
  exit(e) {
    e.attack.clear();
  },
};

/** Hop back out of reach after attacking (Barrow Reaper). Vulnerable while hopping. */
const retreat: EnemyState = {
  update(e, dt) {
    const r = e.def.retreat;
    if (!r || e.fsm.ticks >= r.frames) return 'approach';
    const dir = -e.facing;
    e.body.vx = e.hasGroundToward(dir) ? dir * r.speed : approach(e.body.vx, 0, 900 * dt);
  },
};

function reeling(frames: (e: Enemy) => number): EnemyState {
  return {
    update(e, dt) {
      if (e.fsm.ticks >= frames(e)) return 'approach';
      e.body.vx = approach(e.body.vx, 0, 500 * dt);
    },
    exit(e, next) {
      e.riposteOpen = false;
      // Recovering on its own (not riposted) gives a short beat before it swings again.
      if (next !== 'riposted') e.cooldown = Math.max(e.cooldown, 0.3);
    },
  };
}

const stagger: EnemyState = {
  update(e, dt) {
    if (e.fsm.ticks >= e.staggerFrames) return 'approach';
    e.body.vx = approach(e.body.vx, 0, 700 * dt);
  },
};

const postureBroken: EnemyState = {
  ...reeling((e) => e.def.reactions.postureBrokenFrames),
  exit(e) {
    e.riposteOpen = false;
    e.posture.reset();
  },
};

const dead: EnemyState = {
  enter(e) {
    e.markDead();
    // No residual momentum (e.g. from a lunge): just a short shove from the killing blow.
    e.body.vx = e.lastHitFacing * DEATH_SHOVE;
    e.events.push({ type: 'death', faction: 'enemy', x: e.body.footX, y: e.body.footY });
  },
  update(e, dt) {
    e.body.vx = approach(e.body.vx, 0, 900 * dt);
    if (e.respawnDelay !== null && e.fsm.time >= e.respawnDelay) e.respawn();
  },
};

const ENEMY_STATES: Record<EnemyStateId, EnemyState> = {
  idle,
  approach: approachState,
  attack: attackState,
  retreat,
  stagger,
  parried: reeling((e) => e.def.reactions.parriedFrames),
  postureBroken,
  riposted: {
    update(e, dt) {
      if (e.fsm.ticks >= e.def.reactions.ripostedFrames) return 'approach';
      e.body.vx = approach(e.body.vx, 0, 400 * dt);
    },
  },
  dead,
};
