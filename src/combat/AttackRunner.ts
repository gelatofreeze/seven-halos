import type { AttackDefinition, AttackPhase, HitboxSink, Combatant } from './types';
import type { Facing } from '../core/math';

let nextInstanceId = 1;

/**
 * Tracks the frame, phase and charge of one attack execution. Logic, not
 * animation, owns timing. Call `tick` once per update: the first tick
 * processes frame 0; later ticks advance one frame, or hold on the charge
 * frame while charging.
 */
export class AttackRunner {
  attack: AttackDefinition | null = null;
  frame = 0;
  instanceId = 0;
  /** Frames spent holding on the charge frame. */
  chargeFrames = 0;
  /** True if the last tick held the charge. */
  charging = false;
  private fresh = false;

  start(attack: AttackDefinition): void {
    this.attack = attack;
    this.frame = 0;
    this.chargeFrames = 0;
    this.charging = false;
    this.fresh = true;
    this.instanceId = nextInstanceId++;
  }

  clear(): void {
    this.attack = null;
    this.frame = 0;
    this.chargeFrames = 0;
    this.charging = false;
  }

  /**
   * Advance one frame. `holdCharge` is honoured only on the attack's charge
   * frame and until the maximum charge is reached.
   */
  tick(holdCharge = false): void {
    if (this.fresh) {
      this.fresh = false;
      return;
    }
    const charge = this.attack?.charge;
    if (holdCharge && charge && this.frame === charge.holdFrame && this.chargeFrames < charge.maxFrames) {
      this.chargeFrames++;
      this.charging = true;
      return;
    }
    this.charging = false;
    this.frame++;
  }

  /** 0..1 charge level. */
  get chargeLevel(): number {
    const charge = this.attack?.charge;
    return charge ? Math.min(1, this.chargeFrames / charge.maxFrames) : 0;
  }

  get totalFrames(): number {
    const a = this.attack;
    return a ? a.startupFrames + a.activeFrames + a.recoveryFrames : 0;
  }

  get phase(): AttackPhase {
    const a = this.attack;
    if (!a) return 'done';
    if (this.frame < a.startupFrames) return 'startup';
    if (this.frame < a.startupFrames + a.activeFrames) return 'active';
    if (this.frame < this.totalFrames) return 'recovery';
    return 'done';
  }

  /** 0..1 progress through the current phase, for animation and telegraph visuals. */
  get phaseProgress(): number {
    const a = this.attack;
    if (!a) return 0;
    const phase = this.phase;
    if (phase === 'startup') return this.frame / Math.max(1, a.startupFrames);
    if (phase === 'active') return (this.frame - a.startupFrames) / Math.max(1, a.activeFrames);
    if (phase === 'recovery') return (this.frame - a.startupFrames - a.activeFrames) / Math.max(1, a.recoveryFrames);
    return 1;
  }

  get isDone(): boolean {
    return this.phase === 'done';
  }

  /** True on the first active frame (for swing sounds and effects). */
  get isFirstActiveFrame(): boolean {
    return this.attack !== null && this.frame === this.attack.startupFrames && !this.charging;
  }

  /** Emit hitboxes for the current frame, mirrored to `facing`, relative to the owner's feet. */
  writeHitboxes(sink: HitboxSink, owner: Combatant, facing: Facing, footX: number, footY: number): void {
    const a = this.attack;
    if (!a || this.phase !== 'active') return;
    const activeFrame = this.frame - a.startupFrames;
    const level = this.chargeLevel;
    for (const hb of a.hitboxes) {
      if (hb.fromFrame !== undefined && activeFrame < hb.fromFrame) continue;
      if (hb.toFrame !== undefined && activeFrame > hb.toFrame) continue;
      const x = facing === 1 ? footX + hb.x : footX - hb.x - hb.w;
      sink.add(owner, a, this.instanceId, facing, level, x, footY + hb.y, hb.w, hb.h);
    }
  }
}
