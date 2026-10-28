import type { AttackDefinition, CombatStats, DamageResult } from './types';

/**
 * Pure damage calculation, separate from hit detection. Future posture,
 * guard, elemental and scaling rules belong here.
 */
export function calculateDamage(
  attack: AttackDefinition,
  attacker: CombatStats,
  defender: CombatStats,
  out: DamageResult,
): DamageResult {
  let total = 0;
  for (const type in attack.damage) {
    const raw = (attack.damage[type] ?? 0) * attacker.attackMultiplier;
    if (raw <= 0) continue;
    // Flat defense can reduce a hit to at most 10% of its raw value.
    const afterDefense = Math.max(raw * 0.1, raw - defender.defense);
    total += afterDefense * (1 - defender.absorption);
  }
  out.damage = Math.max(1, Math.round(total));
  out.poiseDamage = attack.poiseDamage;
  out.knockbackX = attack.knockbackX;
  out.knockbackY = attack.knockbackY;
  out.hitstunFrames = attack.hitstunFrames;
  return out;
}
