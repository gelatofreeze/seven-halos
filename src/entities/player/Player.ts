import { AttackRunner } from '../../combat/AttackRunner';
import { Health, Stamina } from '../../combat/Resources';
import type { ActiveHitbox, AttackDefinition, Combatant, CombatStats, DamageResult, HitboxSink } from '../../combat/types';
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
  dodgeBuffer = 0;
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
  /** Set by the attack state before a forced re-entry to chain the combo. */
  pendingComboAttack: AttackDefinition | null = null;

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
    this.dodgeBuffer = input.dodgePressed ? t.actionBufferTime : Math.max(0, this.dodgeBuffer - dt);
    this.postHitInvulnerability = Math.max(0, this.postHitInvulnerability - dt);
    this.stamina.update(dt, this.fsm.is('attack') || this.fsm.is('dodge'));

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

  /**
   * Start whichever buffered action is allowed, in priority order
   * dodge → jump → attack. Returns the state to enter, or null.
   * Jumping before attacking lets jump+attack pressed together become a jump attack.
   */
  tryStartAction(): PlayerStateId | null {
    if (this.dodgeBuffer > 0 && this.canDodge()) return 'dodge';
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
    if (this.attackBuffer > 0 && this.canAttack()) return 'attack';
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

  /** True during dodge i-frames, post-hit grace, and death. */
  isInvulnerable(): boolean {
    if (this.isDead || this.postHitInvulnerability > 0) return true;
    return this.isDodgeInvulnerable();
  }

  isDodgeInvulnerable(): boolean {
    if (!this.fsm.is('dodge')) return false;
    const d = this.tuning.dodge;
    return this.actionFrame >= d.startupFrames && this.actionFrame < d.startupFrames + d.invulnerableFrames;
  }

  writeHitboxes(sink: HitboxSink): void {
    if (this.fsm.is('attack')) this.attack.writeHitboxes(sink, this, this.facing, this.body.footX, this.body.footY);
  }

  receiveHit(result: DamageResult, hit: ActiveHitbox): void {
    if (this.isDead) return;
    const dealt = this.health.damage(result.damage);
    this.postHitInvulnerability = PLAYER_COMBAT.postHitInvulnerability;
    this.events.push({
      type: 'hit',
      targetFaction: 'player',
      x: this.body.footX,
      y: this.body.centerY,
      damage: dealt,
      poiseBroken: true,
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

  respawn(): void {
    this.health.reset();
    this.stamina.reset();
    this.body.teleport(this.spawnX, this.spawnY);
    this.body.grounded = this.body.probeGround(this.world);
    this.safeX = this.spawnX;
    this.safeY = this.spawnY;
    this.facing = 1;
    this.jumping = false;
    this.postHitInvulnerability = 0;
    this.jumpBuffer = this.attackBuffer = this.dodgeBuffer = 0;
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
