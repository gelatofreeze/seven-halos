/**
 * Equipment slots, as data. Each slot accepts one slot *type*; items declare
 * which slot types they fit (`ItemDefinition.equip`). The main hand and the
 * two ring slots affect gameplay (rings through their passive effects); the
 * rest are placeholders so the menu, saves and rules already have a home for
 * shields, armour and tools.
 */
export type SlotType = 'weapon' | 'shield' | 'head' | 'chest' | 'legs' | 'boots' | 'ring' | 'tool';
export type SlotId = 'mainHand' | 'offHand' | 'head' | 'chest' | 'legs' | 'boots' | 'ring1' | 'ring2' | 'tool';

export interface SlotDefinition {
  id: SlotId;
  label: string;
  accepts: SlotType;
  /** Must always hold an item (the main hand always holds a weapon). */
  required: boolean;
  /** Has gameplay effect in this build. */
  functional: boolean;
  /** Short placeholder glyph for the empty slot. */
  icon: string;
}

export const EQUIPMENT_SLOTS: readonly SlotDefinition[] = [
  { id: 'mainHand', label: 'Main hand', accepts: 'weapon', required: true, functional: true, icon: '⚔' },
  { id: 'offHand', label: 'Off hand', accepts: 'shield', required: false, functional: false, icon: '⛉' },
  { id: 'head', label: 'Head', accepts: 'head', required: false, functional: false, icon: '◠' },
  { id: 'chest', label: 'Chest', accepts: 'chest', required: false, functional: false, icon: '▣' },
  { id: 'legs', label: 'Legs', accepts: 'legs', required: false, functional: false, icon: '∏' },
  { id: 'boots', label: 'Boots', accepts: 'boots', required: false, functional: false, icon: '⌐' },
  { id: 'ring1', label: 'Ring', accepts: 'ring', required: false, functional: true, icon: '○' },
  { id: 'ring2', label: 'Ring', accepts: 'ring', required: false, functional: true, icon: '○' },
  { id: 'tool', label: 'Tool', accepts: 'tool', required: false, functional: false, icon: '✦' },
];

export const SLOT_IDS: readonly SlotId[] = EQUIPMENT_SLOTS.map((s) => s.id);

export function getSlot(id: SlotId): SlotDefinition {
  const slot = EQUIPMENT_SLOTS.find((s) => s.id === id);
  if (!slot) throw new Error(`Unknown slot: ${id}`);
  return slot;
}

export function isSlotId(v: unknown): v is SlotId {
  return typeof v === 'string' && (SLOT_IDS as readonly string[]).includes(v);
}
