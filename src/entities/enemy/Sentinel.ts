import { AttackRunner } from '../../combat/AttackRunner';
import { Health, Poise } from '../../combat/Resources';
import type { ActiveHitbox, AttackDefinition, Combatant, CombatStats, DamageResult, HitboxSink } from '../../combat/types';
import { approach, type Facing } from '../../core/math';
import { setRect, type Rect } from '../../core/Rect';
import { StateMachine, type State } from '../../core/StateMachine';
import type { EnemyDefinition } from '../../data/enemies';
import { getAttack } from '../../data/weapons';
import type { CollisionWorld } from '../../physics/CollisionWorld';
import { KinematicBody } from '../../physics/KinematicBody';
import type { SimEventQueue } from '../../world/SimEvents';

/** What an enemy needs to know about its target; keeps AI decoupled from the Player class. */
export interface TargetView {
  readonly body: { readonly footX: number; readonly footY: number };
  readonly isDead: boolean;
}

export type SentinelStateId = 'idle' | 'approach' | 'attack' | 'stagger' | 'dead';
type SentinelState = State<Sentinel, SentinelStateId>;

const GRAVITY = 1100;
const MAX_FALL = 420;

/**
 * Training enemy: a hollow suit of armour guarding the test chamber. It walks
 * into range, telegraphs one heavy cleave with a long, readable startup, and
 * leaves a punish window in recovery. Poise and hyper-armour decide whether
 * the player's hits interrupt it.
 */
export class Sentinel implements Combatant {
  private static nextId = 100;
  readonly combatId = Sentinel.nextId++;
  readonly faction = 'enemy' as const;
  readonly body: KinematicBody;
  readonly fsm: StateMachine<Sentinel, SentinelStateId>;
  readonly health: Health;
  readonly poise: Poise;
  readonly attack = new AttackRunner();
  readonly attackDef: AttackDefinition;
  readonly stats: CombatStats;
  facing: Facing = -1;
  cooldown = 0;
  staggerFrames = 0;
  /** Seconds the hit flash should remain visible; presentation-only. */
  hitFlash = 0;
  /** Number of successful hits taken (training read-out). */
  hitsTaken = 0;

  constructor(
    readonly def: EnemyDefinition,
    readonly world: CollisionWorld,
    readonly events: SimEventQueue,
    readonly target: TargetView,
    readonly spawnX: number,
    readonly spawnY: number,
  ) {
    this.body = new KinematicBody(spawnX, spawnY, def.body.w, def.body.h);
    this.health = new Health(def.maxHealth);
    this.poise = new Poise(def.poise, def.poiseResetDelay);
    this.attackDef = getAttack(def.attack);
    this.stats = { defense: def.defense, absorption: def.absorption, attackMultiplier: 1 };
    this.fsm = new StateMachine<Sentinel, SentinelStateId>(this, SENTINEL_STATES, 'idle');
  }

  get isDead(): boolean {
    return this.fsm.is('dead');
  }

  step(dt: number): void {
    this.poise.update(dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.fsm.update(dt);
    this.body.vy = Math.min(this.body.vy + GRAVITY * dt, MAX_FALL);
    this.body.step(this.world, dt);
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

  /** True if there is floor just ahead in the facing direction (no walking off ledges). */
  hasGroundAhead(): boolean {
    const probeX = this.body.footX + this.facing * (this.body.w / 2 + 2);
    return this.world.isStandableAt(probeX, this.body.footY + 2);
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

  receiveHit(result: DamageResult, hit: ActiveHitbox): void {
    if (this.isDead) return;
    const dealt = this.health.damage(result.damage);
    this.hitsTaken++;
    this.hitFlash = 0.1;
    const phase = this.attack.phase;
    const armored = this.fsm.is('attack') && (phase === 'startup' || phase === 'active');
    const broken = this.poise.damage(result.poiseDamage, armored ? (this.attackDef.hyperArmor ?? 0) : 0);
    this.events.push({
      type: 'hit',
      targetFaction: 'enemy',
      x: this.body.footX,
      y: this.body.centerY,
      damage: dealt,
      poiseBroken: broken,
      facing: hit.facing,
    });

    if (this.health.isDepleted) {
      this.fsm.transition('dead');
      return;
    }
    if (broken) {
      this.staggerFrames = result.hitstunFrames;
      this.body.vx = hit.facing * result.knockbackX;
      this.body.vy = result.knockbackY * 0.5;
      this.fsm.transition('stagger', true);
    } else if (!this.fsm.is('attack')) {
      this.staggerFrames = this.def.flinchFrames;
      this.body.vx = hit.facing * result.knockbackX * 0.5;
      this.fsm.transition('stagger', true);
    }
    // Otherwise hyper-armour absorbs the hit: damage is taken but the attack continues.
  }

  respawn(): void {
    this.health.reset();
    this.poise.reset();
    this.body.teleport(this.spawnX, this.spawnY);
    this.facing = -1;
    this.cooldown = 0;
    this.fsm.transition('idle', true);
    this.events.push({ type: 'respawn', faction: 'enemy', x: this.spawnX, y: this.spawnY });
  }
}

const idle: SentinelState = {
  update(e, dt) {
    if (e.canSeeTarget(e.def.aggroRange)) return 'approach';
    e.body.vx = approach(e.body.vx, 0, 600 * dt);
  },
};

const approachState: SentinelState = {
  update(e, dt) {
    if (!e.canSeeTarget(e.def.leashRange)) return 'idle';
    e.faceTarget();
    const distance = Math.abs(e.dxToTarget());
    if (distance <= e.def.attackRange && e.cooldown <= 0) return 'attack';
    const tooClose = distance < e.def.attackRange * 0.6;
    const wantSpeed = tooClose || !e.hasGroundAhead() ? 0 : e.facing * e.def.walkSpeed;
    e.body.vx = approach(e.body.vx, wantSpeed, 500 * dt);
  },
};

const attackState: SentinelState = {
  enter(e) {
    e.faceTarget();
    e.attack.start(e.attackDef);
    e.events.push({ type: 'telegraph', x: e.body.footX, y: e.body.y, facing: e.facing });
  },
  update(e, dt) {
    const frame = e.fsm.ticks;
    e.attack.frame = frame;
    const def = e.attackDef;
    if (e.attack.isDone) {
      e.cooldown = e.def.attackCooldown;
      return 'approach';
    }
    if (frame === def.startupFrames) {
      e.events.push({ type: 'attack', faction: 'enemy', attackId: def.id, x: e.body.footX, y: e.body.footY, facing: e.facing });
    }
    if (frame === def.movement.lungeFrame && e.hasGroundAhead()) e.body.vx = e.facing * def.movement.lungeSpeed;
    else e.body.vx = approach(e.body.vx, 0, def.movement.friction * dt);
  },
  exit(e) {
    e.attack.clear();
  },
};

const stagger: SentinelState = {
  update(e, dt) {
    if (e.fsm.ticks >= e.staggerFrames) return 'approach';
    e.body.vx = approach(e.body.vx, 0, 700 * dt);
  },
};

const dead: SentinelState = {
  enter(e) {
    e.events.push({ type: 'death', faction: 'enemy', x: e.body.footX, y: e.body.footY });
  },
  update(e, dt) {
    e.body.vx = approach(e.body.vx, 0, 600 * dt);
    if (e.def.respawnDelay !== null && e.fsm.time >= e.def.respawnDelay) e.respawn();
  },
};

const SENTINEL_STATES: Record<SentinelStateId, SentinelState> = {
  idle,
  approach: approachState,
  attack: attackState,
  stagger,
  dead,
};
