import type { AttackKind, Faction } from '../combat/types';
import type { Rarity } from '../data/items';
import type { QuestChange } from '../rpg/Quests';

/**
 * One-way notifications from the simulation to presentation (sound, particles,
 * camera). Gameplay never depends on whether these are consumed.
 */
export type TravelReason = 'exit' | 'death' | 'rest' | 'travel';

export type SimEvent =
  | { type: 'jump'; x: number; y: number }
  /** An equipment-granted jump in midair (the double jump). */
  | { type: 'airJump'; x: number; y: number; facing: number }
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
  | { type: 'reward'; enemyName: string; x: number; y: number; experience: number; gold: number; weaponXp: number }
  | { type: 'lootDrop'; itemId: string; rarity: Rarity; x: number; y: number }
  | { type: 'pickup'; itemId: string; quantity: number; rarity: Rarity; x: number; y: number }
  | { type: 'equip'; weaponId: string }
  | { type: 'upgrade'; uid: number; itemId: string; level: number; cost: number }
  /** A shrine was activated for the first time. */
  | { type: 'checkpointActivated'; id: string; name: string; x: number; y: number }
  /** The player used a shrine (after activating it): the scene opens the shrine menu. */
  | { type: 'shrine'; id: string; name: string; firstTime: boolean }
  | { type: 'cacheOpened'; id: string; x: number; y: number; items: readonly { item: string; quantity: number }[]; gold: number; weaponXp: number }
  /** The player spoke to an NPC: the scene opens the dialogue panel. */
  | { type: 'talk'; npc: string; dialogue: string; name: string }
  /** The player read something: the scene opens the lore panel. */
  | { type: 'lore'; id: string; firstTime: boolean }
  /** A quest started, advanced or completed. */
  | { type: 'quest'; change: QuestChange }
  /** The simulation asked to leave this region (doorway, death, rest or travel). */
  | { type: 'travel'; reason: TravelReason };

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
