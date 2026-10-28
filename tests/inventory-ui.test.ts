import { describe, expect, it } from 'vitest';
import { PlayerProfile } from '../src/rpg/Profile';
import { equipMessage, inventoryRows } from '../src/ui/inventoryModel';
import { flatSim, run, ScriptedInput } from './helpers';

describe('Inventory panel model', () => {
  it('lists owned weapons with the equipped one marked, and stacked materials', () => {
    const p = new PlayerProfile();
    const scythe = p.inventory.add('mourning-crescent');
    p.inventory.add('grave-dust', 3);
    const rows = inventoryRows(p);
    expect(rows.weapons.map((w) => [w.name, w.equipped])).toEqual([
      ["Pilgrim's Sword", true],
      ['Mourning Crescent', false],
    ]);
    expect(rows.weapons[1]).toMatchObject({ uid: scythe.uid, rarity: 'rare', category: 'Scythe' });
    expect(rows.materials).toEqual([{ name: 'Grave Dust', quantity: 3 }]);
  });

  it('equipping from the menu while mid-action explains why it was refused', () => {
    const sim = flatSim();
    const input = new ScriptedInput();
    const scythe = sim.profile.inventory.add('mourning-crescent');
    input.frame.dodgePressed = true;
    run(sim, input, 2);
    const result = sim.requestEquip(scythe.uid);
    expect(equipMessage(result, 'Mourning Crescent')).toMatch(/Finish your current action/);
    run(sim, input, 40);
    expect(equipMessage(sim.requestEquip(scythe.uid), 'Mourning Crescent')).toBe('Equipped Mourning Crescent.');
    expect(inventoryRows(sim.profile).weapons.find((w) => w.uid === scythe.uid)?.equipped).toBe(true);
  });
});
