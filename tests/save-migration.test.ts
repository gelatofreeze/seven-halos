import { describe, expect, it } from 'vitest';
import { WEAPON_XP } from '../src/config/progression';
import { applySave, migrationBackupKey, SAVE_KEY, SAVE_VERSION, SaveManager, serializeProfile, type SaveDataV1 } from '../src/persistence/SaveGame';
import { MemoryStorage, type StorageAdapter } from '../src/persistence/Storage';
import { PlayerProfile } from '../src/rpg/Profile';

/** Exactly what update 2B's `serializeProfile` wrote for a player mid-way through the test chamber. */
const REAL_V1: SaveDataV1 = {
  version: 1,
  savedAt: '2026-10-20T18:42:07.311Z',
  currencies: { experience: 1305, gold: 412, forgePoints: 27 },
  inventory: {
    nextUid: 9,
    items: [
      { uid: 1, itemId: 'pilgrim-sword', quantity: 1, upgradeLevel: 0 },
      { uid: 2, itemId: 'grave-dust', quantity: 14, upgradeLevel: 0 },
      { uid: 5, itemId: 'mourning-crescent', quantity: 1, upgradeLevel: 3 },
      { uid: 8, itemId: 'mourning-crescent', quantity: 1, upgradeLevel: 0 },
    ],
  },
  equippedWeaponUid: 5,
};

/** A brand-new 2B player: starter sword only, nothing earned yet. */
const FRESH_V1: SaveDataV1 = {
  version: 1,
  savedAt: '2026-10-19T09:00:00.000Z',
  currencies: { experience: 0, gold: 0, forgePoints: 0 },
  inventory: { nextUid: 2, items: [{ uid: 1, itemId: 'pilgrim-sword', quantity: 1, upgradeLevel: 0 }] },
  equippedWeaponUid: 1,
};

function loadFrom(raw: string, storage: StorageAdapter = new MemoryStorage()) {
  storage.save(SAVE_KEY, raw);
  const profile = new PlayerProfile();
  const save = new SaveManager(storage, profile);
  const status = save.load();
  return { storage, profile, save, status };
}

describe('Save migration v1 → v2', () => {
  it('converts Forge Points to Weapon XP at the documented rate and keeps all other progress', () => {
    expect(WEAPON_XP.forgePointRate).toBe(10);
    const { profile, status } = loadFrom(JSON.stringify(REAL_V1));
    expect(status).toBe('migrated');
    expect(profile.wallet.weaponXp).toBe(270);
    expect(profile.wallet.experience).toBe(1305);
    expect(profile.wallet.gold).toBe(412);
  });

  it('preserves item uids, order, quantities, per-instance tiers and the equipped instance', () => {
    const { profile } = loadFrom(JSON.stringify(REAL_V1));
    expect(profile.inventory.all.map((i) => [i.uid, i.itemId, i.quantity, i.upgradeLevel])).toEqual([
      [1, 'pilgrim-sword', 1, 0],
      [2, 'grave-dust', 14, 0],
      [5, 'mourning-crescent', 1, 3],
      [8, 'mourning-crescent', 1, 0],
    ]);
    // The +3 copy, not the other scythe.
    expect(profile.equippedWeaponUid).toBe(5);
    expect(profile.loadout.get('mainHand')).toBe(5);
    expect(profile.inventory.add('mourning-crescent').uid).toBe(9);
  });

  it('backs up the original save before replacing it, then writes v2', () => {
    const raw = JSON.stringify(REAL_V1);
    const { storage, save } = loadFrom(raw);
    expect(storage.load(migrationBackupKey(1))).toBe(raw);
    expect(save.migrationBackedUp).toBe(true);
    const stored = JSON.parse(storage.load(SAVE_KEY)!);
    expect(stored.version).toBe(SAVE_VERSION);
    expect(stored.currencies).toEqual({ experience: 1305, gold: 412, weaponXp: 270 });
    expect(stored.equipment).toEqual({ mainHand: 5 });
    expect(JSON.stringify(stored)).not.toMatch(/forge/i);
  });

  it('runs only once: reloading the migrated save loads it as v2 and converts nothing again', () => {
    const { storage } = loadFrom(JSON.stringify(REAL_V1));
    const again = new PlayerProfile();
    expect(new SaveManager(storage, again).load()).toBe('loaded');
    expect(again.wallet.weaponXp).toBe(270);
    // The backup still holds the untouched original.
    expect(JSON.parse(storage.load(migrationBackupKey(1))!).currencies.forgePoints).toBe(27);
  });

  it('is deterministic and does not mutate its input', () => {
    const input = structuredClone(REAL_V1);
    const a = new PlayerProfile();
    const b = new PlayerProfile();
    applySave(JSON.stringify(input), a);
    applySave(JSON.stringify(input), b);
    expect(serializeProfile(a, new Date(0))).toEqual(serializeProfile(b, new Date(0)));
    expect(input).toEqual(REAL_V1);
  });

  it('migrates a fresh v1 profile', () => {
    const { profile, status } = loadFrom(JSON.stringify(FRESH_V1));
    expect(status).toBe('migrated');
    expect(profile.wallet.weaponXp).toBe(0);
    expect(profile.inventory.all).toHaveLength(1);
    expect(profile.equippedWeaponId()).toBe('pilgrim-sword');
  });

  it('keeps an existing backup instead of overwriting it with a later copy', () => {
    const storage = new MemoryStorage();
    storage.save(migrationBackupKey(1), 'earlier original');
    loadFrom(JSON.stringify(REAL_V1), storage);
    expect(storage.load(migrationBackupKey(1))).toBe('earlier original');
  });

  it('never overwrites the old save if the backup cannot be written', () => {
    const raw = JSON.stringify(REAL_V1);
    const storage = new MemoryStorage();
    const failing: StorageAdapter = {
      load: (k) => storage.load(k),
      save: (k, v) => {
        if (k !== SAVE_KEY) throw new Error('quota');
        storage.save(k, v);
      },
      remove: (k) => storage.remove(k),
    };
    const { save, profile } = loadFrom(raw, failing);
    expect(save.migrationBackedUp).toBe(false);
    expect(profile.wallet.weaponXp).toBe(270); // still playable this session
    profile.touch();
    expect(save.saveIfChanged()).toBe(false);
    expect(storage.load(SAVE_KEY)).toBe(raw);
  });

  it('protects saves from newer versions', () => {
    const future = JSON.stringify({ ...REAL_V1, version: SAVE_VERSION + 1 });
    const { storage, status, save } = loadFrom(future);
    expect(status).toBe('unsupported-version');
    expect(save.saveIfChanged()).toBe(false);
    expect(storage.load(SAVE_KEY)).toBe(future);
  });

  it('sanitises a damaged v1 save during migration', () => {
    const damaged = { ...REAL_V1, currencies: { experience: 10, gold: 'x', forgePoints: -4 }, equippedWeaponUid: 2 };
    const { profile, status } = loadFrom(JSON.stringify(damaged));
    expect(status).toBe('migrated');
    expect(profile.wallet.weaponXp).toBe(0);
    expect(profile.wallet.gold).toBe(0);
    // uid 2 is Grave Dust, which can't be wielded: falls back to an owned weapon.
    expect(profile.equippedWeapon()).toBeDefined();
  });
});

describe('Save format v2', () => {
  it('round-trips the backpack order and the loadout', () => {
    const storage = new MemoryStorage();
    const profile = new PlayerProfile();
    const save = new SaveManager(storage, profile);
    save.load();
    const scythe = profile.inventory.add('mourning-crescent');
    const dust = profile.inventory.add('grave-dust', 2);
    profile.inventory.move(dust.uid, 0);
    profile.equippedWeaponUid = scythe.uid;
    profile.touch();
    save.saveIfChanged();
    const again = new PlayerProfile();
    expect(new SaveManager(storage, again).load()).toBe('loaded');
    expect(again.inventory.all.map((i) => i.uid)).toEqual(profile.inventory.all.map((i) => i.uid));
    expect(again.loadout.get('mainHand')).toBe(scythe.uid);
  });

  it('drops equipment that references missing or incompatible items', () => {
    const profile = new PlayerProfile();
    applySave(
      JSON.stringify({
        version: 2,
        currencies: { experience: 0, gold: 0, weaponXp: 50 },
        inventory: { nextUid: 4, items: [{ uid: 1, itemId: 'pilgrim-sword', quantity: 1, upgradeLevel: 99 }, { uid: 3, itemId: 'grave-dust', quantity: 2, upgradeLevel: 0 }] },
        equipment: { mainHand: 1, ring1: 3, head: 77, bogus: 1 },
      }),
      profile,
    );
    expect(profile.loadout.entries()).toEqual([['mainHand', 1]]);
    // Tiers are clamped to the weapon's maximum.
    expect(profile.inventory.find(1)!.upgradeLevel).toBe(10);
    expect(profile.wallet.weaponXp).toBe(50);
  });
});

/** Exactly what update 2B.2's `serializeProfile` wrote (save v2), mid-game. */
const REAL_V2 = {
  version: 2,
  savedAt: '2026-10-28T20:31:12.004Z',
  currencies: { experience: 2210, gold: 498, weaponXp: 115 },
  inventory: {
    nextUid: 11,
    items: [
      { uid: 2, itemId: 'grave-dust', quantity: 9, upgradeLevel: 0 },
      { uid: 5, itemId: 'mourning-crescent', quantity: 1, upgradeLevel: 4 },
      { uid: 1, itemId: 'pilgrim-sword', quantity: 1, upgradeLevel: 2 },
      { uid: 10, itemId: 'mourning-crescent', quantity: 1, upgradeLevel: 0 },
    ],
  },
  equipment: { mainHand: 5 },
};

describe('Save migration v2 → v3', () => {
  it('keeps every item, tier, the backpack order, equipment and currencies, and starts at the sanctuary', () => {
    const raw = JSON.stringify(REAL_V2);
    const { profile, status, storage, save } = loadFrom(raw);
    expect(status).toBe('migrated');
    expect(profile.inventory.all.map((i) => [i.uid, i.itemId, i.quantity, i.upgradeLevel])).toEqual(REAL_V2.inventory.items.map((i) => [i.uid, i.itemId, i.quantity, i.upgradeLevel]));
    expect(profile.loadout.get('mainHand')).toBe(5);
    expect([profile.wallet.experience, profile.wallet.gold, profile.wallet.weaponXp]).toEqual([2210, 498, 115]);
    expect(profile.world.location).toBeNull();
    expect(profile.world.checkpoints.size).toBe(0);
    // Backed up first, then rewritten as v3.
    expect(storage.load(migrationBackupKey(2))).toBe(raw);
    expect(save.migrationBackedUp).toBe(true);
    const stored = JSON.parse(storage.load(SAVE_KEY)!);
    expect(stored.version).toBe(3);
    expect(stored.world).toEqual({ location: null, respawn: null, checkpoints: [], flags: [] });
    // Runs once.
    expect(new SaveManager(storage, new PlayerProfile()).load()).toBe('loaded');
  });

  it('v1 saves still migrate all the way (v1 → v2 → v3), backing up the original v1', () => {
    const raw = JSON.stringify(REAL_V1);
    const { profile, status, storage } = loadFrom(raw);
    expect(status).toBe('migrated');
    expect(profile.wallet.weaponXp).toBe(270);
    expect(profile.equippedWeaponUid).toBe(5);
    expect(storage.load(migrationBackupKey(1))).toBe(raw);
    expect(JSON.parse(storage.load(SAVE_KEY)!).version).toBe(3);
  });

  it('the v2 → v3 step is pure and deterministic', () => {
    const input = structuredClone(REAL_V2);
    const a = new PlayerProfile();
    const b = new PlayerProfile();
    applySave(JSON.stringify(input), a);
    applySave(JSON.stringify(input), b);
    expect(serializeProfile(a, new Date(0))).toEqual(serializeProfile(b, new Date(0)));
    expect(input).toEqual(REAL_V2);
  });
});
