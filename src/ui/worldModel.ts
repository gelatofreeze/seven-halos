import { getItem } from '../data/items';
import type { WorldObject } from '../world/Level';
import { allCheckpoints } from '../world/regions';
import type { WorldProgress } from '../world/WorldProgress';

/** The contextual action shown for the object the player stands at. DOM-free, tested. */
export function promptLabel(focus: WorldObject | null, progress: WorldProgress): string | null {
  if (!focus) return null;
  if (focus.kind === 'checkpoint') return progress.isActive(focus.id) ? `Rest · ${focus.name}` : `Light the shrine`;
  if (focus.kind === 'cache') {
    if (progress.hasFlag(focus.id)) return null;
    // A relic shows what it is: one treasure set out to be taken.
    const first = focus.reward.items?.[0];
    return focus.look === 'relic' && first ? `Take · ${getItem(first.item).name}` : 'Open the cache';
  }
  if (focus.kind === 'npc') return `Talk · ${focus.name}`;
  if (focus.kind === 'lore') return 'Read';
  return focus.interact ? focus.label : null;
}

export interface TravelDestination {
  id: string;
  name: string;
  regionName: string;
  here: boolean;
}

/** Fast-travel list: activated shrines only, in world order. */
export function travelDestinations(progress: WorldProgress, currentShrine: string): TravelDestination[] {
  return allCheckpoints()
    .filter((c) => progress.isActive(c.id))
    .map((c) => ({ id: c.id, name: c.name, regionName: c.regionName, here: c.id === currentShrine }));
}

export function cacheMessage(items: readonly { item: string; quantity: number }[], gold: number, itemName: (id: string) => string): string {
  const parts = items.map((i) => `${itemName(i.item)}${i.quantity > 1 ? ` × ${i.quantity}` : ''}`);
  if (gold > 0) parts.push(`${gold} Gold`);
  const equippable = items.some((i) => getItem(i.item).equip?.length);
  return `Found ${parts.join(' · ') || 'nothing'}${equippable ? '  —  open MENU to equip' : ''}`;
}
