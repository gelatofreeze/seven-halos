import { getAttack, WEAPONS, type WeaponDefinition } from '../data/weapons';
import type { AttackDefinition } from '../combat/types';

/** What the character has equipped. The combat state machine reads its moveset from here. */
export class Equipment {
  weapon: WeaponDefinition;

  constructor(weaponId: string) {
    this.weapon = Equipment.lookup(weaponId);
  }

  equipWeapon(weaponId: string): void {
    this.weapon = Equipment.lookup(weaponId);
  }

  lightAttack(): AttackDefinition {
    return getAttack(this.weapon.moveset.light);
  }

  private static lookup(id: string): WeaponDefinition {
    const weapon = WEAPONS[id];
    if (!weapon) throw new Error(`Unknown weapon: ${id}`);
    return weapon;
  }
}
