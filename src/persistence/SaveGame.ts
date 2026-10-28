import { WEAPON_XP } from '../config/progression';
import { SLOT_IDS, type SlotId } from '../data/equipmentSlots';
import { ITEMS } from '../data/items';
import { getWeapon } from '../data/weapons';
import { fitsSlot } from '../rpg/Loadout';
import type { ItemInstance } from '../inventory/Inventory';
import type { PlayerProfile } from '../rpg/Profile';
import type { StorageAdapter } from './Storage';

export const SAVE_VERSION = 2;
export const SAVE_KEY = 'seven-halos.save';
/** Unreadable saves are moved here instead of being silently destroyed. */
export const CORRUPT_BACKUP_KEY = 'seven-halos.save.corrupt';
/** Before a migration overwrites a save, the original is copied here (e.g. `seven-halos.save.v1-backup`). */
export const migrationBackupKey = (fromVersion: number): string => `${SAVE_KEY}.v${fromVersion}-backup`;

/** Save format v1 (update 2B), kept for the migration and its tests. */
export interface SaveDataV1 {
  version: 1;
  savedAt: string;
  currencies: { experience: number; gold: number; forgePoints: number };
  inventory: { nextUid: number; items: ItemInstance[] };
  equippedWeaponUid: number;
}

/**
 * Save format v2: only the persistent profile. Combat state (attacks in
 * progress, enemies, pickups lying in the world) is never saved, so a reload
 * can't duplicate items or replay rewards. Inventory order is the player's
 * backpack arrangement; `equipment` maps slot ids to instance uids.
 */
export interface SaveDataV2 {
  version: 2;
  savedAt: string;
  currencies: { experience: number; gold: number; weaponXp: number };
  inventory: { nextUid: number; items: ItemInstance[] };
  equipment: Partial<Record<SlotId, number>>;
}

export type LoadStatus = 'new' | 'loaded' | 'migrated' | 'corrupt' | 'unsupported-version';

export function serializeProfile(profile: PlayerProfile, now = new Date()): SaveDataV2 {
  const w = profile.wallet;
  const equipment: Partial<Record<SlotId, number>> = {};
  for (const [slot, uid] of profile.loadout.entries()) equipment[slot] = uid;
  return {
    version: SAVE_VERSION,
    savedAt: now.toISOString(),
    currencies: { experience: w.experience, gold: w.gold, weaponXp: w.weaponXp },
    inventory: { nextUid: profile.inventory.nextId, items: profile.inventory.all.map((i) => ({ ...i })) },
    equipment,
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const wholeNumber = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/**
 * Older formats are upgraded here, one version at a time. Each migration is
 * pure (input untouched) and deterministic.
 */
export const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {
  /**
   * v1 → v2: Forge Points become Weapon XP at `WEAPON_XP.forgePointRate`
   * (1 FP = 10 WXP); the single equipped weapon becomes the main-hand slot.
   * Items, their uids, order, quantities and upgrade tiers are kept as-is.
   */
  1: (v1) => {
    const currencies = isRecord(v1.currencies) ? v1.currencies : {};
    const inventory = isRecord(v1.inventory) ? v1.inventory : {};
    return {
      version: 2,
      savedAt: v1.savedAt,
      currencies: {
        experience: currencies.experience,
        gold: currencies.gold,
        weaponXp: wholeNumber(currencies.forgePoints) * WEAPON_XP.forgePointRate,
      },
      inventory: { nextUid: inventory.nextUid, items: Array.isArray(inventory.items) ? inventory.items.map((i) => (isRecord(i) ? { ...i } : i)) : [] },
      equipment: { mainHand: v1.equippedWeaponUid },
    };
  },
};

/**
 * Validate untrusted save data and apply it to `profile`. Older versions are
 * migrated first ('migrated'). Unknown items are dropped, numbers are
 * clamped, equipment must reference owned, compatible instances, and the
 * starter weapon is guaranteed. On failure the profile is left fresh.
 */
export function applySave(raw: string | null, profile: PlayerProfile): LoadStatus {
  if (raw === null) return 'new';
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return 'corrupt';
  }
  if (!isRecord(data) || typeof data.version !== 'number' || !Number.isInteger(data.version) || data.version < 1) return 'corrupt';
  if (data.version > SAVE_VERSION) return 'unsupported-version';
  const fromVersion = data.version;
  let record: Record<string, unknown> = data;
  for (let v = fromVersion; v < SAVE_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    if (!migrate) return 'corrupt';
    record = migrate(record);
  }

  const currencies = isRecord(record.currencies) ? record.currencies : {};
  const inventory = isRecord(record.inventory) ? record.inventory : {};
  const rawItems = Array.isArray(inventory.items) ? inventory.items : [];
  const seen = new Set<number>();
  const items: ItemInstance[] = [];
  for (const it of rawItems) {
    if (!isRecord(it) || typeof it.itemId !== 'string' || !ITEMS[it.itemId]) continue;
    const uid = wholeNumber(it.uid);
    if (uid === 0 || seen.has(uid)) continue;
    seen.add(uid);
    const def = ITEMS[it.itemId]!;
    const maxLevel = def.weaponId ? getWeapon(def.weaponId).upgrade.maxLevel : 0;
    items.push({ uid, itemId: it.itemId, quantity: def.stackable ? Math.max(1, wholeNumber(it.quantity)) : 1, upgradeLevel: Math.min(maxLevel, wholeNumber(it.upgradeLevel)) });
  }

  profile.wallet.set({ experience: wholeNumber(currencies.experience), gold: wholeNumber(currencies.gold), weaponXp: wholeNumber(currencies.weaponXp) });
  profile.inventory.restore(items, wholeNumber(inventory.nextUid));
  profile.loadout.clear();
  const equipment = isRecord(record.equipment) ? record.equipment : {};
  for (const slot of SLOT_IDS) {
    const uid = wholeNumber(equipment[slot]);
    const instance = uid ? profile.inventory.find(uid) : undefined;
    if (instance && fitsSlot(instance.itemId, slot) && !profile.loadout.isEquipped(uid)) profile.loadout.set(slot, uid);
  }
  profile.ensureStarterWeapon();
  return fromVersion < SAVE_VERSION ? 'migrated' : 'loaded';
}

/**
 * Loads once at startup and saves whenever the profile's revision changes
 * (rate-limited by the caller). Unsupported (newer) saves are never
 * overwritten; corrupt saves are backed up before a fresh profile replaces them.
 */
export class SaveManager {
  status: LoadStatus = 'new';
  /** False when saving is disabled to protect a save this build can't read. */
  canSave = true;
  /** After a migration: whether the original save was backed up first. */
  migrationBackedUp = false;
  private savedRevision = -1;

  constructor(
    private readonly storage: StorageAdapter,
    private readonly profile: PlayerProfile,
  ) {}

  load(): LoadStatus {
    let raw: string | null = null;
    try {
      raw = this.storage.load(SAVE_KEY);
    } catch {
      raw = null;
    }
    this.status = applySave(raw, this.profile);
    if (this.status === 'corrupt') {
      this.profile.reset();
      try {
        if (raw !== null) this.storage.save(CORRUPT_BACKUP_KEY, raw);
      } catch {
        // Backup is best-effort.
      }
    } else if (this.status === 'unsupported-version') {
      this.profile.reset();
      this.canSave = false;
    } else if (this.status === 'migrated') {
      this.migrationBackedUp = this.backUpOriginal(raw!);
      // Without a backup, never overwrite the only copy of the old save.
      if (!this.migrationBackedUp) this.canSave = false;
    }
    // A migrated save is rewritten in the new format straight away (so it migrates only once).
    this.savedRevision = this.status === 'loaded' ? this.profile.revision : -1;
    if (this.status === 'migrated') this.saveIfChanged();
    return this.status;
  }

  /** Copy the pre-migration save aside; an earlier backup of the same version is kept. */
  private backUpOriginal(raw: string): boolean {
    try {
      const version = (JSON.parse(raw) as { version: number }).version;
      const key = migrationBackupKey(version);
      if (this.storage.load(key) === null) this.storage.save(key, raw);
      return this.storage.load(key) !== null;
    } catch {
      return false;
    }
  }

  /** Save if anything changed since the last save. Returns true if a save happened. */
  saveIfChanged(): boolean {
    if (!this.canSave || this.profile.revision === this.savedRevision) return false;
    try {
      this.storage.save(SAVE_KEY, JSON.stringify(serializeProfile(this.profile)));
      this.savedRevision = this.profile.revision;
      return true;
    } catch {
      return false;
    }
  }

  /** Development reset: wipe the save and start a fresh profile. */
  reset(): void {
    try {
      this.storage.remove(SAVE_KEY);
    } catch {
      // ignore
    }
    this.profile.reset();
    this.canSave = true;
    this.savedRevision = -1;
    this.saveIfChanged();
  }
}
