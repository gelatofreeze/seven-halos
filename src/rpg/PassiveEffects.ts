import { getSlot } from '../data/equipmentSlots';
import { ITEMS, type PassiveEffects } from '../data/items';
import { fitsSlot } from './Loadout';
import type { PlayerProfile } from './Profile';

/** The combined effect of everything validly equipped. Every field is always present. */
export type ResolvedEffects = Required<PassiveEffects>;

export const NO_EFFECTS: Readonly<ResolvedEffects> = { extraAirJumps: 0 };

/**
 * How several sources of one effect combine. Extra air jumps don't stack (two
 * copies of a ring give one extra jump, not two), so gated routes are designed
 * against one known number. Additive effects would use a sum here.
 */
const COMBINE: { [K in keyof ResolvedEffects]: (a: number, b: number) => number } = {
  extraAirJumps: Math.max,
};

/**
 * Effects of the items equipped in functional slots they fit. Derived from
 * the loadout every time (never stored), so unequipping removes an effect and
 * a save restores it. Items are looked up by definition, never by name.
 */
export function equippedEffects(profile: PlayerProfile, out: ResolvedEffects = { ...NO_EFFECTS }): ResolvedEffects {
  Object.assign(out, NO_EFFECTS);
  for (const [slot, uid] of profile.loadout.entries()) {
    if (!getSlot(slot).functional) continue;
    const instance = profile.inventory.find(uid);
    if (!instance || !fitsSlot(instance.itemId, slot)) continue;
    const effects = ITEMS[instance.itemId]?.effects;
    if (!effects) continue;
    for (const key of Object.keys(COMBINE) as (keyof ResolvedEffects)[]) {
      const v = effects[key];
      if (v !== undefined) out[key] = COMBINE[key](out[key], v);
    }
  }
  return out;
}

/** Player-facing lines describing an item's passive effects (item details, slot tooltips). */
export function describeEffects(effects: PassiveEffects | undefined): string[] {
  const lines: string[] = [];
  const air = effects?.extraAirJumps ?? 0;
  if (air === 1) lines.push('Jump once more in midair');
  else if (air > 1) lines.push(`Jump ${air} more times in midair`);
  return lines;
}
