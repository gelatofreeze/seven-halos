import { describe, expect, it } from 'vitest';
import { weaponUpgradeCost } from '../src/config/progression';
import { PlayerProfile } from '../src/rpg/Profile';
import { backpackCells, equipMessage, equipmentSlots, itemDetails, progression, upgradeMessage, validTargets } from '../src/ui/menuModel';
import { chooseLayout } from '../src/ui/PauseMenu';
import { flatSim, run, ScriptedInput } from './helpers';

describe('Pause menu model', () => {
  it('lists every owned instance in backpack order, with stacks, rarity, tier and the equipped marker', () => {
    const p = new PlayerProfile();
    const scythe = p.inventory.add('mourning-crescent');
    scythe.upgradeLevel = 2;
    p.inventory.add('grave-dust', 3);
    const cells = backpackCells(p);
    expect(cells.map((c) => [c.name, c.quantity, c.tier, c.equippedIn])).toEqual([
      ["Pilgrim's Sword", 1, 0, 'mainHand'],
      ['Mourning Crescent', 1, 2, null],
      ['Grave Dust', 3, 0, null],
    ]);
    expect(cells[1]).toMatchObject({ uid: scythe.uid, rarity: 'rare' });
  });

  it('shows all nine slots; only the main hand is functional', () => {
    const slots = equipmentSlots(new PlayerProfile());
    expect(slots.map((s) => s.slot.id)).toEqual(['mainHand', 'offHand', 'head', 'chest', 'legs', 'boots', 'ring1', 'ring2', 'tool']);
    expect(slots.filter((s) => s.slot.functional).map((s) => s.slot.id)).toEqual(['mainHand']);
    expect(slots[0]!.item?.name).toBe("Pilgrim's Sword");
    expect(slots.slice(1).every((s) => s.item === null)).toBe(true);
  });

  it('details compare a weapon against the equipped one', () => {
    const p = new PlayerProfile();
    const scythe = p.inventory.add('mourning-crescent');
    const d = itemDetails(p, scythe.uid)!;
    expect(d.category).toBe('Scythe');
    expect(d.comparedWith).toBe("Pilgrim's Sword");
    const reach = d.stats!.find((s) => s.key === 'reach')!;
    expect(reach.verdict).toBe('better');
    const startup = d.stats!.find((s) => s.key === 'startup')!;
    expect(startup.verdict).toBe('worse'); // slower to start
    expect(d.actions).toEqual([{ slot: 'mainHand', label: 'Main hand', state: 'ok' }]);
    // The equipped weapon shows no comparison.
    const own = itemDetails(p, p.equippedWeaponUid)!;
    expect(own.comparedWith).toBeNull();
    expect(own.actions[0]!.state).toBe('equipped');
  });

  it('materials have no equip actions or valid targets', () => {
    const p = new PlayerProfile();
    const dust = p.inventory.add('grave-dust');
    expect(itemDetails(p, dust.uid)!.actions).toEqual([]);
    expect(validTargets(p, dust.uid)).toEqual([]);
  });

  it('progression shows the three currencies and the selected weapon’s next upgrade', () => {
    const p = new PlayerProfile();
    p.wallet.add({ experience: 5, gold: 7, weaponXp: 100 });
    const dust = p.inventory.add('grave-dust');
    const view = progression(p, dust.uid);
    expect([view.characterXp, view.weaponXp, view.gold]).toEqual([5, 100, 7]);
    // A material is selected: the offer falls back to the equipped weapon.
    expect(view.upgrade).toMatchObject({ uid: p.equippedWeaponUid, cost: weaponUpgradeCost(0), canUpgrade: true });
  });

  it('messages explain every equip and upgrade outcome', () => {
    expect(equipMessage('incompatible', 'Grave Dust', 'head')).toMatch(/can't go in the head slot/);
    expect(equipMessage('required', '', 'mainHand')).toMatch(/always holds a weapon/);
    expect(upgradeMessage({ ok: true, level: 3, cost: 75 }, 'Mourning Crescent')).toBe('Mourning Crescent upgraded to +3 (−75 WXP).');
    expect(upgradeMessage({ ok: false, reason: 'insufficient-wxp' }, 'x')).toMatch(/Not enough Weapon XP/);
  });

  it('equipping from the menu while mid-action explains why it was refused', () => {
    const sim = flatSim();
    const input = new ScriptedInput();
    const scythe = sim.profile.inventory.add('mourning-crescent');
    input.frame.dodgePressed = true;
    run(sim, input, 2);
    expect(equipMessage(sim.requestEquip(scythe.uid), 'Mourning Crescent')).toMatch(/Finish your current action/);
    run(sim, input, 40);
    expect(equipMessage(sim.requestEquip(scythe.uid), 'Mourning Crescent')).toBe('Equipped Mourning Crescent.');
    expect(backpackCells(sim.profile).find((c) => c.uid === scythe.uid)?.equippedIn).toBe('mainHand');
  });

  it('chooses a layout that fits common phone and desktop sizes', () => {
    expect(chooseLayout(844, 390)).toBe('split'); // iPhone 12–15 landscape
    expect(chooseLayout(667, 375)).toBe('split'); // iPhone SE landscape
    expect(chooseLayout(568, 320)).toBe('tabs'); // smallest landscape phones
    expect(chooseLayout(390, 844)).toBe('tabs'); // portrait
    expect(chooseLayout(1280, 720)).toBe('wide');
  });
});
