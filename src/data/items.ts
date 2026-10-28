/**
 * Item definitions (what an item *is*). Owned copies are `ItemInstance`s in
 * the inventory. New kinds (armor, shields, accessories, consumables) slot in
 * as further `kind` values without changing the inventory.
 */
export type ItemKind = 'weapon' | 'material';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

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
}

export const ITEMS: Record<string, ItemDefinition> = {
  'pilgrim-sword': {
    id: 'pilgrim-sword',
    name: "Pilgrim's Sword",
    kind: 'weapon',
    rarity: 'common',
    stackable: false,
    weaponId: 'pilgrim-sword',
    description: 'A plain straight sword. Quick, honest and dependable.',
  },
  'mourning-crescent': {
    id: 'mourning-crescent',
    name: 'Mourning Crescent',
    kind: 'weapon',
    rarity: 'rare',
    stackable: false,
    weaponId: 'mourning-crescent',
    description: 'A barrow reaper’s scythe. Wide, sweeping reach; slow to recover when it misses.',
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
