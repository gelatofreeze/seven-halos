import { getItem } from '../data/items';
import { Inventory, type ItemInstance } from '../inventory/Inventory';
import { Wallet } from './Wallet';

export const STARTING_WEAPON = 'pilgrim-sword';

/**
 * Everything about the player that persists between sessions: currencies,
 * owned items and the equipped weapon. Combat state is never part of it.
 * `revision` increases on every change so persistence can save lazily.
 */
export class PlayerProfile {
  readonly wallet = new Wallet();
  readonly inventory = new Inventory();
  equippedWeaponUid = 0;
  revision = 0;

  constructor() {
    this.ensureStarterWeapon();
  }

  /** Guarantee the player always owns and wields at least the starting weapon. */
  ensureStarterWeapon(): void {
    if (this.inventory.weapons().length === 0) this.inventory.add(STARTING_WEAPON);
    if (!this.equippedWeapon()) this.equippedWeaponUid = this.inventory.weapons()[0]!.uid;
  }

  equippedWeapon(): ItemInstance | undefined {
    const instance = this.inventory.find(this.equippedWeaponUid);
    return instance && getItem(instance.itemId).kind === 'weapon' ? instance : undefined;
  }

  /** The weapon definition id to equip on the player. */
  equippedWeaponId(): string {
    const instance = this.equippedWeapon();
    return getItem(instance?.itemId ?? STARTING_WEAPON).weaponId ?? STARTING_WEAPON;
  }

  touch(): void {
    this.revision++;
  }

  reset(): void {
    this.wallet.set({ experience: 0, gold: 0, forgePoints: 0 });
    this.inventory.clear();
    this.equippedWeaponUid = 0;
    this.ensureStarterWeapon();
    this.touch();
  }
}
