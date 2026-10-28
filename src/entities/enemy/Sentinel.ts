import { AttackRunner } from '../../combat/AttackRunner';
import { Health, Posture } from '../../combat/Resources';
import type { ActiveHitbox, AttackDefinition, Combatant, CombatStats, DamageResult, HitboxSink, RiposteTarget } from '../../combat/types';
import { HITSTOP } from '../../config/combat';
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
  /** True while the target is helpless after a guard break. */
  readonly isGuardBroken: boolean;
}

export type SentinelStateId = 'idle' | 'approach' | 'attack' | 'stagger' | 'parried' | 'postureBroken' | 'riposted' | 'dead';
type SentinelState = State<Sentinel, SentinelStateId>;

const GRAVITY = 1100;
const MAX_FALL = 420;

/**
 * Training enemy: a hollow suit of armour guarding the test chamber. It walks
 * into range and swings one of two heavy cleaves: the standard one, or a
 * delayed variant that holds at the top to catch early rolls and parries.
 * Both are hyper-armoured. Posture fills from hits and parries; a full meter,
 * or a parry, opens a single riposte.
 */
export class Sentinel implements Combatant, RiposteTarget {
  private static nextId = 100;
  readonly combatId = Sentinel.nextId++;
  readonly faction = 'enemy' as const;
  readonly body: KinematicBody;
  readonly fsm: StateMachine<Sentinel, SentinelStateId>;
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
  /** Set when this Sentinel was parried; biases its next attack choice. */
  wasParried = false;
  /** Tests and tooling can force the next attack. */
  forcedAttack: string | null = null;
  currentAttack: AttackDefinition;

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
    this.health = new Health(def.maxHealth);
    this.posture = new Posture(def.posture);
    this.stats = { defense: def.defense, absorption: def.absorption, attackMultiplier: 1 };
    this.currentAttack = getAttack(def.attacks[0]!.attack);
    this.fsm = new StateMachine<Sentinel, SentinelStateId>(this, SENTINEL_STATES, 'idle');
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

  step(dt: number): void {
    if (!this.isReeling) this.posture.update(dt);
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

  /** Weighted, deterministic choice of the next attack. */
  chooseAttack(): AttackDefinition {
    if (this.forcedAttack) return getAttack(this.forcedAttack);
    // Punish a broken guard with the fastest option.
    if (this.target.isGuardBroken) return getAttack(this.def.attacks[0]!.attack);
    const options = this.def.attacks;
    const weightOf = (o: (typeof options)[number]) => (this.wasParried ? (o.weightAfterParried ?? o.weight) : o.weight);
    let total = 0;
    for (const o of options) total += weightOf(o);
    let roll = this.random() * total;
    for (const o of options) {
      roll -= weightOf(o);
      if (roll < 0) return getAttack(o.attack);
    }
    return getAttack(options[options.length - 1]!.attack);
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
    // A guard-broken target is punished immediately.
    if (e.target.isGuardBroken && distance <= e.def.attackRange * 1.4) e.cooldown = 0;
    if (distance <= e.def.attackRange && e.cooldown <= 0) return 'attack';
    const tooClose = distance < e.def.attackRange * 0.6;
    const wantSpeed = tooClose || !e.hasGroundAhead() ? 0 : e.facing * e.def.walkSpeed;
    e.body.vx = approach(e.body.vx, wantSpeed, 500 * dt);
  },
};

const attackState: SentinelState = {
  enter(e) {
    e.faceTarget();
    e.currentAttack = e.chooseAttack();
    e.wasParried = false;
    e.attack.start(e.currentAttack);
    e.events.push({ type: 'telegraph', x: e.body.footX, y: e.body.y, facing: e.facing });
  },
  update(e, dt) {
    const r = e.attack;
    r.tick();
    const def = e.currentAttack;
    if (r.isDone) {
      e.cooldown = e.def.attackCooldown;
      return 'approach';
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
  },
  exit(e) {
    e.attack.clear();
  },
};

function reeling(frames: (e: Sentinel) => number): SentinelState {
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

const stagger: SentinelState = {
  update(e, dt) {
    if (e.fsm.ticks >= e.staggerFrames) return 'approach';
    e.body.vx = approach(e.body.vx, 0, 700 * dt);
  },
};

const postureBroken: SentinelState = {
  ...reeling((e) => e.def.reactions.postureBrokenFrames),
  exit(e) {
    e.riposteOpen = false;
    e.posture.reset();
  },
};

const dead: SentinelState = {
  enter(e) {
    e.riposteOpen = false;
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
