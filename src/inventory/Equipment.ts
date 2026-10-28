import type { AttackDefinition } from '../combat/types';
import { getAttack, getWeapon, type WeaponDefinition } from '../data/weapons';

/**
 * What the character has equipped. The combat state machine reads its
 * moveset from here; the simulation decides *when* equipment may change.
 */
export class Equipment {
  weapon: WeaponDefinition;
  /** Upgrade tier of the equipped weapon instance. */
  upgradeLevel = 0;

  constructor(weaponId: string, upgradeLevel = 0) {
    this.weapon = getWeapon(weaponId);
    this.upgradeLevel = upgradeLevel;
  }

  equipWeapon(weaponId: string, upgradeLevel = 0): void {
    this.weapon = getWeapon(weaponId);
    this.upgradeLevel = Math.max(0, Math.min(this.weapon.upgrade.maxLevel, upgradeLevel));
  }

  /** Outgoing damage multiplier from the weapon's upgrade level. */
  damageMultiplier(): number {
    return 1 + this.weapon.upgrade.damagePerLevel * this.upgradeLevel;
  }

  lightAttack(): AttackDefinition {
    return getAttack(this.weapon.moveset.light);
  }

  heavyAttack(): AttackDefinition {
    return getAttack(this.weapon.moveset.heavy);
  }

  riposteAttack(): AttackDefinition {
    return getAttack(this.weapon.moveset.riposte);
  }
}
