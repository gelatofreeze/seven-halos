import type { AttackDefinition, AttackPhase, HitboxSink, Combatant } from './types';
import type { Facing } from '../core/math';

let nextInstanceId = 1;

/** Tracks the frame and phase of one attack execution. Logic, not animation, owns timing. */
export class AttackRunner {
  attack: AttackDefinition | null = null;
  frame = 0;
  instanceId = 0;

  start(attack: AttackDefinition): void {
    this.attack = attack;
    this.frame = 0;
    this.instanceId = nextInstanceId++;
  }

  clear(): void {
    this.attack = null;
    this.frame = 0;
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

  /** Emit hitboxes for the current frame, mirrored to `facing`, relative to the owner's feet. */
  writeHitboxes(sink: HitboxSink, owner: Combatant, facing: Facing, footX: number, footY: number): void {
    const a = this.attack;
    if (!a || this.phase !== 'active') return;
    const activeFrame = this.frame - a.startupFrames;
    for (const hb of a.hitboxes) {
      if (hb.fromFrame !== undefined && activeFrame < hb.fromFrame) continue;
      if (hb.toFrame !== undefined && activeFrame > hb.toFrame) continue;
      const x = facing === 1 ? footX + hb.x : footX - hb.x - hb.w;
      sink.add(owner, a, this.instanceId, facing, x, footY + hb.y, hb.w, hb.h);
    }
  }
}
