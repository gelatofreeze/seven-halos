import type { CombatStats } from '../combat/types';

/**
 * Character attributes. Only what combat already consumes is wired up;
 * leveling, class templates and scaling curves build on this shape.
 */
export interface Attributes {
  vigor: number;
  endurance: number;
  strength: number;
  dexterity: number;
}

export const STARTING_ATTRIBUTES: Attributes = { vigor: 10, endurance: 10, strength: 10, dexterity: 10 };

/** Placeholder scaling: +2% outgoing damage per strength point above 10. */
export function deriveCombatStats(attrs: Attributes): CombatStats {
  return {
    defense: 0,
    absorption: 0,
    attackMultiplier: 1 + Math.max(0, attrs.strength - 10) * 0.02,
  };
}

