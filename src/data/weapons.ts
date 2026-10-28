import type { AttackDefinition } from '../combat/types';

/**
 * Attack catalogue. A weapon's moveset references attacks by id, so new
 * weapons, running attacks and boss moves are pure data. Frame counts are
 * 60 Hz frames. See docs/COMBAT.md for the design intent of each attack.
 */
export const ATTACKS: Record<string, AttackDefinition> = {
  'sword.light.1': {
    id: 'sword.light.1',
    name: 'Sword Slash',
    kind: 'light',
    startupFrames: 8,
    activeFrames: 4,
    recoveryFrames: 18,
    staminaCost: 18,
    damage: { physical: 26 },
    postureDamage: 14,
    guardStaminaDamage: 20,
    blockable: true,
    parryable: true,
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
    kind: 'light',
    startupFrames: 7,
    activeFrames: 4,
    recoveryFrames: 22,
    staminaCost: 20,
    damage: { physical: 30 },
    postureDamage: 18,
    guardStaminaDamage: 24,
    blockable: true,
    parryable: true,
    knockbackX: 150,
    knockbackY: -60,
    hitstopFrames: 5,
    hitstunFrames: 22,
    hitboxes: [{ x: 0, y: -30, w: 32, h: 28 }],
    movement: { lungeFrame: 5, lungeSpeed: 110, friction: 900 },
    cancels: { chainFrom: 999, dodgeFrom: 16 },
  },
  'sword.heavy': {
    id: 'sword.heavy',
    name: 'Overhead Cleave',
    kind: 'heavy',
    // Slow, committed and rooted: the reward is damage and posture, the cost is time and stamina.
    startupFrames: 20,
    activeFrames: 5,
    recoveryFrames: 30,
    staminaCost: 34,
    damage: { physical: 42 },
    postureDamage: 30,
    guardStaminaDamage: 45,
    blockable: true,
    parryable: true,
    knockbackX: 190,
    knockbackY: -90,
    hitstopFrames: 7,
    hitstunFrames: 28,
    hitboxes: [{ x: 0, y: -40, w: 36, h: 40 }],
    movement: { lungeFrame: 18, lungeSpeed: 130, friction: 1100 },
    // No combo chain; rolling out only late in recovery.
    cancels: { chainFrom: 999, dodgeFrom: 46 },
    charge: { holdFrame: 12, maxFrames: 42, maxDamageMultiplier: 1.65, maxPostureMultiplier: 1.8, staminaCost: 12 },
  },
  'sword.riposte': {
    id: 'sword.riposte',
    name: 'Riposte',
    kind: 'riposte',
    startupFrames: 12,
    activeFrames: 4,
    recoveryFrames: 26,
    staminaCost: 0,
    damage: { physical: 60 },
    postureDamage: 0,
    guardStaminaDamage: 0,
    blockable: false,
    parryable: false,
    knockbackX: 160,
    knockbackY: -80,
    hitstopFrames: 14,
    hitstunFrames: 0,
    hitboxes: [{ x: -4, y: -30, w: 40, h: 30 }],
    movement: { lungeFrame: 10, lungeSpeed: 120, friction: 900 },
    cancels: { chainFrom: 999, dodgeFrom: 999 },
  },
  'sentinel.cleave': {
    id: 'sentinel.cleave',
    name: 'Hollow Cleave',
    kind: 'enemy',
    // Long, readable telegraph: the core lesson is to roll through, block or parry it.
    startupFrames: 40,
    activeFrames: 6,
    recoveryFrames: 42,
    staminaCost: 0,
    damage: { physical: 34 },
    postureDamage: 0,
    guardStaminaDamage: 50,
    blockable: true,
    parryable: true,
    knockbackX: 200,
    knockbackY: -120,
    hitstopFrames: 7,
    hitstunFrames: 24,
    hitboxes: [{ x: -4, y: -46, w: 50, h: 46 }],
    movement: { lungeFrame: 38, lungeSpeed: 120, friction: 700 },
    cancels: { chainFrom: 999, dodgeFrom: 999 },
    hyperArmor: true,
  },
  'sentinel.cleave.delayed': {
    id: 'sentinel.cleave.delayed',
    name: 'Hollow Cleave (Delayed)',
    kind: 'enemy',
    // Same swing held at the top: punishes rolling or parrying on the windup instead of the glint.
    startupFrames: 58,
    activeFrames: 6,
    recoveryFrames: 42,
    staminaCost: 0,
    damage: { physical: 36 },
    postureDamage: 0,
    guardStaminaDamage: 50,
    blockable: true,
    parryable: true,
    knockbackX: 200,
    knockbackY: -120,
    hitstopFrames: 7,
    hitstunFrames: 24,
    hitboxes: [{ x: -4, y: -46, w: 50, h: 46 }],
    movement: { lungeFrame: 56, lungeSpeed: 120, friction: 700 },
    cancels: { chainFrom: 999, dodgeFrom: 999 },
    hyperArmor: true,
  },
};

export interface WeaponDefinition {
  id: string;
  name: string;
  category: 'straight-sword';
  moveset: {
    /** Light attack combo chain entry point. */
    light: string;
    /** Heavy (chargeable) attack. */
    heavy: string;
    riposte: string;
  };
}

export const WEAPONS: Record<string, WeaponDefinition> = {
  'pilgrim-sword': {
    id: 'pilgrim-sword',
    name: "Pilgrim's Sword",
    category: 'straight-sword',
    moveset: { light: 'sword.light.1', heavy: 'sword.heavy', riposte: 'sword.riposte' },
  },
};

export function getAttack(id: string): AttackDefinition {
  const attack = ATTACKS[id];
  if (!attack) throw new Error(`Unknown attack: ${id}`);
  return attack;
}
