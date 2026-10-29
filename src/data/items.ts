import type { SlotType } from './equipmentSlots';

/**
 * Item definitions (what an item *is*). Owned copies are `ItemInstance`s in
 * the inventory. New kinds (armor, shields, accessories, consumables) slot in
 * as further `kind` values without changing the inventory.
 */
export type ItemKind = 'weapon' | 'material' | 'accessory';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

/**
 * Passive effects an item grants while it is validly equipped (in a
 * functional slot it fits). Typed fields, one per effect: the rules that read
 * them live in rpg/PassiveEffects.ts, never in item-name checks. Future
 * effects (move speed, defence, stamina, wall-climb...) are added here as
 * further optional fields.
 */
export interface PassiveEffects {
  /** Extra jumps the wearer may make in midair before landing again. */
  extraAirJumps?: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  kind: ItemKind;
  rarity: Rarity;
  /** Stackable items share one instance with a quantity. */
  stackable: boolean;
  description: string;
  /** For weapons: the weapon definition this item equips. */
  weaponId?: string;
  /** Slot types this item can be equipped in (see data/equipmentSlots.ts); none = not equippable. */
  equip?: readonly SlotType[];
  /** Occupies the off hand too (none yet; the loadout rules already enforce it). */
  twoHanded?: boolean;
  /** Passive effects while equipped (accessories). */
  effects?: PassiveEffects;
}

export const ITEMS: Record<string, ItemDefinition> = {
  'pilgrim-sword': {
    id: 'pilgrim-sword',
    name: "Pilgrim's Sword",
    kind: 'weapon',
    rarity: 'common',
    stackable: false,
    weaponId: 'pilgrim-sword',
    equip: ['weapon'],
    description: 'A plain straight sword. Quick, honest and dependable.',
  },
  'mourning-crescent': {
    id: 'mourning-crescent',
    name: 'Mourning Crescent',
    kind: 'weapon',
    rarity: 'rare',
    stackable: false,
    weaponId: 'mourning-crescent',
    equip: ['weapon'],
    description: 'A barrow reaper’s scythe. Wide, sweeping reach; slow to recover when it misses.',
  },
  'updraft-ring': {
    id: 'updraft-ring',
    name: 'Updraft Ring',
    kind: 'accessory',
    rarity: 'rare',
    stackable: false,
    equip: ['ring'],
    effects: { extraAirJumps: 1 },
    description: 'A band of pale, wind-worn metal that never quite sits still on the finger. While worn, the air gathers beneath you once more after you leave the ground.',
  },
  'grave-dust': {
    id: 'grave-dust',
    name: 'Grave Dust',
    kind: 'material',
    rarity: 'common',
    stackable: true,
    description: 'Ash of the long-buried. Smiths will want it once the forges are lit again.',
  },
};

export function getItem(id: string): ItemDefinition {
  const item = ITEMS[id];
  if (!item) throw new Error(`Unknown item: ${id}`);
  return item;
}

export const RARITY_ORDER: readonly Rarity[] = ['common', 'uncommon', 'rare', 'legendary'];
