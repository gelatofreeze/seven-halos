import { AttackRunner } from '../../combat/AttackRunner';
import { Health, Stamina } from '../../combat/Resources';
import type { ActiveHitbox, AttackDefinition, Combatant, CombatStats, DamageResult, DefenseState, HitboxSink, RiposteTarget } from '../../combat/types';
import { GUARD, PARRY, RIPOSTE } from '../../config/combat';
import { PLAYER_COMBAT } from '../../config/player';
import { jumpPhysics, PLAYER_MOVEMENT, type MovementTuning } from '../../config/movement';
import { approach, sign, type Facing } from '../../core/math';
import { setRect, type Rect } from '../../core/Rect';
import { StateMachine } from '../../core/StateMachine';
import { createInputFrame, type InputFrame } from '../../input/InputActions';
import { Equipment } from '../../inventory/Equipment';
import type { CollisionWorld } from '../../physics/CollisionWorld';
import { KinematicBody } from '../../physics/KinematicBody';
import { deriveCombatStats, STARTING_ATTRIBUTES, type Attributes } from '../../rpg/Attributes';
import type { SimEventQueue } from '../../world/SimEvents';
import { PLAYER_STATES, type PlayerStateId } from './PlayerStates';

/**
 * The player character: body, resources, equipment and the action state
 * machine. It consumes an `InputFrame` per fixed step and knows nothing about
 * devices, rendering or Phaser.
 */
export class Player implements Combatant {
  readonly combatId = 1;
  readonly faction = 'player' as const;
  readonly body: KinematicBody;
  readonly fsm: StateMachine<Player, PlayerStateId>;
  readonly input: InputFrame = createInputFrame();
  readonly health = new Health(PLAYER_COMBAT.maxHealth);
  readonly stamina = new Stamina(PLAYER_COMBAT.stamina);
  readonly equipment = new Equipment('pilgrim-sword');
  readonly attack = new AttackRunner();
  attributes: Attributes = { ...STARTING_ATTRIBUTES };
  stats: CombatStats = deriveCombatStats(this.attributes);

  facing: Facing = 1;
  readonly gravity: number;
  readonly takeoffSpeed: number;

  // Timers, in seconds.
  coyoteTimer = 0;
  jumpBuffer = 0;
  attackBuffer = 0;
  heavyBuffer = 0;
  dodgeBuffer = 0;
  parryBuffer = 0;
  postHitInvulnerability = 0;

  /** True from takeoff until landing, for apex hang and the release cut. */
  jumping = false;
  jumpCutApplied = false;
  /** Downward speed at the moment of the most recent landing. */
  landingSpeed = 0;
  justLanded = false;
  dodgeDirection: Facing = 1;
  /** Frame index the current action state processed this step (-1 before its first frame). */
  actionFrame = -1;
  hurtFrames = 0;
  /** Frames of block-stun remaining while guarding. */
  blockStunFrames = 0;
  /** The attack the attack state will start on its next entry (light, heavy or combo follow-up). */
  nextAttack: AttackDefinition | null = null;
  /** Enemies that may be riposted; wired up by the simulation. */
  riposteTargets: readonly RiposteTarget[] = [];
  riposteTarget: RiposteTarget | null = null;

  spawnX: number;
  spawnY: number;
  private safeX: number;
  private safeY: number;

  constructor(
    readonly world: CollisionWorld,
    readonly events: SimEventQueue,
    footX: number,
    footY: number,
    readonly tuning: MovementTuning = PLAYER_MOVEMENT,
  ) {
    this.body = new KinematicBody(footX, footY, PLAYER_COMBAT.body.w, PLAYER_COMBAT.body.h);
    this.spawnX = this.safeX = footX;
    this.spawnY = this.safeY = footY;
    const physics = jumpPhysics(tuning.jump);
    this.gravity = physics.gravity;
    this.takeoffSpeed = physics.takeoffSpeed;
    this.body.grounded = this.body.probeGround(world);
    this.fsm = new StateMachine<Player, PlayerStateId>(this, PLAYER_STATES, 'idle');
  }

  /** Re-derive combat stats from attributes and the equipped weapon's upgrade level. */
  refreshStats(): void {
    const stats = deriveCombatStats(this.attributes);
    stats.attackMultiplier *= this.equipment.damageMultiplier();
    this.stats = stats;
  }

  /** Forget buffered presses (e.g. across a menu), so nothing fires on its own afterwards. */
  clearBufferedActions(): void {
    this.jumpBuffer = this.attackBuffer = this.heavyBuffer = this.dodgeBuffer = this.parryBuffer = 0;
  }

  /** Equipment may only change in neutral states, never mid-action. */
  canChangeEquipment(): boolean {
    const s = this.fsm.current;
    return s === 'idle' || s === 'run' || s === 'land' || s === 'jump' || s === 'fall';
  }

  get state(): PlayerStateId {
    return this.fsm.current;
  }

  get isDead(): boolean {
    return this.fsm.is('dead');
  }

  /** Advance one fixed step. */
  step(input: InputFrame, dt: number): void {
    Object.assign(this.input, input);
    const t = this.tuning;

    this.jumpBuffer = input.jumpPressed ? t.jump.bufferTime : Math.max(0, this.jumpBuffer - dt);
    this.attackBuffer = input.attackPressed ? t.actionBufferTime : Math.max(0, this.attackBuffer - dt);
    this.heavyBuffer = input.heavyPressed ? t.actionBufferTime : Math.max(0, this.heavyBuffer - dt);
    this.dodgeBuffer = input.dodgePressed ? t.actionBufferTime : Math.max(0, this.dodgeBuffer - dt);
    this.parryBuffer = input.parryPressed ? t.actionBufferTime : Math.max(0, this.parryBuffer - dt);
    this.postHitInvulnerability = Math.max(0, this.postHitInvulnerability - dt);
    this.stamina.update(dt, this.staminaRegenMultiplier());

    this.fsm.update(dt);

    const vyBefore = this.body.vy;
    this.applyGravity(dt);
    this.body.step(this.world, dt);

    this.justLanded = this.body.grounded && !this.body.wasGrounded;
    if (this.justLanded) {
      this.landingSpeed = Math.max(vyBefore, 0);
      this.jumping = false;
    }
    this.coyoteTimer = this.body.grounded ? t.jump.coyoteTime : Math.max(0, this.coyoteTimer - dt);

    if (this.body.grounded && !this.isDead && this.isOnSafeGround()) {
      this.safeX = this.body.footX;
      this.safeY = this.body.footY;
    }
    this.checkAbyss();
  }

  private staminaRegenMultiplier(): number {
    const s = this.fsm.current;
    if (s === 'attack' || s === 'dodge' || s === 'parry' || s === 'riposte') return this.stamina.tuning.busyRegenMultiplier;
    if (s === 'guard') return GUARD.staminaRegenMultiplier;
    return 1;
  }

  // ---- Movement helpers used by states -------------------------------------------------

  /** Horizontal acceleration toward the input direction, ground or air tuning. */
  moveHorizontal(dt: number, speedMultiplier = 1): void {
    const h = this.body.grounded ? this.tuning.ground : this.tuning.air;
    const target = this.input.moveX * h.maxSpeed * speedMultiplier;
    const vx = this.body.vx;
    let rate: number;
    if (target === 0) rate = h.deceleration;
    else if (vx !== 0 && sign(vx) !== sign(target)) rate = h.turnAcceleration;
    else if (Math.abs(vx) > Math.abs(target)) rate = h.deceleration;
    else rate = h.acceleration;
    this.body.vx = approach(vx, target, rate * dt);
  }

  /** Bleed horizontal speed with no input influence. */
  applyFriction(rate: number, dt: number): void {
    this.body.vx = approach(this.body.vx, 0, rate * dt);
  }

  faceInput(): void {
    if (this.input.moveX !== 0) this.facing = this.input.moveX > 0 ? 1 : -1;
  }

  private applyGravity(dt: number): void {
    const j = this.tuning.jump;
    const vy = this.body.vy;
    const held = this.input.jumpHeld;
    let multiplier: number;
    if (vy < 0) {
      multiplier = !held ? j.lowJumpGravityMultiplier : Math.abs(vy) < j.apexThreshold ? j.apexGravityMultiplier : 1;
    } else if (held && this.jumping && vy < j.apexThreshold) {
      multiplier = j.apexGravityMultiplier;
    } else {
      multiplier = this.input.down ? j.fastFallGravityMultiplier : j.fallGravityMultiplier;
    }
    const maxFall = this.input.down ? j.fastFallSpeed : j.maxFallSpeed;
    // Above terminal speed (e.g. fast-fall released) ease back down instead of snapping.
    this.body.vy = vy > maxFall ? Math.max(maxFall, vy - this.gravity * dt) : Math.min(vy + this.gravity * multiplier * dt, maxFall);
  }

  // ---- Action gating ------------------------------------------------------------------------

  canJump(): boolean {
    return this.body.grounded || this.coyoteTimer > 0;
  }

  canDodge(): boolean {
    return this.stamina.canSpend() && (this.body.grounded || this.tuning.dodge.allowInAir);
  }

  canAttack(): boolean {
    return this.stamina.canSpend();
  }

  doJump(): void {
    this.body.vy = -this.takeoffSpeed;
    this.body.grounded = false;
    this.jumpBuffer = 0;
    this.coyoteTimer = 0;
    this.jumping = true;
    this.jumpCutApplied = false;
    this.stamina.spend(this.tuning.jump.staminaCost);
    this.events.push({ type: 'jump', x: this.body.footX, y: this.body.footY });
  }

  canParry(): boolean {
    return this.body.grounded && this.stamina.canSpend();
  }

  /** Guard is a hold: raised whenever the button is held on the ground. Low stamina does not prevent raising it. */
  wantsGuard(): boolean {
    return this.input.guardHeld && this.body.grounded;
  }

  /** Nearest staggered enemy within riposte reach, if any. */
  findRiposteTarget(): RiposteTarget | null {
    if (!this.body.grounded) return null;
    for (const t of this.riposteTargets) {
      if (!t.canBeRiposted()) continue;
      if (Math.abs(t.body.footX - this.body.footX) > RIPOSTE.range) continue;
      if (Math.abs(t.body.footY - this.body.footY) > RIPOSTE.maxHeightDifference) continue;
      return t;
    }
    return null;
  }

  /**
   * Start whichever buffered action is allowed, in priority order
   * dodge → parry → jump → riposte → heavy → light. Returns the state to
   * enter, or null. Jumping before attacking lets jump+attack pressed
   * together become a jump attack; a light attack next to a staggered enemy
   * becomes a riposte.
   */
  tryStartAction(): PlayerStateId | null {
    if (this.dodgeBuffer > 0 && this.canDodge()) return 'dodge';
    if (this.parryBuffer > 0 && this.canParry()) return 'parry';
    if (this.jumpBuffer > 0) {
      if (this.body.grounded && this.input.down && this.body.standingOnOneWayOnly(this.world)) {
        this.body.dropThroughTime = this.tuning.dropThroughTime;
        this.body.grounded = false;
        this.jumpBuffer = 0;
        return 'fall';
      }
      if (this.canJump()) {
        this.doJump();
        return 'jump';
      }
    }
    if (this.attackBuffer > 0) {
      const target = this.findRiposteTarget();
      if (target) {
        this.riposteTarget = target;
        return 'riposte';
      }
    }
    if (this.heavyBuffer > 0 && this.body.grounded && this.canAttack()) {
      this.nextAttack = this.equipment.heavyAttack();
      return 'attack';
    }
    if (this.attackBuffer > 0 && this.canAttack()) {
      this.nextAttack = this.equipment.lightAttack();
      return 'attack';
    }
    return null;
  }

  locomotionState(): PlayerStateId {
    if (!this.body.grounded) return 'fall';
    return this.input.moveX !== 0 ? 'run' : 'idle';
  }

  // ---- Combatant ---------------------------------------------------------------------------

  getHurtbox(out: Rect): boolean {
    if (this.isDead) return false;
    setRect(out, this.body.x, this.body.y, this.body.w, this.body.h);
    return true;
  }

  get centerX(): number {
    return this.body.footX;
  }

  /** True during dodge i-frames, ripostes, post-hit grace, and death. */
  isInvulnerable(): boolean {
    if (this.isDead || this.postHitInvulnerability > 0 || this.fsm.is('riposte')) return true;
    return this.isDodgeInvulnerable();
  }

  isGuardRaised(): boolean {
    return this.fsm.is('guard') && this.actionFrame >= GUARD.raiseFrames;
  }

  isParryActive(): boolean {
    return this.fsm.is('parry') && this.actionFrame >= PARRY.startupFrames && this.actionFrame < PARRY.startupFrames + PARRY.windowFrames;
  }

  /** True while the player can't act after a guard break. */
  get isGuardBroken(): boolean {
    return this.fsm.is('guardBroken');
  }

  private readonly defenseState: DefenseState = { mode: 'none', facing: 1, stamina: 0 };

  defense(): DefenseState {
    const d = this.defenseState;
    d.mode = this.isParryActive() ? 'parry' : this.isGuardRaised() ? 'guard' : 'none';
    d.facing = this.facing;
    d.stamina = this.stamina.current;
    return d;
  }

  isDodgeInvulnerable(): boolean {
    if (!this.fsm.is('dodge')) return false;
    const d = this.tuning.dodge;
    return this.actionFrame >= d.startupFrames && this.actionFrame < d.startupFrames + d.invulnerableFrames;
  }

  writeHitboxes(sink: HitboxSink): void {
    if (this.fsm.is('attack') || this.fsm.is('riposte')) this.attack.writeHitboxes(sink, this, this.facing, this.body.footX, this.body.footY);
  }

  receiveBlock(result: DamageResult, hit: ActiveHitbox, staminaCost: number, guardBroken: boolean): void {
    if (this.isDead) return;
    this.health.damage(Math.round(result.damage * (1 - GUARD.damageReduction)));
    this.events.push({ type: 'block', x: this.body.footX + this.facing * 6, y: this.body.centerY, guardBroken, facing: hit.facing });
    if (this.health.isDepleted) {
      this.fsm.transition('dead');
      return;
    }
    this.body.vx = hit.facing * result.knockbackX * GUARD.pushbackMultiplier;
    if (guardBroken) {
      this.stamina.spend(this.stamina.current + 1);
      this.fsm.transition('guardBroken', true);
    } else {
      this.stamina.spend(staminaCost);
      this.blockStunFrames = GUARD.blockStunFrames;
    }
  }

  receiveParrySuccess(_hit: ActiveHitbox): void {
    // Deflected: no damage, a short grace period, and free to act (riposte!) immediately.
    this.postHitInvulnerability = PARRY.successInvulnerableFrames / 60;
    this.fsm.transition(this.locomotionState(), true);
  }

  receiveHit(result: DamageResult, hit: ActiveHitbox): void {
    if (this.isDead) return;
    const dealt = this.health.damage(result.damage);
    this.postHitInvulnerability = PLAYER_COMBAT.postHitInvulnerability;
    this.events.push({
      type: 'hit',
      targetFaction: 'player',
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
    this.hurtFrames = result.hitstunFrames;
    this.body.vx = hit.facing * result.knockbackX;
    this.body.vy = result.knockbackY;
    this.body.grounded = false;
    this.fsm.transition('hurt', true);
  }

  // ---- Life cycle ---------------------------------------------------------------------------

  /**
   * Replaces the in-place respawn after death, e.g. with a trip back to the
   * last shrine (set by the simulation in world regions). Called every step
   * once the death delay has passed, so it must be idempotent.
   */
  respawnOverride: (() => void) | null = null;

  respawn(): void {
    if (this.respawnOverride) {
      this.respawnOverride();
      return;
    }
    this.health.reset();
    this.stamina.reset();
    this.body.teleport(this.spawnX, this.spawnY);
    this.body.grounded = this.body.probeGround(this.world);
    this.safeX = this.spawnX;
    this.safeY = this.spawnY;
    this.facing = 1;
    this.jumping = false;
    this.postHitInvulnerability = 0;
    this.clearBufferedActions();
    this.blockStunFrames = 0;
    this.fsm.transition('idle', true);
    this.events.push({ type: 'respawn', faction: 'player', x: this.spawnX, y: this.spawnY });
  }

  /** Solid (not one-way) floor under both edges of the body, with a margin from any ledge. */
  private isOnSafeGround(): boolean {
    const b = this.body;
    const y = b.footY + 1;
    const margin = PLAYER_COMBAT.safeGroundMargin;
    return this.world.isSolidAt(b.x - margin, y) && this.world.isSolidAt(b.x + b.w + margin, y);
  }

  private checkAbyss(): void {
    const b = this.world.bounds;
    if (this.body.y < b.y + b.h + PLAYER_COMBAT.abyssMargin) return;
    if (this.isDead) return;
    this.health.damage(PLAYER_COMBAT.abyssDamage);
    this.body.teleport(this.safeX, this.safeY);
    this.body.grounded = this.body.probeGround(this.world);
    this.jumping = false;
    if (this.health.isDepleted) this.fsm.transition('dead');
    else {
      this.postHitInvulnerability = PLAYER_COMBAT.postHitInvulnerability;
      this.fsm.transition('idle', true);
    }
  }
}
