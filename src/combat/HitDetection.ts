import { makeRect, rectsOverlap, type Rect } from '../core/Rect';
import type { Facing } from '../core/math';
import type { ActiveHitbox, AttackDefinition, Combatant, HitboxSink } from './types';

export interface HitCandidate {
  hitbox: ActiveHitbox;
  target: Combatant;
  /** True when the overlap happened during the target's invincibility. */
  evaded: boolean;
}

/**
 * Geometry only: finds hitbox/hurtbox overlaps between opposing factions and
 * filters out targets an attack instance has already hit. It does not decide
 * damage. Hitbox objects are pooled to avoid per-step allocation.
 */
export class HitDetection implements HitboxSink {
  private readonly pool: ActiveHitbox[] = [];
  private count = 0;
  private readonly hurtbox: Rect = makeRect();
  /** instanceId → combat ids already hit by that attack execution. */
  private readonly alreadyHit = new Map<number, Set<number>>();
  private readonly alreadyEvaded = new Map<number, Set<number>>();
  readonly candidates: HitCandidate[] = [];

  beginStep(): void {
    this.count = 0;
    this.candidates.length = 0;
  }

  add(owner: Combatant, attack: AttackDefinition, instanceId: number, facing: Facing, x: number, y: number, w: number, h: number): void {
    let hb = this.pool[this.count];
    if (!hb) {
      hb = { owner, attack, instanceId, facing, rect: makeRect() };
      this.pool.push(hb);
    }
    hb.owner = owner;
    hb.attack = attack;
    hb.instanceId = instanceId;
    hb.facing = facing;
    hb.rect.x = x;
    hb.rect.y = y;
    hb.rect.w = w;
    hb.rect.h = h;
    this.count++;
  }

  /** Visit hitboxes registered this step (also used for debug drawing). */
  forEachActive(fn: (hb: ActiveHitbox) => void): void {
    for (let i = 0; i < this.count; i++) fn(this.pool[i]!);
  }

  detect(combatants: readonly Combatant[]): HitCandidate[] {
    for (let i = 0; i < this.count; i++) {
      const hb = this.pool[i]!;
      for (const target of combatants) {
        if (target === hb.owner || target.faction === hb.owner.faction) continue;
        if (!target.getHurtbox(this.hurtbox)) continue;
        if (!rectsOverlap(hb.rect, this.hurtbox)) continue;
        if (this.setFor(this.alreadyHit, hb.instanceId).has(target.combatId)) continue;
        // One overlapping hitbox per target per step is enough.
        if (this.candidates.some((c) => c.target === target && c.hitbox.instanceId === hb.instanceId)) continue;
        const evaded = target.isInvulnerable();
        if (evaded) {
          const evadedSet = this.setFor(this.alreadyEvaded, hb.instanceId);
          if (evadedSet.has(target.combatId)) continue;
          evadedSet.add(target.combatId);
        } else {
          this.setFor(this.alreadyHit, hb.instanceId).add(target.combatId);
        }
        this.candidates.push({ hitbox: { ...hb, rect: { ...hb.rect } }, target, evaded });
      }
    }
    return this.candidates;
  }

  /** Forget bookkeeping for attack executions that have ended. */
  forget(instanceId: number): void {
    this.alreadyHit.delete(instanceId);
    this.alreadyEvaded.delete(instanceId);
  }

  private setFor(map: Map<number, Set<number>>, id: number): Set<number> {
    let set = map.get(id);
    if (!set) {
      set = new Set();
      map.set(id, set);
    }
    return set;
  }
}
