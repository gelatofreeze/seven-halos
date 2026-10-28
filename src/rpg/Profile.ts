import { getItem } from '../data/items';
import { Inventory, type ItemInstance } from '../inventory/Inventory';
import { WorldProgress } from '../world/WorldProgress';
import { Loadout } from './Loadout';
import { QuestLog } from './Quests';
import { Wallet } from './Wallet';

export const STARTING_WEAPON = 'pilgrim-sword';

/**
 * Everything about the player that persists between sessions: currencies,
 * owned items (in backpack order), the equipment loadout and world progress. Combat state is
 * never part of it. `revision` increases on every change so persistence can
 * save lazily.
 */
export class PlayerProfile {
  readonly wallet = new Wallet();
  readonly inventory = new Inventory();
  readonly loadout = new Loadout();
  /** Shrines, flags and where to resume (saved). */
  readonly world = new WorldProgress();
  /** Quest progress (saved). */
  readonly quests = new QuestLog();
  /** Lore entries the player has read (saved; rereadable in the journal). */
  readonly lore = new Set<string>();
  revision = 0;

  constructor() {
    this.ensureStarterWeapon();
  }

  /** The main-hand weapon instance's uid. */
  get equippedWeaponUid(): number {
    return this.loadout.get('mainHand');
  }

  set equippedWeaponUid(uid: number) {
    this.loadout.set('mainHand', uid);
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
    this.wallet.set({ experience: 0, gold: 0, weaponXp: 0 });
    this.inventory.clear();
    this.loadout.clear();
    this.world.clear();
    this.quests.clear();
    this.lore.clear();
    this.ensureStarterWeapon();
    this.touch();
  }
}
