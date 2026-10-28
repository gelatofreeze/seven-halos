import type { SimEventQueue } from '../world/SimEvents';
import { calculateDamage } from './Damage';
import { HitDetection } from './HitDetection';
import type { Combatant, DamageResult } from './types';

/**
 * Per-step combat resolution: collect active hitboxes → detect overlaps →
 * calculate damage → let targets apply it → emit presentation events.
 */
export class CombatSystem {
  readonly detection = new HitDetection();
  private readonly result: DamageResult = { damage: 0, poiseDamage: 0, knockbackX: 0, knockbackY: 0, hitstunFrames: 0 };
  /** Frames of global hit-stop remaining. */
  hitstop = 0;
  private readonly liveInstances = new Set<number>();
  private readonly seenThisStep = new Set<number>();

  constructor(private readonly events: SimEventQueue) {}

  step(combatants: readonly Combatant[]): void {
    const detection = this.detection;
    detection.beginStep();
    for (const c of combatants) c.writeHitboxes(detection);

    this.seenThisStep.clear();
    detection.forEachActive((hb) => this.seenThisStep.add(hb.instanceId));
    for (const id of this.liveInstances) {
      if (!this.seenThisStep.has(id)) {
        detection.forget(id);
        this.liveInstances.delete(id);
      }
    }
    for (const id of this.seenThisStep) this.liveInstances.add(id);

    for (const { hitbox, target, evaded } of detection.detect(combatants)) {
      const r = hitbox.rect;
      if (evaded) {
        this.events.push({ type: 'evade', x: r.x + r.w / 2, y: r.y + r.h / 2 });
        continue;
      }
      calculateDamage(hitbox.attack, hitbox.owner.stats, target.stats, this.result);
      target.receiveHit(this.result, hitbox);
      this.hitstop = Math.max(this.hitstop, hitbox.attack.hitstopFrames);
    }
  }
}
