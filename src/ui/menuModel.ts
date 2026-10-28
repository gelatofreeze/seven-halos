import { EQUIPMENT_SLOTS, getSlot, type SlotDefinition, type SlotId } from '../data/equipmentSlots';
import { getItem, type ItemKind, type Rarity } from '../data/items';
import { getWeapon } from '../data/weapons';
import { checkEquip, slotsFor, type EquipCheck } from '../rpg/Loadout';
import type { PlayerProfile } from '../rpg/Profile';
import { quoteUpgrade, upgradeFailureMessage, type UpgradeQuote, type UpgradeResult } from '../rpg/WeaponUpgrades';
import { compareStats, LOWER_IS_BETTER, WEAPON_STAT_LABELS, weaponStats, type WeaponStats } from '../rpg/weaponStats';
import type { EquipResult } from '../world/Simulation';

/**
 * Plain data for the pause menu, derived from the profile. DOM-free so the
 * menu's content and rules are unit-tested; PauseMenu.ts only draws it.
 */
export interface CellView {
  uid: number;
  itemId: string;
  name: string;
  rarity: Rarity;
  kind: ItemKind;
  quantity: number;
  tier: number;
  maxTier: number;
  equippedIn: SlotId | null;
  /** Placeholder glyph until item art exists. */
  icon: string;
}

export interface SlotView {
  slot: SlotDefinition;
  item: CellView | null;
}

export interface StatRow {
  key: keyof WeaponStats;
  label: string;
  value: number;
  /** Difference against the equipped weapon (absent when this is the equipped one). */
  delta?: number;
  verdict?: 'better' | 'worse' | 'same';
}

export interface EquipAction {
  slot: SlotId;
  label: string;
  state: 'equipped' | EquipCheck;
}

export interface DetailsView {
  cell: CellView;
  description: string;
  category: string;
  stats: StatRow[] | null;
  /** Name of the weapon the deltas compare against. */
  comparedWith: string | null;
  actions: EquipAction[];
}

const CATEGORY_LABEL: Record<string, string> = { 'straight-sword': 'Straight sword', scythe: 'Scythe' };
const CATEGORY_ICON: Record<string, string> = { 'straight-sword': '†', scythe: '☾' };

export function iconFor(itemId: string): string {
  const def = getItem(itemId);
  if (def.weaponId) return CATEGORY_ICON[getWeapon(def.weaponId).category] ?? '⚔';
  return def.kind === 'material' ? '∴' : '◆';
}

export function cellFor(profile: PlayerProfile, uid: number): CellView | null {
  const instance = profile.inventory.find(uid);
  if (!instance) return null;
  const def = getItem(instance.itemId);
  return {
    uid,
    itemId: def.id,
    name: def.name,
    rarity: def.rarity,
    kind: def.kind,
    quantity: instance.quantity,
    tier: instance.upgradeLevel,
    maxTier: def.weaponId ? getWeapon(def.weaponId).upgrade.maxLevel : 0,
    equippedIn: profile.loadout.slotOf(uid),
    icon: iconFor(def.id),
  };
}

/** Every owned instance, in the player's backpack order. */
export function backpackCells(profile: PlayerProfile): CellView[] {
  return profile.inventory.all.map((i) => cellFor(profile, i.uid)!);
}

export function equipmentSlots(profile: PlayerProfile): SlotView[] {
  return EQUIPMENT_SLOTS.map((slot) => {
    const uid = profile.loadout.get(slot.id);
    return { slot, item: uid ? cellFor(profile, uid) : null };
  });
}

/** Slots the instance could be dropped into right now (for drag highlights and tap-to-equip). */
export function validTargets(profile: PlayerProfile, uid: number): SlotId[] {
  const instance = profile.inventory.find(uid);
  if (!instance) return [];
  return slotsFor(instance.itemId).filter((s) => profile.loadout.get(s) === uid || checkEquip(profile.inventory, profile.loadout, uid, s) === 'ok');
}

export function itemDetails(profile: PlayerProfile, uid: number): DetailsView | null {
  const cell = cellFor(profile, uid);
  if (!cell) return null;
  const def = getItem(cell.itemId);
  let stats: StatRow[] | null = null;
  let comparedWith: string | null = null;
  if (def.weaponId) {
    const mine = weaponStats(def.weaponId, cell.tier);
    const equipped = profile.equippedWeapon();
    const compare = equipped && equipped.uid !== uid ? weaponStats(getItem(equipped.itemId).weaponId!, equipped.upgradeLevel) : null;
    const diff = compare ? compareStats(mine, compare) : null;
    if (compare) comparedWith = `${getItem(equipped!.itemId).name}${equipped!.upgradeLevel ? ` +${equipped!.upgradeLevel}` : ''}`;
    stats = (Object.keys(WEAPON_STAT_LABELS) as (keyof WeaponStats)[]).map((key) => {
      const row: StatRow = { key, label: WEAPON_STAT_LABELS[key], value: mine[key] };
      if (diff) {
        const d = diff[key];
        row.delta = d;
        const good = LOWER_IS_BETTER.has(key) ? d < 0 : d > 0;
        row.verdict = d === 0 ? 'same' : good ? 'better' : 'worse';
      }
      return row;
    });
  }
  const actions: EquipAction[] = slotsFor(cell.itemId).map((slot) => ({
    slot,
    label: getSlot(slot).label,
    state: profile.loadout.get(slot) === uid ? 'equipped' : checkEquip(profile.inventory, profile.loadout, uid, slot),
  }));
  const category = def.weaponId ? (CATEGORY_LABEL[getWeapon(def.weaponId).category] ?? 'Weapon') : def.kind === 'material' ? 'Material' : 'Item';
  return { cell, description: def.description, category, stats, comparedWith, actions };
}

export interface ProgressionView {
  characterXp: number;
  weaponXp: number;
  gold: number;
  /** Upgrade offer for the selected weapon (or the equipped one when a non-weapon is selected). */
  upgrade: UpgradeQuote | null;
}

export function progression(profile: PlayerProfile, selectedUid: number): ProgressionView {
  const w = profile.wallet;
  const upgrade = quoteUpgrade(profile, selectedUid) ?? quoteUpgrade(profile, profile.equippedWeaponUid);
  return { characterXp: w.experience, weaponXp: w.weaponXp, gold: w.gold, upgrade };
}

export function equipMessage(result: EquipResult, name: string, slot: SlotId = 'mainHand'): string {
  const where = getSlot(slot).label.toLowerCase();
  switch (result) {
    case 'equipped':
      return `Equipped ${name}.`;
    case 'busy':
      return 'Finish your current action before changing weapons.';
    case 'incompatible':
      return `${name} can't go in the ${where} slot.`;
    case 'blocked-by-two-handed':
      return 'Your main-hand weapon needs both hands.';
    case 'required':
      return 'Your main hand always holds a weapon. Equip another weapon instead.';
    default:
      return 'That item cannot be equipped.';
  }
}

export function upgradeMessage(result: UpgradeResult, name: string): string {
  return result.ok ? `${name} upgraded to +${result.level} (−${result.cost} WXP).` : upgradeFailureMessage(result.reason);
}
