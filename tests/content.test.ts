import { describe, expect, it } from 'vitest';
import { GAME_CONTENT, validateContent, type Content } from '../src/data/validateContent';
import { validateVisuals } from '../src/render/validateVisuals';

const clone = (): Content => structuredClone(GAME_CONTENT) as Content;

describe('Content validation', () => {
  it('the shipped content is valid', () => {
    expect(validateContent()).toEqual([]);
    expect(validateVisuals()).toEqual([]);
  });

  it('catches missing references', () => {
    const c = clone();
    c.weapons['pilgrim-sword']!.moveset.heavy = 'sword.typo';
    c.items['mourning-crescent']!.weaponId = 'no-such-weapon';
    c.enemies['hollow-sentinel']!.loot = [{ item: 'phantom-item', chance: 0.5 }];
    const errors = validateContent(c).join('\n');
    expect(errors).toMatch(/missing attack "sword.typo"/);
    expect(errors).toMatch(/missing weapon "no-such-weapon"/);
    expect(errors).toMatch(/loot item "phantom-item" does not exist/);
  });

  it('catches invalid probabilities and weights', () => {
    const c = clone();
    c.enemies['barrow-reaper']!.loot = [{ item: 'grave-dust', chance: 1.5 }];
    c.enemies['hollow-sentinel']!.attacks = c.enemies['hollow-sentinel']!.attacks.map((o) => ({ ...o, weight: 0 }));
    const errors = validateContent(c).join('\n');
    expect(errors).toMatch(/chance 1.5 is not a probability/);
    expect(errors).toMatch(/every attack weight is 0/);
  });

  it('catches incompatible slots and duplicate ids', () => {
    const c = clone();
    c.items['pilgrim-sword']!.equip = ['crown' as never];
    c.items['grave-dust']!.id = 'pilgrim-sword';
    c.slots = [...c.slots, c.slots[0]!];
    const errors = validateContent(c).join('\n');
    expect(errors).toMatch(/no slot accepts "crown"/);
    expect(errors).toMatch(/must be equippable in a weapon slot/);
    expect(errors).toMatch(/duplicate item id "pilgrim-sword"/);
    expect(errors).toMatch(/duplicate slot id "mainHand"/);
  });

  it('catches looping combo chains', () => {
    const c = clone();
    c.attacks['sword.light.2']!.next = 'sword.light.1';
    expect(validateContent(c).join('\n')).toMatch(/combo chain loops/);
  });

  it('catches broken animation mappings', () => {
    const c = clone();
    c.attacks['sword.light.1']!.next = 'sword.heavy';
    c.weapons['spare-blade'] = { ...c.weapons['pilgrim-sword']!, id: 'spare-blade', moveset: { light: 'sentinel.cleave', heavy: 'sword.heavy', riposte: 'sword.riposte' } };
    c.enemies['ghost'] = { ...c.enemies['hollow-sentinel']!, id: 'ghost' };
    const errors = validateVisuals(c).join('\n');
    expect(errors).toMatch(/"spare-blade": no player sheet/);
    expect(errors).toMatch(/"sentinel.cleave" has no PLAYER_ATTACK_FRAMES entry/);
    expect(errors).toMatch(/enemy "ghost": no visual profile/);
  });
});
