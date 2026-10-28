import { describe, expect, it } from 'vitest';
import { seeded } from '../src/core/random';
import { getEnemy, type LootEntry } from '../src/data/enemies';
import { CORRUPT_BACKUP_KEY, SAVE_KEY, SAVE_VERSION, SaveManager, applySave, serializeProfile } from '../src/persistence/SaveGame';
import { MemoryStorage } from '../src/persistence/Storage';
import { PlayerProfile } from '../src/rpg/Profile';
import { rollLoot } from '../src/world/Loot';
import { PICKUP_ARM_TIME } from '../src/world/Pickups';
import type { SimEvent } from '../src/world/SimEvents';
import type { Simulation } from '../src/world/Simulation';
import { flatSim, run, runUntil, ScriptedInput } from './helpers';

const REAPER = getEnemy('barrow-reaper');

function drain(sim: Simulation): SimEvent[] {
  const out: SimEvent[] = [];
  sim.events.drain((e) => out.push(e));
  return out;
}

/** Kill the first enemy with the player's sword; returns collected events. */
function killFirstEnemy(sim: Simulation, input: ScriptedInput): SimEvent[] {
  const e = sim.enemies[0]!;
  const events: SimEvent[] = [];
  e.health.current = 1;
  runUntil(sim, input, () => e.isDead, 300, (i) => {
    e.cooldown = 999;
    if (sim.player.state !== 'attack') {
      sim.player.body.teleport(e.body.footX - 20, sim.player.body.footY);
      sim.player.facing = 1;
    }
    if (i % 10 === 0) input.frame.attackPressed = true;
    events.push(...drain(sim));
  });
  run(sim, input, 2);
  events.push(...drain(sim));
  return events;
}

describe('Currency rewards', () => {
  it('grants the data-defined XP, gold and Forge Points exactly once per kill', () => {
    const sim = flatSim({ enemyCol: 10, enemy: 'R', width: 50 });
    const input = new ScriptedInput();
    const events = killFirstEnemy(sim, input);
    const w = sim.profile.wallet;
    expect([w.experience, w.gold, w.forgePoints]).toEqual([REAPER.rewards.experience, REAPER.rewards.gold, REAPER.rewards.forgePoints]);
    expect(events.filter((e) => e.type === 'reward')).toHaveLength(1);
    // Lingering on the corpse, extra hits and the respawn grant nothing more.
    run(sim, input, 60 * (REAPER.respawnDelay! + 1), (i) => {
      if (i % 7 === 0) input.frame.attackPressed = true;
    });
    expect(w.experience).toBe(REAPER.rewards.experience);
    expect(sim.enemies[0]!.isDead).toBe(false);
    // A second legitimate kill grants a second reward.
    killFirstEnemy(sim, input);
    expect(w.experience).toBe(REAPER.rewards.experience * 2);
    expect(w.gold).toBe(REAPER.rewards.gold * 2);
  });

  it('death processing is idempotent', () => {
    const sim = flatSim({ enemyCol: 10, enemy: 'R', width: 50 });
    killFirstEnemy(sim, new ScriptedInput());
    expect(sim.enemies[0]!.consumeDeath()).toBe(false);
    expect(sim.enemies[0]!.deaths).toBe(1);
  });
});

describe('Loot', () => {
  const ctx = { owns: () => false };

  it('is deterministic for a given seed', () => {
    const roll = (seed: number) => {
      const r = seeded(seed);
      return Array.from({ length: 50 }, () => rollLoot(REAPER.loot, r, ctx));
    };
    expect(roll(42)).toEqual(roll(42));
    expect(roll(42)).not.toEqual(roll(43));
  });

  it('matches the configured 1% scythe chance over many reproducible trials', () => {
    const r = seeded(2026);
    const trials = 40000;
    let scythes = 0;
    let dustRolls = 0;
    for (let i = 0; i < trials; i++) {
      for (const d of rollLoot(REAPER.loot, r, ctx)) {
        if (d.itemId === 'mourning-crescent') scythes++;
        if (d.itemId === 'grave-dust') {
          dustRolls++;
          expect(d.quantity).toBeGreaterThanOrEqual(1);
          expect(d.quantity).toBeLessThanOrEqual(2);
        }
      }
    }
    expect(scythes / trials).toBeGreaterThan(0.0085);
    expect(scythes / trials).toBeLessThan(0.0115);
    expect(dustRolls / trials).toBeGreaterThan(0.33);
    expect(dustRolls / trials).toBeLessThan(0.37);
    expect(REAPER.loot.find((l) => l.item === 'mourning-crescent')?.chance).toBe(0.01);
  });

  it('skips notOwned entries the player already has, without shifting other rolls', () => {
    const table: LootEntry[] = [
      { item: 'mourning-crescent', chance: 1, condition: 'notOwned' },
      { item: 'grave-dust', chance: 0.5 },
    ];
    const a = rollLoot(table, seeded(5), { owns: () => false }).filter((d) => d.itemId === 'grave-dust');
    const b = rollLoot(table, seeded(5), { owns: () => true });
    expect(b.some((d) => d.itemId === 'mourning-crescent')).toBe(false);
    expect(b).toEqual(a);
  });

  it('loot randomness is independent of combat AI randomness', () => {
    const sim = flatSim({ enemyCol: 10, enemy: 'R', width: 50 });
    const aiBefore = seeded(7);
    // Draining the loot stream must not change the AI stream.
    for (let i = 0; i < 100; i++) sim.lootRandom();
    expect(sim.random()).toBe(aiBefore());
  });

  it('a kill rolls the table once and drops visible pickups that outlive the corpse', () => {
    // Force a guaranteed table by rolling until a seed gives grave dust on the first kill.
    let sim!: Simulation;
    for (let seed = 1; seed < 200; seed++) {
      const candidate = flatSim({ enemyCol: 10, enemy: 'R', width: 50, seed });
      const preview = seeded((seed ^ 0x5eed1007) >>> 0);
      if (rollLoot(REAPER.loot, preview, ctx).length > 0) {
        sim = candidate;
        break;
      }
    }
    const input = new ScriptedInput();
    const events = killFirstEnemy(sim, input);
    const drops = events.filter((e) => e.type === 'lootDrop');
    expect(drops.length).toBeGreaterThan(0);
    // The pickups may already have been collected (the player stands on them) or still lie there.
    const collected = events.filter((e) => e.type === 'pickup').length;
    expect(sim.pickups.length + collected).toBe(drops.length);
    // Repeated death processing adds nothing.
    run(sim, input, 30);
    expect(drain(sim).filter((e) => e.type === 'lootDrop')).toHaveLength(0);
  });
});

describe('Pickups and equipping', () => {
  it('walking over a dropped weapon collects it once; it can then be equipped', () => {
    const sim = flatSim({ width: 50 });
    const input = new ScriptedInput();
    sim.spawnPickup('mourning-crescent', 1, sim.player.body.footX + 40, sim.player.body.footY - 4, 0);
    run(sim, input, Math.ceil(PICKUP_ARM_TIME * 60) + 5);
    expect(sim.profile.inventory.owns('mourning-crescent')).toBe(false);
    input.frame.moveX = 1;
    const events: SimEvent[] = [];
    run(sim, input, 40, () => events.push(...drain(sim)));
    input.frame.moveX = 0;
    expect(events.filter((e) => e.type === 'pickup')).toHaveLength(1);
    expect(sim.pickups).toHaveLength(0);
    expect(sim.profile.inventory.weapons().filter((w) => w.itemId === 'mourning-crescent')).toHaveLength(1);
    const scythe = sim.profile.inventory.weapons().find((w) => w.itemId === 'mourning-crescent')!;
    expect(sim.requestEquip(scythe.uid)).toBe('equipped');
    expect(sim.player.equipment.weapon.id).toBe('mourning-crescent');
  });

  it('stackable materials stack; weapons stay separate instances', () => {
    const p = new PlayerProfile();
    p.inventory.add('grave-dust', 2);
    p.inventory.add('grave-dust', 1);
    expect(p.inventory.count('grave-dust')).toBe(3);
    expect(p.inventory.all.filter((i) => i.itemId === 'grave-dust')).toHaveLength(1);
    const a = p.inventory.add('mourning-crescent');
    const b = p.inventory.add('mourning-crescent');
    expect(a.uid).not.toBe(b.uid);
  });

  it('development altars hold a test scythe only when enabled and not yet owned', () => {
    const rows = ['#' + '.'.repeat(38) + '#'];
    for (let i = 0; i < 9; i++) rows.push(rows[0]!);
    rows.push('#....P.......A........................#', '#'.repeat(40), '#'.repeat(40));
    const make = async (opts: object) => {
      const { parseLevel } = await import('../src/world/Level');
      const { Simulation } = await import('../src/world/Simulation');
      return new Simulation(parseLevel({ id: 't', name: 't', tileSize: 16, rows }), opts);
    };
    return Promise.all([make({}), make({ devPickups: true })]).then(async ([plain, dev]) => {
      expect(plain.pickups).toHaveLength(0);
      expect(dev.pickups).toHaveLength(1);
      expect(dev.pickups[0]!.itemId).toBe('mourning-crescent');
      const owner = new PlayerProfile();
      owner.inventory.add('mourning-crescent');
      expect((await make({ devPickups: true, profile: owner })).pickups).toHaveLength(0);
    });
  });
});

describe('Persistence', () => {
  it('round-trips currencies, owned equipment and the equipped weapon', () => {
    const storage = new MemoryStorage();
    const profile = new PlayerProfile();
    const save = new SaveManager(storage, profile);
    expect(save.load()).toBe('new');
    profile.wallet.add({ experience: 120, gold: 33, forgePoints: 4 });
    const scythe = profile.inventory.add('mourning-crescent');
    profile.inventory.add('grave-dust', 3);
    profile.equippedWeaponUid = scythe.uid;
    profile.touch();
    expect(save.saveIfChanged()).toBe(true);
    expect(save.saveIfChanged()).toBe(false);

    const reloaded = new PlayerProfile();
    expect(new SaveManager(storage, reloaded).load()).toBe('loaded');
    expect([reloaded.wallet.experience, reloaded.wallet.gold, reloaded.wallet.forgePoints]).toEqual([120, 33, 4]);
    expect(reloaded.inventory.owns('mourning-crescent')).toBe(true);
    expect(reloaded.inventory.count('grave-dust')).toBe(3);
    expect(reloaded.equippedWeaponId()).toBe('mourning-crescent');
    // New items after reload never reuse an old uid.
    expect(reloaded.inventory.add('mourning-crescent').uid).toBeGreaterThan(scythe.uid);
  });

  it('a reloaded simulation starts with the saved weapon equipped', () => {
    const storage = new MemoryStorage();
    const profile = new PlayerProfile();
    const scythe = profile.inventory.add('mourning-crescent');
    profile.equippedWeaponUid = scythe.uid;
    profile.touch();
    new SaveManager(storage, profile).saveIfChanged();
    const reloaded = new PlayerProfile();
    new SaveManager(storage, reloaded).load();
    const sim = flatSim({ profile: reloaded });
    expect(sim.player.equipment.weapon.id).toBe('mourning-crescent');
  });

  it('corrupt saves are backed up and replaced by a fresh profile', () => {
    for (const raw of ['{not json', '[]', '{"version":"x"}', 'null', '{"version":0}']) {
      const storage = new MemoryStorage();
      storage.save(SAVE_KEY, raw);
      const profile = new PlayerProfile();
      const save = new SaveManager(storage, profile);
      expect(save.load()).toBe('corrupt');
      expect(storage.load(CORRUPT_BACKUP_KEY)).toBe(raw);
      expect(profile.equippedWeaponId()).toBe('pilgrim-sword');
      expect(profile.wallet.gold).toBe(0);
      expect(save.saveIfChanged()).toBe(true);
    }
  });

  it('a save from a newer version is not overwritten', () => {
    const storage = new MemoryStorage();
    const future = JSON.stringify({ version: SAVE_VERSION + 1, currencies: { gold: 999 } });
    storage.save(SAVE_KEY, future);
    const profile = new PlayerProfile();
    const save = new SaveManager(storage, profile);
    expect(save.load()).toBe('unsupported-version');
    profile.wallet.add({ experience: 1, gold: 1, forgePoints: 1 });
    profile.touch();
    expect(save.saveIfChanged()).toBe(false);
    expect(storage.load(SAVE_KEY)).toBe(future);
  });

  it('invalid fields are sanitised: unknown items, duplicate uids, bad numbers, missing weapon', () => {
    const profile = new PlayerProfile();
    const status = applySave(
      JSON.stringify({
        version: 1,
        currencies: { experience: -5, gold: 12.7, forgePoints: 'lots' },
        inventory: {
          nextUid: 3,
          items: [
            { uid: 7, itemId: 'mourning-crescent', quantity: 5 },
            { uid: 7, itemId: 'grave-dust', quantity: 2 },
            { uid: 8, itemId: 'ancient-cheat-sword', quantity: 1 },
            { uid: 9, itemId: 'grave-dust', quantity: -3 },
          ],
        },
        equippedWeaponUid: 42,
      }),
      profile,
    );
    expect(status).toBe('loaded');
    expect([profile.wallet.experience, profile.wallet.gold, profile.wallet.forgePoints]).toEqual([0, 12, 0]);
    expect(profile.inventory.all.map((i) => i.itemId).sort()).toEqual(['grave-dust', 'mourning-crescent']);
    expect(profile.inventory.find(7)!.quantity).toBe(1);
    expect(profile.inventory.count('grave-dust')).toBe(1);
    // Equipped uid 42 doesn't exist: falls back to an owned weapon.
    expect(profile.equippedWeapon()).toBeDefined();
    expect(profile.inventory.add('grave-dust').uid).toBe(9);
  });

  it('serialised saves carry the current version', () => {
    expect(serializeProfile(new PlayerProfile()).version).toBe(SAVE_VERSION);
  });

  it('the development reset wipes progress', () => {
    const storage = new MemoryStorage();
    const profile = new PlayerProfile();
    const save = new SaveManager(storage, profile);
    profile.wallet.add({ experience: 5, gold: 5, forgePoints: 5 });
    profile.inventory.add('mourning-crescent');
    profile.touch();
    save.saveIfChanged();
    save.reset();
    expect(profile.wallet.gold).toBe(0);
    expect(profile.inventory.owns('mourning-crescent')).toBe(false);
    const fresh = new PlayerProfile();
    new SaveManager(storage, fresh).load();
    expect(fresh.inventory.owns('mourning-crescent')).toBe(false);
  });
});
