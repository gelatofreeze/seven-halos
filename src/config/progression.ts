/**
 * Progression economy. Three currencies, all earned in combat:
 * - Character XP: levelling (a later update spends it).
 * - Weapon XP (WXP): one shared pool, spent to raise a specific weapon
 *   instance's upgrade tier.
 * - Gold: merchants.
 * Crafting materials are inventory items, not currencies.
 */
export const WEAPON_XP = {
  /**
   * Save format v1 stored "Forge Points". The v2 migration converts them at
   * this fixed rate, matching what the same kills earn under the new rewards
   * (Sentinel 1 FP → 10 WXP, Reaper 2 FP → 20 WXP).
   */
  forgePointRate: 10,
  /** Cost to go from tier L to L+1: base × growth^L, rounded to `roundTo`. */
  upgradeCost: { base: 40, growth: 1.35, roundTo: 5 },
} as const;

/** WXP needed to raise a weapon from `level` to `level + 1`. */
export function weaponUpgradeCost(level: number): number {
  const { base, growth, roundTo } = WEAPON_XP.upgradeCost;
  return Math.round((base * growth ** Math.max(0, level)) / roundTo) * roundTo;
}
