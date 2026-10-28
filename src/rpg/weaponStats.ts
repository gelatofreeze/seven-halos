import type { AttackDefinition } from '../combat/types';
import { getAttack, getWeapon, type WeaponDefinition } from '../data/weapons';

/** Headline numbers for menus and comparisons, derived from attack data. */
export interface WeaponStats {
  /** First light hit, after upgrade scaling. */
  light: number;
  /** Whole light combo. */
  combo: number;
  heavy: number;
  /** Fully charged heavy. */
  charged: number;
  posture: number;
  /** Furthest hitbox edge of the light combo, px from the feet. */
  reach: number;
  /** Light attack startup, 60 Hz frames (lower is faster). */
  startup: number;
  /** Stamina for the first light attack. */
  stamina: number;
}

export const WEAPON_STAT_LABELS: Record<keyof WeaponStats, string> = {
  light: 'Light',
  combo: 'Combo',
  heavy: 'Heavy',
  charged: 'Charged',
  posture: 'Posture',
  reach: 'Reach',
  startup: 'Startup',
  stamina: 'Stamina',
};

/** Stats where a smaller number is better. */
export const LOWER_IS_BETTER: ReadonlySet<keyof WeaponStats> = new Set(['startup', 'stamina']);

const total = (a: AttackDefinition) => Object.values(a.damage).reduce((s, v) => s + (v ?? 0), 0);

function comboOf(weapon: WeaponDefinition): AttackDefinition[] {
  const chain: AttackDefinition[] = [];
  let id: string | undefined = weapon.moveset.light;
  while (id && chain.length < 8) {
    const a = getAttack(id);
    chain.push(a);
    id = a.next;
  }
  return chain;
}

export function damageMultiplierAt(weapon: WeaponDefinition, level: number): number {
  return 1 + weapon.upgrade.damagePerLevel * Math.max(0, Math.min(weapon.upgrade.maxLevel, level));
}

export function weaponStats(weaponId: string, level: number): WeaponStats {
  const weapon = getWeapon(weaponId);
  const m = damageMultiplierAt(weapon, level);
  const combo = comboOf(weapon);
  const first = combo[0]!;
  const heavy = getAttack(weapon.moveset.heavy);
  const chargeMult = heavy.charge?.maxDamageMultiplier ?? 1;
  let reach = 0;
  for (const a of combo) for (const hb of a.hitboxes) reach = Math.max(reach, hb.x + hb.w);
  return {
    light: Math.round(total(first) * m),
    combo: Math.round(combo.reduce((s, a) => s + total(a), 0) * m),
    heavy: Math.round(total(heavy) * m),
    charged: Math.round(total(heavy) * chargeMult * m),
    posture: first.postureDamage,
    reach,
    startup: first.startupFrames,
    stamina: first.staminaCost,
  };
}

/** Signed per-stat difference `candidate - reference`. */
export function compareStats(candidate: WeaponStats, reference: WeaponStats): Record<keyof WeaponStats, number> {
  const out = {} as Record<keyof WeaponStats, number>;
  for (const k of Object.keys(candidate) as (keyof WeaponStats)[]) out[k] = candidate[k] - reference[k];
  return out;
}
