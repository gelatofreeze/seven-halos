/**
 * NPCs are data: who they are, where they stand (a region anchor) and what
 * they say (a dialogue id). The simulation turns them into interactable world
 * objects in their region; their look is a visual key in
 * render/views/npcVisuals.ts. Merchants and other roles later add fields here.
 */
export interface NpcDef {
  id: string;
  /** Display name. Provisional names stay generic until approved. */
  name: string;
  region: string;
  anchor: string;
  facing?: 1 | -1;
  /** Visual key (render/views/npcVisuals.ts). */
  visual: string;
  dialogue: string;
  /** Talk zone around the feet, px. */
  reach?: { w: number; h: number };
}

export const NPCS: Record<string, NpcDef> = {
  oracle: { id: 'oracle', name: 'The Oracle', region: 'sanctuary-outskirts', anchor: 'npc.oracle', facing: 1, visual: 'oracle', dialogue: 'oracle' },
};

export function npcsIn(region: string): NpcDef[] {
  return Object.values(NPCS).filter((n) => n.region === region);
}
