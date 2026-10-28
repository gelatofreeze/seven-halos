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
  // ---- Mourning Crescent (scythe) --------------------------------------------------------
  // Wide arcs and long reach, paid for with slower startup, higher stamina and
  // long recoveries that are punishable when a swing misses.
  'scythe.light.1': {
    id: 'scythe.light.1',
    name: 'Crescent Sweep',
    kind: 'light',
    startupFrames: 11,
    activeFrames: 6,
    recoveryFrames: 19,
    staminaCost: 22,
    damage: { physical: 24 },
    postureDamage: 12,
    guardStaminaDamage: 22,
    blockable: true,
    parryable: true,
    knockbackX: 130,
    knockbackY: -30,
    hitstopFrames: 4,
    hitstunFrames: 18,
    // The arc starts high in front and finishes low and far.
    hitboxes: [
      { x: 6, y: -32, w: 40, h: 16, toFrame: 2 },
      { x: -4, y: -22, w: 52, h: 20, fromFrame: 2 },
    ],
    movement: { lungeFrame: 8, lungeSpeed: 70, friction: 800 },
    cancels: { chainFrom: 17, dodgeFrom: 20 },
    next: 'scythe.light.2',
  },
  'scythe.light.2': {
    id: 'scythe.light.2',
    name: 'Returning Sweep',
    kind: 'light',
    startupFrames: 9,
    activeFrames: 6,
    recoveryFrames: 21,
    staminaCost: 22,
    damage: { physical: 26 },
    postureDamage: 14,
    guardStaminaDamage: 24,
    blockable: true,
    parryable: true,
    knockbackX: 140,
    knockbackY: -40,
    hitstopFrames: 4,
    hitstunFrames: 20,
    // The backswing also catches enemies just behind the wielder.
    hitboxes: [{ x: -22, y: -28, w: 64, h: 24 }],
    movement: { lungeFrame: 6, lungeSpeed: 60, friction: 800 },
    cancels: { chainFrom: 16, dodgeFrom: 19 },
    next: 'scythe.light.3',
  },
  'scythe.light.3': {
    id: 'scythe.light.3',
    name: 'Reaping Spin',
    kind: 'light',
    startupFrames: 13,
    activeFrames: 9,
    recoveryFrames: 30,
    staminaCost: 26,
    damage: { physical: 32 },
    postureDamage: 22,
    guardStaminaDamage: 30,
    blockable: true,
    parryable: true,
    knockbackX: 200,
    knockbackY: -90,
    hitstopFrames: 6,
    hitstunFrames: 26,
    // A full spin: front half first, then the back half.
    hitboxes: [
      { x: 0, y: -36, w: 50, h: 36, toFrame: 4 },
      { x: -40, y: -36, w: 40, h: 36, fromFrame: 4 },
    ],
    movement: { lungeFrame: 10, lungeSpeed: 90, friction: 700 },
    cancels: { chainFrom: 999, dodgeFrom: 34 },
  },
  'scythe.heavy': {
    id: 'scythe.heavy',
    name: 'Harvest Arc',
    kind: 'heavy',
    startupFrames: 26,
    activeFrames: 7,
    recoveryFrames: 40,
    staminaCost: 40,
    damage: { physical: 50 },
    postureDamage: 34,
    guardStaminaDamage: 50,
    blockable: true,
    parryable: true,
    knockbackX: 230,
    knockbackY: -110,
    hitstopFrames: 8,
    hitstunFrames: 30,
    hitboxes: [{ x: -10, y: -48, w: 70, h: 48 }],
    movement: { lungeFrame: 24, lungeSpeed: 120, friction: 1000 },
    cancels: { chainFrom: 999, dodgeFrom: 60 },
    charge: { holdFrame: 14, maxFrames: 54, maxDamageMultiplier: 1.75, maxPostureMultiplier: 1.6, staminaCost: 16 },
  },
  'scythe.riposte': {
    id: 'scythe.riposte',
    name: 'Crescent Execution',
    kind: 'riposte',
    startupFrames: 14,
    activeFrames: 5,
    recoveryFrames: 30,
    staminaCost: 0,
    damage: { physical: 64 },
    postureDamage: 0,
    guardStaminaDamage: 0,
    blockable: false,
    parryable: false,
    knockbackX: 200,
    knockbackY: -100,
    hitstopFrames: 14,
    hitstunFrames: 0,
    hitboxes: [{ x: -4, y: -32, w: 54, h: 32 }],
    movement: { lungeFrame: 12, lungeSpeed: 90, friction: 900 },
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
  // ---- Barrow Reaper ---------------------------------------------------------------------
  'reaper.sweep': {
    id: 'reaper.sweep',
    name: 'Low Reap',
    kind: 'enemy',
    // A quicker, low, wide sweep: jump it, roll it, or stay out of its reach.
    startupFrames: 24,
    activeFrames: 6,
    recoveryFrames: 26,
    staminaCost: 0,
    damage: { physical: 22 },
    postureDamage: 0,
    guardStaminaDamage: 30,
    blockable: true,
    parryable: true,
    knockbackX: 140,
    knockbackY: -60,
    hitstopFrames: 5,
    hitstunFrames: 18,
    hitboxes: [{ x: -8, y: -20, w: 66, h: 20 }],
    movement: { lungeFrame: 20, lungeSpeed: 60, friction: 700 },
    cancels: { chainFrom: 999, dodgeFrom: 999 },
  },
  'reaper.harvest': {
    id: 'reaper.harvest',
    name: 'Harvest Lunge',
    kind: 'enemy',
    // Long crouching wind-up, a gliding dash and an overhead chop; the scythe
    // sticks in the ground afterwards, leaving a long punish window.
    startupFrames: 46,
    activeFrames: 8,
    recoveryFrames: 56,
    staminaCost: 0,
    damage: { physical: 38 },
    postureDamage: 0,
    guardStaminaDamage: 55,
    blockable: true,
    parryable: true,
    knockbackX: 220,
    knockbackY: -130,
    hitstopFrames: 8,
    hitstunFrames: 26,
    hitboxes: [{ x: 0, y: -48, w: 44, h: 48 }],
    movement: { lungeFrame: 44, lungeSpeed: 300, friction: 600 },
    cancels: { chainFrom: 999, dodgeFrom: 999 },
    hyperArmor: true,
  },
};

export interface WeaponDefinition {
  id: string;
  name: string;
  category: 'straight-sword' | 'scythe';
  moveset: {
    /** Light attack combo chain entry point. */
    light: string;
    /** Heavy (chargeable) attack. */
    heavy: string;
    riposte: string;
  };
  /** Forge upgrades (spent with Forge Points in a later update): outgoing damage +`damagePerLevel` per level. */
  upgrade: { damagePerLevel: number; maxLevel: number };
}

export const WEAPONS: Record<string, WeaponDefinition> = {
  'pilgrim-sword': {
    id: 'pilgrim-sword',
    name: "Pilgrim's Sword",
    category: 'straight-sword',
    moveset: { light: 'sword.light.1', heavy: 'sword.heavy', riposte: 'sword.riposte' },
    // Scales better than the scythe, so an upgraded sword stays competitive.
    upgrade: { damagePerLevel: 0.1, maxLevel: 10 },
  },
  'mourning-crescent': {
    id: 'mourning-crescent',
    name: 'Mourning Crescent',
    category: 'scythe',
    moveset: { light: 'scythe.light.1', heavy: 'scythe.heavy', riposte: 'scythe.riposte' },
    upgrade: { damagePerLevel: 0.07, maxLevel: 10 },
  },
};

export function getWeapon(id: string): WeaponDefinition {
  const weapon = WEAPONS[id];
  if (!weapon) throw new Error(`Unknown weapon: ${id}`);
  return weapon;
}

export function getAttack(id: string): AttackDefinition {
  const attack = ATTACKS[id];
  if (!attack) throw new Error(`Unknown attack: ${id}`);
  return attack;
}
