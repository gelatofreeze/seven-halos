import { getItem, type Rarity } from '../data/items';
import type { LootEntry } from '../data/enemies';

export interface LootDrop {
  itemId: string;
  quantity: number;
  rarity: Rarity;
}

export interface LootContext {
  owns(itemId: string): boolean;
}

/**
 * Roll a drop table once. Each entry is an independent roll against
 * `random`, a dedicated seeded stream separate from combat AI randomness, so
 * loot never changes how a fight plays out. Pure: allocates only the result.
 */
export function rollLoot(table: readonly LootEntry[], random: () => number, ctx: LootContext): LootDrop[] {
  const drops: LootDrop[] = [];
  for (const entry of table) {
    // Always consume the same number of random values per entry, so eligibility
    // changes never shift later rolls.
    const roll = random();
    const qtyRoll = random();
    if (entry.condition === 'notOwned' && ctx.owns(entry.item)) continue;
    if (roll >= entry.chance) continue;
    const [min, max] = entry.quantity ?? [1, 1];
    const quantity = min + Math.floor(qtyRoll * (max - min + 1));
    drops.push({ itemId: entry.item, quantity, rarity: entry.rarity ?? getItem(entry.item).rarity });
  }
  return drops;
}
