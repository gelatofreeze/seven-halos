import { GUARD } from '../config/combat';
import type { ActiveHitbox, Combatant } from './types';

export type DefenseOutcome = { kind: 'hit' } | { kind: 'parry' } | { kind: 'block'; staminaCost: number; guardBroken: boolean };

const HIT: DefenseOutcome = { kind: 'hit' };
const PARRIED: DefenseOutcome = { kind: 'parry' };

/** True if the attacker stands in front of the defender (the side it faces). */
export function isFrontal(defender: Combatant, defenderFacing: number, attacker: Combatant): boolean {
  return (attacker.centerX - defender.centerX) * defenderFacing >= -GUARD.frontTolerance;
}

/**
 * Guard and parry resolution, between hit detection (geometry) and damage
 * calculation (numbers). Pure: decides the outcome, applies nothing.
 */
export function resolveDefense(hit: ActiveHitbox, target: Combatant): DefenseOutcome {
  const d = target.defense?.();
  if (!d || d.mode === 'none') return HIT;
  if (!isFrontal(target, d.facing, hit.owner)) return HIT;
  if (d.mode === 'parry') return hit.attack.parryable ? PARRIED : HIT;
  if (!hit.attack.blockable) return HIT;
  const staminaCost = Math.round(hit.attack.guardStaminaDamage * (1 - GUARD.stability));
  return { kind: 'block', staminaCost, guardBroken: staminaCost >= d.stamina };
}
