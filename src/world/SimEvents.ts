import type { AttackKind, Faction } from '../combat/types';
import type { Rarity } from '../data/items';

/**
 * One-way notifications from the simulation to presentation (sound, particles,
 * camera). Gameplay never depends on whether these are consumed.
 */
export type SimEvent =
  | { type: 'jump'; x: number; y: number }
  | { type: 'land'; x: number; y: number; hard: boolean }
  | { type: 'dodge'; x: number; y: number; facing: number }
  /** First active frame of an attack (swing). */
  | { type: 'attack'; faction: Faction; kind: AttackKind; attackId: string; x: number; y: number; facing: number; chargeLevel: number }
  | { type: 'chargeStart'; x: number; y: number }
  | { type: 'chargeFull'; x: number; y: number }
  | { type: 'chargeEnd' }
  | { type: 'telegraph'; x: number; y: number; facing: number; attackId: string }
  | { type: 'hit'; targetFaction: Faction; kind: AttackKind; x: number; y: number; damage: number; facing: number }
  | { type: 'block'; x: number; y: number; guardBroken: boolean; facing: number }
  | { type: 'parryAttempt'; x: number; y: number }
  | { type: 'parry'; x: number; y: number }
  | { type: 'postureBreak'; x: number; y: number }
  | { type: 'riposte'; x: number; y: number }
  | { type: 'evade'; x: number; y: number }
  | { type: 'death'; faction: Faction; x: number; y: number }
  | { type: 'respawn'; faction: Faction; x: number; y: number }
  | { type: 'reward'; enemyName: string; x: number; y: number; experience: number; gold: number; forgePoints: number }
  | { type: 'lootDrop'; itemId: string; rarity: Rarity; x: number; y: number }
  | { type: 'pickup'; itemId: string; quantity: number; rarity: Rarity; x: number; y: number }
  | { type: 'equip'; weaponId: string };

export class SimEventQueue {
  readonly items: SimEvent[] = [];

  push(event: SimEvent): void {
    // Cap the backlog so an unconsumed queue (e.g. headless tests) cannot grow unbounded.
    if (this.items.length < 256) this.items.push(event);
  }

  drain(handler: (event: SimEvent) => void): void {
    for (const e of this.items) handler(e);
    this.items.length = 0;
  }
}
