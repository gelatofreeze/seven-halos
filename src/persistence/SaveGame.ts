import { ITEMS } from '../data/items';
import type { ItemInstance } from '../inventory/Inventory';
import type { PlayerProfile } from '../rpg/Profile';
import type { StorageAdapter } from './Storage';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'seven-halos.save';
/** Unreadable saves are moved here instead of being silently destroyed. */
export const CORRUPT_BACKUP_KEY = 'seven-halos.save.corrupt';

/**
 * Save format v1: only the persistent profile. Combat state (attacks in
 * progress, enemies, pickups lying in the world) is never saved, so a reload
 * can't duplicate items or replay rewards.
 */
export interface SaveDataV1 {
  version: 1;
  savedAt: string;
  currencies: { experience: number; gold: number; forgePoints: number };
  inventory: { nextUid: number; items: ItemInstance[] };
  equippedWeaponUid: number;
}

export type LoadStatus = 'new' | 'loaded' | 'corrupt' | 'unsupported-version';

export function serializeProfile(profile: PlayerProfile, now = new Date()): SaveDataV1 {
  const w = profile.wallet;
  return {
    version: SAVE_VERSION,
    savedAt: now.toISOString(),
    currencies: { experience: w.experience, gold: w.gold, forgePoints: w.forgePoints },
    inventory: { nextUid: profile.inventory.nextId, items: profile.inventory.all.map((i) => ({ ...i })) },
    equippedWeaponUid: profile.equippedWeaponUid,
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const wholeNumber = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/**
 * Older formats are upgraded here, one version at a time. There is only v1 so
 * far; a future v2 adds `1: (v1) => v2`.
 */
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {};

/**
 * Validate untrusted save data and apply it to `profile`. Unknown items are
 * dropped, numbers are clamped, and the starter weapon is guaranteed.
 * Returns the outcome; on failure the profile is left as a fresh profile.
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
  let record: Record<string, unknown> = data;
  for (let v = record.version as number; v < SAVE_VERSION; v++) {
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
    items.push({ uid, itemId: it.itemId, quantity: def.stackable ? Math.max(1, wholeNumber(it.quantity)) : 1, upgradeLevel: wholeNumber(it.upgradeLevel) });
  }

  profile.wallet.set({ experience: wholeNumber(currencies.experience), gold: wholeNumber(currencies.gold), forgePoints: wholeNumber(currencies.forgePoints) });
  profile.inventory.restore(items, wholeNumber(inventory.nextUid));
  profile.equippedWeaponUid = wholeNumber(record.equippedWeaponUid);
  profile.ensureStarterWeapon();
  return 'loaded';
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
    }
    this.savedRevision = this.status === 'loaded' ? this.profile.revision : -1;
    return this.status;
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
