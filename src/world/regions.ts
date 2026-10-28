import { FOREST_ROAD } from '../data/world/forestRoad';
import { SANCTUARY_OUTSKIRTS } from '../data/world/sanctuaryOutskirts';
import { parseLevel, type CheckpointObject, type LevelData, type LevelDefinition } from './Level';

/** A region of the world: a level plus its place in the world. */
export interface RegionDefinition extends LevelDefinition {
  /**
   * Development-only region (the combat test chamber): never saved as the
   * player's location, and death respawns locally instead of at a shrine.
   */
  dev?: boolean;
}

/** A place in the world: a region and an arrival point (an anchor or a checkpoint id) in it. */
export interface WorldLocation {
  region: string;
  anchor: string;
}

/** Shipping regions. A new region is added here (see docs/WORLD.md). */
export const REGIONS: readonly RegionDefinition[] = [SANCTUARY_OUTSKIRTS, FOREST_ROAD];

/** Where a new game begins: just outside the sanctuary. */
export const WORLD_START: WorldLocation = { region: 'sanctuary-outskirts', anchor: 'start' };

const definitions = new Map<string, RegionDefinition>();
const parsed = new Map<string, LevelData>();
for (const r of REGIONS) definitions.set(r.id, r);

/** Development builds add the test chamber here (src/dev/); commercial builds never call it. */
export function registerDevRegion(def: RegionDefinition): void {
  definitions.set(def.id, { ...def, dev: true });
  parsed.delete(def.id);
}

export function hasRegion(id: string): boolean {
  return definitions.has(id);
}

export function getRegionDef(id: string): RegionDefinition {
  const def = definitions.get(id);
  if (!def) throw new Error(`Unknown region: ${id}`);
  return def;
}

/** Parsed level data, built once per region and reused (it's read-only at runtime). */
export function getRegion(id: string): LevelData {
  let level = parsed.get(id);
  if (!level) {
    level = parseLevel(getRegionDef(id));
    parsed.set(id, level);
  }
  return level;
}

export function regionIds(): string[] {
  return [...definitions.keys()];
}

export interface CheckpointInfo {
  id: string;
  name: string;
  region: string;
  regionName: string;
}

/** Every checkpoint in every registered (non-dev) region, in registry order. */
export function allCheckpoints(): CheckpointInfo[] {
  const out: CheckpointInfo[] = [];
  for (const def of definitions.values()) {
    if (def.dev) continue;
    const level = getRegion(def.id);
    for (const o of level.objects) if (o.kind === 'checkpoint') out.push({ id: o.id, name: o.name, region: def.id, regionName: def.name });
  }
  return out;
}

export function findCheckpoint(id: string): CheckpointInfo | undefined {
  return allCheckpoints().find((c) => c.id === id);
}

export function checkpointObject(level: LevelData, id: string): CheckpointObject | undefined {
  return level.objects.find((o): o is CheckpointObject => o.kind === 'checkpoint' && o.id === id);
}

/** Ids of world objects whose state is saved (checkpoints and caches). */
export function persistentObjectIds(): Set<string> {
  const ids = new Set<string>();
  for (const def of definitions.values()) {
    if (def.dev) continue;
    for (const o of getRegion(def.id).objects) if (o.kind !== 'exit') ids.add(o.id);
  }
  return ids;
}

/** True when `loc` names a saveable region and an arrival point that exists in it. */
export function isValidLocation(loc: WorldLocation | null | undefined): loc is WorldLocation {
  if (!loc || typeof loc.region !== 'string' || typeof loc.anchor !== 'string') return false;
  const def = definitions.get(loc.region);
  if (!def || def.dev) return false;
  return !!getRegion(loc.region).anchors[loc.anchor];
}
