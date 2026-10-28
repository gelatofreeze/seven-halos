import { EQUIPMENT_SLOTS, getSlot, type SlotId } from '../data/equipmentSlots';
import { ITEMS } from '../data/items';
import type { Inventory } from '../inventory/Inventory';

export type EquipCheck = 'ok' | 'not-owned' | 'incompatible' | 'blocked-by-two-handed' | 'required';

/**
 * Which owned instance (by uid) sits in each equipment slot. Tracks exact
 * instances, so two copies of the same weapon stay distinct. The rules below
 * are pure domain logic: the menu only calls them, it never decides itself.
 */
export class Loadout {
  private readonly slots = new Map<SlotId, number>();

  /** uid in `slot`, or 0 when empty. */
  get(slot: SlotId): number {
    return this.slots.get(slot) ?? 0;
  }

  slotOf(uid: number): SlotId | null {
    for (const [slot, u] of this.slots) if (u === uid) return slot;
    return null;
  }

  isEquipped(uid: number): boolean {
    return this.slotOf(uid) !== null;
  }

  /** Low-level write, no validation (use `equipInto` for player actions). */
  set(slot: SlotId, uid: number): void {
    if (uid > 0) this.slots.set(slot, uid);
    else this.slots.delete(slot);
  }

  entries(): [SlotId, number][] {
    return EQUIPMENT_SLOTS.filter((s) => this.slots.has(s.id)).map((s) => [s.id, this.slots.get(s.id)!]);
  }

  clear(): void {
    this.slots.clear();
  }
}

/** Can the item with `itemId` go in `slot` at all (ignoring what else is equipped)? */
export function fitsSlot(itemId: string, slot: SlotId): boolean {
  const def = ITEMS[itemId];
  return !!def?.equip?.includes(getSlot(slot).accepts);
}

/** Slots an item fits, in menu order. */
export function slotsFor(itemId: string): SlotId[] {
  return EQUIPMENT_SLOTS.filter((s) => fitsSlot(itemId, s.id)).map((s) => s.id);
}

function isTwoHanded(inventory: Inventory, uid: number): boolean {
  const instance = inventory.find(uid);
  return !!instance && ITEMS[instance.itemId]?.twoHanded === true;
}

/** Validate putting instance `uid` into `slot` without changing anything. */
export function checkEquip(inventory: Inventory, loadout: Loadout, uid: number, slot: SlotId): EquipCheck {
  const instance = inventory.find(uid);
  if (!instance) return 'not-owned';
  if (!fitsSlot(instance.itemId, slot)) return 'incompatible';
  if (slot === 'offHand' && isTwoHanded(inventory, loadout.get('mainHand'))) return 'blocked-by-two-handed';
  const from = loadout.slotOf(uid);
  if (from && from !== slot && getSlot(from).required) {
    // Leaving a required slot is only allowed if the displaced item can take its place.
    const displaced = loadout.get(slot);
    const displacedInstance = displaced ? inventory.find(displaced) : undefined;
    if (!displacedInstance || !fitsSlot(displacedInstance.itemId, from)) return 'required';
  }
  return 'ok';
}

/**
 * Put instance `uid` into `slot`. If it was in another slot, the two swap
 * (or that slot empties). A two-handed main-hand item clears the off hand.
 * Nothing changes unless the result is 'ok'.
 */
export function equipInto(inventory: Inventory, loadout: Loadout, uid: number, slot: SlotId): EquipCheck {
  const check = checkEquip(inventory, loadout, uid, slot);
  if (check !== 'ok') return check;
  const from = loadout.slotOf(uid);
  const displaced = loadout.get(slot);
  loadout.set(slot, uid);
  if (from && from !== slot) {
    const d = displaced ? inventory.find(displaced) : undefined;
    loadout.set(from, d && fitsSlot(d.itemId, from) ? displaced : 0);
  }
  if (slot === 'mainHand' && isTwoHanded(inventory, uid)) loadout.set('offHand', 0);
  return 'ok';
}

/** Empty a slot; required slots (the main hand) can't be emptied. */
export function unequipSlot(loadout: Loadout, slot: SlotId): 'ok' | 'required' | 'empty' {
  if (loadout.get(slot) === 0) return 'empty';
  if (getSlot(slot).required) return 'required';
  loadout.set(slot, 0);
  return 'ok';
}
