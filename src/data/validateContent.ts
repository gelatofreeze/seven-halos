import type { AttackDefinition } from '../combat/types';
import { EQUIPMENT_SLOTS, type SlotDefinition } from './equipmentSlots';
import { ENEMIES, type EnemyDefinition } from './enemies';
import { ITEMS, RARITY_ORDER, type ItemDefinition } from './items';
import { ATTACKS, WEAPONS, type WeaponDefinition } from './weapons';

/** All gameplay content, injectable so the validator itself can be tested on broken data. */
export interface Content {
  items: Record<string, ItemDefinition>;
  weapons: Record<string, WeaponDefinition>;
  attacks: Record<string, AttackDefinition>;
  enemies: Record<string, EnemyDefinition>;
  slots: readonly SlotDefinition[];
}

export const GAME_CONTENT: Content = { items: ITEMS, weapons: WEAPONS, attacks: ATTACKS, enemies: ENEMIES, slots: EQUIPMENT_SLOTS };

/**
 * Cross-checks content data and returns one readable message per problem
 * (empty = valid). Run by the test suite, so a broken reference fails
 * `npm run check` instead of crashing at runtime.
 */
export function validateContent(c: Content = GAME_CONTENT): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);

  const keyMatchesId = (kind: string, table: Record<string, { id: string }>) => {
    const seen = new Set<string>();
    for (const [key, v] of Object.entries(table)) {
      if (v.id !== key) err(`${kind} "${key}" has id "${v.id}"`);
      if (seen.has(v.id)) err(`duplicate ${kind} id "${v.id}"`);
      seen.add(v.id);
    }
  };
  keyMatchesId('item', c.items);
  keyMatchesId('weapon', c.weapons);
  keyMatchesId('attack', c.attacks);
  keyMatchesId('enemy', c.enemies);

  const slotIds = new Set<string>();
  for (const s of c.slots) {
    if (slotIds.has(s.id)) err(`duplicate slot id "${s.id}"`);
    slotIds.add(s.id);
  }
  const acceptedTypes = new Set(c.slots.map((s) => s.accepts));

  for (const item of Object.values(c.items)) {
    if (!RARITY_ORDER.includes(item.rarity)) err(`item "${item.id}": unknown rarity "${item.rarity}"`);
    for (const t of item.equip ?? []) if (!acceptedTypes.has(t)) err(`item "${item.id}": no slot accepts "${t}"`);
    if (item.kind === 'weapon') {
      if (!item.weaponId || !c.weapons[item.weaponId]) err(`item "${item.id}": missing weapon "${item.weaponId}"`);
      if (!item.equip?.includes('weapon')) err(`item "${item.id}": weapons must be equippable in a weapon slot`);
      if (item.stackable) err(`item "${item.id}": weapons can't stack (each copy has its own tier)`);
    } else if (item.weaponId) err(`item "${item.id}": only weapons may set weaponId`);
    if (item.twoHanded && !item.equip?.includes('weapon')) err(`item "${item.id}": only weapons can be two-handed`);
  }

  const attack = (owner: string, id: string | undefined) => {
    if (!id || !c.attacks[id]) err(`${owner}: missing attack "${id}"`);
  };
  for (const w of Object.values(c.weapons)) {
    attack(`weapon "${w.id}" light`, w.moveset.light);
    attack(`weapon "${w.id}" heavy`, w.moveset.heavy);
    attack(`weapon "${w.id}" riposte`, w.moveset.riposte);
    if (!(w.upgrade.maxLevel >= 0 && Number.isInteger(w.upgrade.maxLevel))) err(`weapon "${w.id}": maxLevel must be a whole number`);
    if (!(w.upgrade.damagePerLevel >= 0)) err(`weapon "${w.id}": damagePerLevel must be ≥ 0`);
    if (!Object.values(c.items).some((i) => i.weaponId === w.id)) err(`weapon "${w.id}": no item equips it`);
  }

  for (const a of Object.values(c.attacks)) {
    if (a.next) attack(`attack "${a.id}" next`, a.next);
    for (const k of ['startupFrames', 'activeFrames', 'recoveryFrames'] as const) {
      if (!(Number.isInteger(a[k]) && a[k] >= 0)) err(`attack "${a.id}": ${k} must be a whole number of frames`);
    }
    if (a.activeFrames < 1) err(`attack "${a.id}": needs at least one active frame`);
    if (a.hitboxes.length === 0) err(`attack "${a.id}": has no hitboxes`);
    // Combo chains must end.
    const seen = new Set<string>();
    for (let id: string | undefined = a.id; id; id = c.attacks[id]?.next) {
      if (seen.has(id)) {
        err(`attack "${a.id}": combo chain loops at "${id}"`);
        break;
      }
      seen.add(id);
    }
  }

  for (const e of Object.values(c.enemies)) {
    if (e.attacks.length === 0) err(`enemy "${e.id}": has no attacks`);
    for (const o of e.attacks) {
      attack(`enemy "${e.id}"`, o.attack);
      if (!(o.weight >= 0)) err(`enemy "${e.id}" attack "${o.attack}": weight must be ≥ 0`);
      if (o.minRange > o.maxRange) err(`enemy "${e.id}" attack "${o.attack}": minRange > maxRange`);
    }
    if (e.attacks.length > 0 && !e.attacks.some((o) => o.weight > 0)) err(`enemy "${e.id}": every attack weight is 0`);
    if (e.retreat && !(e.retreat.chance >= 0 && e.retreat.chance <= 1)) err(`enemy "${e.id}": retreat chance must be within 0..1`);
    for (const [k, v] of Object.entries(e.rewards)) if (!(Number.isInteger(v) && v >= 0)) err(`enemy "${e.id}": reward ${k} must be a whole number ≥ 0`);
    for (const l of e.loot) {
      if (!c.items[l.item]) err(`enemy "${e.id}": loot item "${l.item}" does not exist`);
      if (!(l.chance >= 0 && l.chance <= 1)) err(`enemy "${e.id}": loot "${l.item}" chance ${l.chance} is not a probability`);
      if (l.quantity && !(l.quantity[0] >= 1 && l.quantity[0] <= l.quantity[1])) err(`enemy "${e.id}": loot "${l.item}" quantity range is invalid`);
      if (l.rarity && !RARITY_ORDER.includes(l.rarity)) err(`enemy "${e.id}": loot "${l.item}" rarity "${l.rarity}" is unknown`);
    }
  }
  return errors;
}
