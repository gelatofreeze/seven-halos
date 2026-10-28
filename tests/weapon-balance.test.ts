import { describe, expect, it } from 'vitest';
import { getAttack } from '../src/data/weapons';
import { benchWeapon, connectsAt } from './benchmark';

/**
 * Balance guard rails from the reproducible benchmark (tests/benchmark.ts).
 * Each weapon is measured at its natural range against a stationary
 * Sentinel dummy. See docs/COMBAT.md for the measured table.
 */
const sword = { light: benchWeapon('sword', 'light', 24), charged: benchWeapon('sword', 'charged', 24), burst: benchWeapon('sword', 'light', 24, 3, 'burst') };
const scythe = { light: benchWeapon('scythe', 'light', 40), charged: benchWeapon('scythe', 'charged', 40), burst: benchWeapon('scythe', 'light', 40, 3, 'burst') };
const reach = (w: 'sword' | 'scythe') => Math.max(...[16, 24, 32, 40, 48, 56, 64, 72].filter((d) => connectsAt(w, d)));

describe('Weapon balance (benchmark guard rails)', () => {
  it('scythe light combo is close to, but not above, the sword in sustained damage', () => {
    const ratio = scythe.light.dps / sword.light.dps;
    expect(ratio).toBeGreaterThan(0.85);
    expect(ratio).toBeLessThanOrEqual(1.0);
  });

  it('scythe is at least as stamina-efficient and clearly better at breaking posture', () => {
    expect(scythe.light.damagePerStamina).toBeGreaterThanOrEqual(sword.light.damagePerStamina * 0.95);
    expect(scythe.light.posture).toBeGreaterThan(sword.light.posture * 1.1);
  });

  it('burst from full stamina stays within ±10% of the sword', () => {
    const ratio = scythe.burst.dps / sword.burst.dps;
    expect(ratio).toBeGreaterThan(0.9);
    expect(ratio).toBeLessThan(1.1);
  });

  it('the charged heavy is the scythe’s signature: clearly stronger than the sword’s', () => {
    expect(scythe.charged.dps).toBeGreaterThan(sword.charged.dps * 1.1);
  });

  it('the scythe keeps a real reach advantage', () => {
    expect(reach('scythe')).toBeGreaterThanOrEqual(reach('sword') + 12);
  });

  it('the sword keeps the speed advantage and the scythe keeps its whiff penalty', () => {
    expect(getAttack('sword.light.1').startupFrames).toBeLessThan(getAttack('scythe.light.1').startupFrames);
    expect(getAttack('scythe.heavy').recoveryFrames).toBeGreaterThan(getAttack('sword.heavy').recoveryFrames);
  });
});
