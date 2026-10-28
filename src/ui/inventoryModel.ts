import { getItem, type Rarity } from '../data/items';
import { getWeapon } from '../data/weapons';
import type { PlayerProfile } from '../rpg/Profile';
import type { EquipResult } from '../world/Simulation';

export interface WeaponRow {
  uid: number;
  name: string;
  rarity: Rarity;
  category: string;
  upgradeLevel: number;
  equipped: boolean;
  description: string;
}

export interface MaterialRow {
  name: string;
  quantity: number;
}

/** Plain data for the inventory panel; DOM-free so it can be tested. */
export function inventoryRows(profile: PlayerProfile): { weapons: WeaponRow[]; materials: MaterialRow[] } {
  const weapons: WeaponRow[] = [];
  const materials: MaterialRow[] = [];
  for (const instance of profile.inventory.all) {
    const def = getItem(instance.itemId);
    if (def.kind === 'weapon') {
      const weapon = getWeapon(def.weaponId!);
      weapons.push({
        uid: instance.uid,
        name: def.name,
        rarity: def.rarity,
        category: weapon.category === 'scythe' ? 'Scythe' : 'Straight sword',
        upgradeLevel: instance.upgradeLevel,
        equipped: instance.uid === profile.equippedWeaponUid,
        description: def.description,
      });
    } else {
      materials.push({ name: def.name, quantity: instance.quantity });
    }
  }
  return { weapons, materials };
}

export function equipMessage(result: EquipResult, name: string): string {
  if (result === 'equipped') return `Equipped ${name}.`;
  if (result === 'busy') return 'Finish your current action before changing weapons.';
  return 'That item cannot be equipped.';
}
