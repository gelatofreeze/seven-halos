import type { AttackDefinition, CombatStats, DamageResult } from './types';

/** Damage and posture multipliers of a charged attack at `chargeLevel` (0..1). */
export function chargeMultipliers(attack: AttackDefinition, chargeLevel: number): { damage: number; posture: number } {
  const c = attack.charge;
  if (!c || chargeLevel <= 0) return { damage: 1, posture: 1 };
  const t = Math.min(1, chargeLevel);
  return { damage: 1 + (c.maxDamageMultiplier - 1) * t, posture: 1 + (c.maxPostureMultiplier - 1) * t };
}

/**
 * Pure damage calculation, separate from hit detection and from guard/parry
 * resolution. Future scaling and elemental rules belong here.
 */
export function calculateDamage(
  attack: AttackDefinition,
  attacker: CombatStats,
  defender: CombatStats,
  out: DamageResult,
  chargeLevel = 0,
): DamageResult {
  const charge = chargeMultipliers(attack, chargeLevel);
  let total = 0;
  for (const type in attack.damage) {
    const raw = (attack.damage[type] ?? 0) * attacker.attackMultiplier * charge.damage;
    if (raw <= 0) continue;
    // Flat defense can reduce a hit to at most 10% of its raw value.
    const afterDefense = Math.max(raw * 0.1, raw - defender.defense);
    total += afterDefense * (1 - defender.absorption);
  }
  out.damage = Math.max(1, Math.round(total));
  out.postureDamage = Math.round(attack.postureDamage * charge.posture);
  out.knockbackX = attack.knockbackX;
  out.knockbackY = attack.knockbackY;
  out.hitstunFrames = attack.hitstunFrames;
  return out;
}
