import { getItem, ITEMS, type ItemDefinition } from '../data/items';

/** An owned copy of an item. Stackable items keep one instance with a quantity. */
export interface ItemInstance {
  /** Unique, never reused id; equipment refers to instances by uid. */
  uid: number;
  itemId: string;
  quantity: number;
  /** Upgrade tier (weapons). */
  upgradeLevel: number;
}

/**
 * The player's possessions. Separates item definitions (`ITEMS`) from owned
 * instances so weapons can later carry per-copy upgrades, infusions, etc.
 */
export class Inventory {
  private readonly items: ItemInstance[] = [];
  private nextUid = 1;

  get all(): readonly ItemInstance[] {
    return this.items;
  }

  get nextId(): number {
    return this.nextUid;
  }

  /** Add an item; stacks onto an existing instance when stackable. Returns the instance. */
  add(itemId: string, quantity = 1): ItemInstance {
    const def = getItem(itemId);
    const count = Math.max(1, Math.floor(quantity));
    if (def.stackable) {
      const existing = this.items.find((i) => i.itemId === itemId);
      if (existing) {
        existing.quantity += count;
        return existing;
      }
    }
    const instance: ItemInstance = { uid: this.nextUid++, itemId, quantity: def.stackable ? count : 1, upgradeLevel: 0 };
    this.items.push(instance);
    // Non-stackable items with quantity > 1 become separate instances.
    if (!def.stackable) for (let i = 1; i < count; i++) this.items.push({ uid: this.nextUid++, itemId, quantity: 1, upgradeLevel: 0 });
    return instance;
  }

  find(uid: number): ItemInstance | undefined {
    return this.items.find((i) => i.uid === uid);
  }

  owns(itemId: string): boolean {
    return this.items.some((i) => i.itemId === itemId);
  }

  count(itemId: string): number {
    let n = 0;
    for (const i of this.items) if (i.itemId === itemId) n += i.quantity;
    return n;
  }

  weapons(): ItemInstance[] {
    return this.items.filter((i) => ITEMS[i.itemId]?.kind === 'weapon');
  }

  definitionOf(instance: ItemInstance): ItemDefinition {
    return getItem(instance.itemId);
  }

  /** Position of an instance in the backpack order, or -1. */
  indexOf(uid: number): number {
    return this.items.findIndex((i) => i.uid === uid);
  }

  /**
   * Move an instance to `toIndex` in the backpack order (clamped). The order
   * is the player's arrangement and is saved. Returns false if not owned.
   */
  move(uid: number, toIndex: number): boolean {
    const from = this.indexOf(uid);
    if (from < 0) return false;
    const to = Math.max(0, Math.min(this.items.length - 1, Math.floor(toIndex)));
    if (to === from) return true;
    const [instance] = this.items.splice(from, 1);
    this.items.splice(to, 0, instance!);
    return true;
  }

  /** Replace contents from validated save data. */
  restore(items: readonly ItemInstance[], nextUid: number): void {
    this.items.length = 0;
    for (const i of items) this.items.push({ ...i });
    const maxUid = items.reduce((m, i) => Math.max(m, i.uid), 0);
    this.nextUid = Math.max(nextUid, maxUid + 1);
  }

  clear(): void {
    this.items.length = 0;
    this.nextUid = 1;
  }
}
