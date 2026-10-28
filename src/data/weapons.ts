import type { AttackDefinition } from '../combat/types';

/**
 * Attack catalogue. A weapon's moveset references attacks by id, so new
 * weapons, heavy attacks, running attacks and boss moves are pure data.
 */
export const ATTACKS: Record<string, AttackDefinition> = {
  'sword.light.1': {
    id: 'sword.light.1',
    name: 'Sword Slash',
    startupFrames: 8,
    activeFrames: 4,
    recoveryFrames: 18,
    staminaCost: 18,
    damage: { physical: 26 },
    poiseDamage: 22,
    knockbackX: 110,
    knockbackY: -40,
    hitstopFrames: 4,
    hitstunFrames: 18,
    hitboxes: [{ x: 2, y: -26, w: 30, h: 22 }],
    movement: { lungeFrame: 6, lungeSpeed: 95, friction: 900 },
    cancels: { chainFrom: 14, dodgeFrom: 16 },
    next: 'sword.light.2',
  },
  'sword.light.2': {
    id: 'sword.light.2',
    name: 'Sword Return Slash',
    startupFrames: 7,
    activeFrames: 4,
    recoveryFrames: 22,
    staminaCost: 20,
    damage: { physical: 30 },
    poiseDamage: 26,
    knockbackX: 150,
    knockbackY: -60,
    hitstopFrames: 5,
    hitstunFrames: 22,
    hitboxes: [{ x: 0, y: -30, w: 32, h: 28 }],
    movement: { lungeFrame: 5, lungeSpeed: 110, friction: 900 },
    cancels: { chainFrom: 999, dodgeFrom: 16 },
  },
  'sentinel.cleave': {
    id: 'sentinel.cleave',
    name: 'Hollow Cleave',
    // Long, readable telegraph: the core training lesson is to roll through it.
    startupFrames: 40,
    activeFrames: 6,
    recoveryFrames: 42,
    staminaCost: 0,
    damage: { physical: 34 },
    poiseDamage: 40,
    knockbackX: 200,
    knockbackY: -120,
    hitstopFrames: 7,
    hitstunFrames: 24,
    hitboxes: [{ x: -4, y: -46, w: 50, h: 46 }],
    movement: { lungeFrame: 38, lungeSpeed: 120, friction: 700 },
    cancels: { chainFrom: 999, dodgeFrom: 999 },
    hyperArmor: 30,
  },
};

export interface WeaponDefinition {
  id: string;
  name: string;
  category: 'straight-sword';
  moveset: {
    /** Light attack combo chain entry point. */
    light: string;
  };
}

export const WEAPONS: Record<string, WeaponDefinition> = {
  'pilgrim-sword': {
    id: 'pilgrim-sword',
    name: "Pilgrim's Sword",
    category: 'straight-sword',
    moveset: { light: 'sword.light.1' },
  },
};

export function getAttack(id: string): AttackDefinition {
  const attack = ATTACKS[id];
  if (!attack) throw new Error(`Unknown attack: ${id}`);
  return attack;
}
