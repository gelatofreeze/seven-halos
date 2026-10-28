import { describe, expect, it } from 'vitest';
import { WEAPON_XP, weaponUpgradeCost } from '../src/config/progression';
import { ENEMIES } from '../src/data/enemies';
import { getWeapon } from '../src/data/weapons';
import { checkEquip, equipInto, Loadout, slotsFor, unequipSlot } from '../src/rpg/Loadout';
import { PlayerProfile } from '../src/rpg/Profile';
import { Wallet } from '../src/rpg/Wallet';
import { quoteUpgrade, upgradeWeapon } from '../src/rpg/WeaponUpgrades';
import { compareStats, weaponStats } from '../src/rpg/weaponStats';
import type { SimEvent } from '../src/world/SimEvents';
import { flatSim, run, ScriptedInput } from './helpers';

describe('Weapon XP', () => {
  it('every enemy grants some, and spending never goes negative', () => {
    for (const e of Object.values(ENEMIES)) expect(e.rewards.weaponXp).toBeGreaterThan(0);
    const w = new Wallet();
    w.add({ experience: 0, gold: 0, weaponXp: 30 });
    expect(w.spend('weaponXp', 40)).toBe(false);
    expect(w.weaponXp).toBe(30);
    expect(w.spend('weaponXp', -5)).toBe(false);
    expect(w.spend('weaponXp', Number.NaN)).toBe(false);
    expect(w.spend('weaponXp', 30)).toBe(true);
    expect(w.weaponXp).toBe(0);
  });

  it('the cost curve rises every tier and is configurable', () => {
    expect(weaponUpgradeCost(0)).toBe(WEAPON_XP.upgradeCost.base);
    for (let l = 1; l < 10; l++) expect(weaponUpgradeCost(l)).toBeGreaterThan(weaponUpgradeCost(l - 1));
    for (let l = 0; l < 10; l++) expect(weaponUpgradeCost(l) % WEAPON_XP.upgradeCost.roundTo).toBe(0);
    // The first tier takes a handful of kills, not dozens.
    expect(weaponUpgradeCost(0) / ENEMIES['hollow-sentinel']!.rewards.weaponXp).toBeLessThanOrEqual(5);
  });
});

function richProfile(wxp: number) {
  const p = new PlayerProfile();
  p.wallet.add({ experience: 0, gold: 0, weaponXp: wxp });
  return p;
}

describe('Weapon upgrades', () => {
  it('raises the chosen instance one tier, paying exactly the cost once', () => {
    const p = richProfile(1000);
    const a = p.inventory.add('mourning-crescent');
    const b = p.inventory.add('mourning-crescent');
    const r = upgradeWeapon(p, a.uid, 0);
    expect(r).toEqual({ ok: true, level: 1, cost: weaponUpgradeCost(0) });
    expect(a.upgradeLevel).toBe(1);
    expect(b.upgradeLevel).toBe(0); // duplicates stay independent
    expect(p.wallet.weaponXp).toBe(1000 - weaponUpgradeCost(0));
  });

  it('a double tap (stale expected tier) is refused and costs nothing', () => {
    const p = richProfile(1000);
    const uid = p.equippedWeaponUid;
    expect(upgradeWeapon(p, uid, 0).ok).toBe(true);
    const after = p.wallet.weaponXp;
    expect(upgradeWeapon(p, uid, 0)).toEqual({ ok: false, reason: 'stale' });
    expect(p.wallet.weaponXp).toBe(after);
    expect(p.inventory.find(uid)!.upgradeLevel).toBe(1);
  });

  it('failures consume nothing: short on WXP, max tier, not owned, not a weapon', () => {
    const p = richProfile(10);
    const uid = p.equippedWeaponUid;
    const rev = p.revision;
    expect(upgradeWeapon(p, uid, 0)).toEqual({ ok: false, reason: 'insufficient-wxp' });
    expect(upgradeWeapon(p, 999, 0)).toEqual({ ok: false, reason: 'not-owned' });
    const dust = p.inventory.add('grave-dust');
    expect(upgradeWeapon(p, dust.uid, 0)).toEqual({ ok: false, reason: 'not-weapon' });
    const max = getWeapon('pilgrim-sword').upgrade.maxLevel;
    p.inventory.find(uid)!.upgradeLevel = max;
    p.wallet.weaponXp = 1e6;
    expect(upgradeWeapon(p, uid, max)).toEqual({ ok: false, reason: 'max-level' });
    expect(p.wallet.weaponXp).toBe(1e6);
    expect(p.inventory.find(uid)!.upgradeLevel).toBe(max);
    expect(p.revision).toBe(rev);
  });

  it('a quote shows tiers, cost, availability and the stat improvement', () => {
    const p = richProfile(25);
    const q = quoteUpgrade(p, p.equippedWeaponUid)!;
    expect(q).toMatchObject({ level: 0, nextLevel: 1, cost: weaponUpgradeCost(0), available: 25, canUpgrade: false, blocked: 'insufficient-wxp' });
    expect(q.next!.light).toBeGreaterThan(q.current.light);
    expect(q.next!.reach).toBe(q.current.reach);
    p.inventory.find(p.equippedWeaponUid)!.upgradeLevel = 10;
    expect(quoteUpgrade(p, p.equippedWeaponUid)).toMatchObject({ nextLevel: null, cost: null, next: null, blocked: 'max-level' });
    expect(quoteUpgrade(p, 12345)).toBeNull();
  });

  it('the simulation applies the new tier to the equipped weapon, but never mid-attack', () => {
    const sim = flatSim();
    const input = new ScriptedInput();
    sim.profile.wallet.weaponXp = 1000;
    const before = sim.player.stats.attackMultiplier;
    input.frame.attackPressed = true;
    run(sim, input, 2);
    expect(sim.player.state).toBe('attack');
    expect(sim.upgradeWeapon(sim.profile.equippedWeaponUid, 0).ok).toBe(true);
    expect(sim.player.stats.attackMultiplier).toBe(before);
    run(sim, input, 60);
    expect(sim.player.equipment.upgradeLevel).toBe(1);
    expect(sim.player.stats.attackMultiplier).toBeGreaterThan(before);
    const events: SimEvent[] = [];
    sim.events.drain((e) => events.push(e));
    expect(events.some((e) => e.type === 'upgrade' && e.level === 1)).toBe(true);
  });
});

describe('Weapon stats', () => {
  it('compares a candidate against the equipped weapon', () => {
    const sword = weaponStats('pilgrim-sword', 0);
    const scythe = weaponStats('mourning-crescent', 0);
    const diff = compareStats(scythe, sword);
    expect(diff.reach).toBeGreaterThan(0);
    expect(diff.startup).toBeGreaterThan(0); // slower
    expect(weaponStats('pilgrim-sword', 2).light).toBeGreaterThan(sword.light);
  });
});

describe('Equipment loadout rules', () => {
  it('items declare compatible slots; invalid combinations are rejected', () => {
    const p = new PlayerProfile();
    const dust = p.inventory.add('grave-dust');
    const scythe = p.inventory.add('mourning-crescent');
    expect(slotsFor('mourning-crescent')).toEqual(['mainHand']);
    expect(slotsFor('grave-dust')).toEqual([]);
    expect(checkEquip(p.inventory, p.loadout, scythe.uid, 'head')).toBe('incompatible');
    expect(checkEquip(p.inventory, p.loadout, dust.uid, 'mainHand')).toBe('incompatible');
    expect(checkEquip(p.inventory, p.loadout, 999, 'mainHand')).toBe('not-owned');
    expect(equipInto(p.inventory, p.loadout, scythe.uid, 'ring1')).toBe('incompatible');
    expect(p.loadout.entries()).toEqual([['mainHand', p.inventory.weapons()[0]!.uid]]);
  });

  it('tracks exact instances, so duplicate weapons stay distinguishable', () => {
    const p = new PlayerProfile();
    const a = p.inventory.add('mourning-crescent');
    const b = p.inventory.add('mourning-crescent');
    expect(equipInto(p.inventory, p.loadout, b.uid, 'mainHand')).toBe('ok');
    expect(p.loadout.isEquipped(b.uid)).toBe(true);
    expect(p.loadout.isEquipped(a.uid)).toBe(false);
  });

  it('the main hand can never be emptied', () => {
    const l = new Loadout();
    l.set('mainHand', 1);
    expect(unequipSlot(l, 'mainHand')).toBe('required');
    expect(unequipSlot(l, 'head')).toBe('empty');
    expect(l.get('mainHand')).toBe(1);
  });

  it('the simulation validates slot equips and never changes an active attack', () => {
    const sim = flatSim();
    const input = new ScriptedInput();
    const scythe = sim.profile.inventory.add('mourning-crescent');
    expect(sim.requestEquip(scythe.uid, 'chest')).toBe('incompatible');
    input.frame.attackPressed = true;
    run(sim, input, 3);
    const attack = sim.player.attack.attack;
    expect(sim.requestEquip(scythe.uid, 'mainHand')).toBe('busy');
    expect(sim.player.attack.attack).toBe(attack);
    expect(sim.profile.equippedWeaponUid).not.toBe(scythe.uid);
  });
});

describe('Backpack order', () => {
  it('moves instances without duplicating or losing any', () => {
    const p = new PlayerProfile();
    const a = p.inventory.add('mourning-crescent');
    const d = p.inventory.add('grave-dust', 4);
    const before = p.inventory.all.map((i) => i.uid).sort();
    expect(p.inventory.move(d.uid, 0)).toBe(true);
    expect(p.inventory.all[0]!.uid).toBe(d.uid);
    expect(p.inventory.move(a.uid, 99)).toBe(true);
    expect(p.inventory.all.at(-1)!.uid).toBe(a.uid);
    expect(p.inventory.move(12345, 0)).toBe(false);
    expect(p.inventory.all.map((i) => i.uid).sort()).toEqual(before);
    expect(p.inventory.count('grave-dust')).toBe(4);
  });
});
