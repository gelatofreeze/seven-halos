import { weaponUpgradeCost } from '../config/progression';
import { getItem } from '../data/items';
import { getWeapon } from '../data/weapons';
import type { PlayerProfile } from './Profile';
import { weaponStats, type WeaponStats } from './weaponStats';

export type UpgradeFailure = 'not-owned' | 'not-weapon' | 'max-level' | 'insufficient-wxp' | 'stale';
export type UpgradeResult = { ok: true; level: number; cost: number } | { ok: false; reason: UpgradeFailure };

/** Everything a menu (or, later, a blacksmith) needs to offer an upgrade. */
export interface UpgradeQuote {
  uid: number;
  itemId: string;
  name: string;
  level: number;
  maxLevel: number;
  /** null at max tier. */
  nextLevel: number | null;
  cost: number | null;
  available: number;
  canUpgrade: boolean;
  /** Why it can't be upgraded right now, if it can't. */
  blocked: UpgradeFailure | null;
  current: WeaponStats;
  next: WeaponStats | null;
}

/** Describe the next upgrade of weapon instance `uid`, or null if it isn't an owned weapon. */
export function quoteUpgrade(profile: PlayerProfile, uid: number): UpgradeQuote | null {
  const instance = profile.inventory.find(uid);
  if (!instance) return null;
  const def = getItem(instance.itemId);
  if (def.kind !== 'weapon' || !def.weaponId) return null;
  const weapon = getWeapon(def.weaponId);
  const level = instance.upgradeLevel;
  const maxed = level >= weapon.upgrade.maxLevel;
  const cost = maxed ? null : weaponUpgradeCost(level);
  const available = profile.wallet.weaponXp;
  const blocked: UpgradeFailure | null = maxed ? 'max-level' : available < cost! ? 'insufficient-wxp' : null;
  return {
    uid,
    itemId: instance.itemId,
    name: def.name,
    level,
    maxLevel: weapon.upgrade.maxLevel,
    nextLevel: maxed ? null : level + 1,
    cost,
    available,
    canUpgrade: blocked === null,
    blocked,
    current: weaponStats(def.weaponId, level),
    next: maxed ? null : weaponStats(def.weaponId, level + 1),
  };
}

/**
 * Raise weapon instance `uid` by one tier, paying Weapon XP. Atomic: every
 * check happens before anything changes, and a failure changes nothing.
 * `expectedLevel` is the tier the player saw when they pressed the button; a
 * repeated tap (or a stale screen) no longer matches and is refused, so one
 * press can never pay twice.
 */
export function upgradeWeapon(profile: PlayerProfile, uid: number, expectedLevel: number): UpgradeResult {
  const instance = profile.inventory.find(uid);
  if (!instance) return { ok: false, reason: 'not-owned' };
  const def = getItem(instance.itemId);
  if (def.kind !== 'weapon' || !def.weaponId) return { ok: false, reason: 'not-weapon' };
  if (instance.upgradeLevel !== expectedLevel) return { ok: false, reason: 'stale' };
  const weapon = getWeapon(def.weaponId);
  if (instance.upgradeLevel >= weapon.upgrade.maxLevel) return { ok: false, reason: 'max-level' };
  const cost = weaponUpgradeCost(instance.upgradeLevel);
  if (!profile.wallet.spend('weaponXp', cost)) return { ok: false, reason: 'insufficient-wxp' };
  instance.upgradeLevel++;
  profile.touch();
  return { ok: true, level: instance.upgradeLevel, cost };
}

export function upgradeFailureMessage(reason: UpgradeFailure): string {
  switch (reason) {
    case 'max-level':
      return 'This weapon is already at its highest tier.';
    case 'insufficient-wxp':
      return 'Not enough Weapon XP.';
    case 'stale':
      return 'Already upgraded.';
    default:
      return 'That weapon cannot be upgraded.';
  }
}
