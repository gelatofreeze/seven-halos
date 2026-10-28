import type { Faction } from '../combat/types';

/**
 * One-way notifications from the simulation to presentation (sound, particles,
 * camera). Gameplay never depends on whether these are consumed.
 */
export type SimEvent =
  | { type: 'jump'; x: number; y: number }
  | { type: 'land'; x: number; y: number; hard: boolean }
  | { type: 'dodge'; x: number; y: number; facing: number }
  | { type: 'attack'; faction: Faction; attackId: string; x: number; y: number; facing: number }
  | { type: 'telegraph'; x: number; y: number; facing: number }
  | { type: 'hit'; targetFaction: Faction; x: number; y: number; damage: number; poiseBroken: boolean; facing: number }
  | { type: 'evade'; x: number; y: number }
  | { type: 'death'; faction: Faction; x: number; y: number }
  | { type: 'respawn'; faction: Faction; x: number; y: number };

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
