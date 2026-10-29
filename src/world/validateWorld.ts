import { ENEMIES } from '../data/enemies';
import { ITEMS } from '../data/items';
import { LORE } from '../data/lore';
import { PLAYER_MOVEMENT } from '../config/movement';
import { parseLevel, TILE, type LevelData, type WorldObject } from './Level';
import { REGIONS, WORLD_START, type RegionDefinition } from './regions';

/** Stable ids: lower-case words joined by `.` or `-` (e.g. `forest.cache.canopy`). */
const ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

/**
 * Cross-checks world content and returns one message per problem (empty =
 * valid). Run by the test suite (`tests/world-content.test.ts`).
 */
export function validateWorld(regions: readonly RegionDefinition[] = REGIONS, start = WORLD_START): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);
  const levels = new Map<string, LevelData>();
  const regionIds = new Set<string>();
  for (const def of regions) {
    if (regionIds.has(def.id)) err(`duplicate region id "${def.id}"`);
    regionIds.add(def.id);
    if (!ID_PATTERN.test(def.id)) err(`region id "${def.id}" is not a valid stable id`);
    try {
      levels.set(def.id, parseLevel(def));
    } catch (e) {
      err(`region "${def.id}": ${(e as Error).message}`);
    }
  }

  const globalIds = new Map<string, string>();
  for (const [id, level] of levels) {
    const where = `region "${id}"`;
    for (const ch of level.unknownMarkers) err(`${where}: unknown marker "${ch}"`);
    for (const dup of level.duplicateIds) err(`${where}: id "${dup}" is placed more than once`);
    for (const d of level.unresolvedDecor) err(`${where}: decoration "${d}" is placed relative to nothing`);
    for (const a of Object.values(level.anchors)) {
      if (!ID_PATTERN.test(a.id)) err(`${where}: anchor id "${a.id}" is not a valid stable id`);
      if (!standable(level, Math.floor(a.x / level.tileSize), a.y / level.tileSize - 1)) err(`${where}: anchor "${a.id}" is not standing on open ground`);
      for (const o of level.objects) if (o.kind === 'exit' && !o.interact && inside(a.x, a.y - 1, o)) err(`${where}: anchor "${a.id}" is inside exit "${o.id}" (arrivals would bounce straight back)`);
    }
    for (const s of level.enemySpawns) if (!ENEMIES[s.enemyId]) err(`${where}: unknown enemy "${s.enemyId}"`);
    for (const o of level.objects) {
      if (!ID_PATTERN.test(o.id)) err(`${where}: object id "${o.id}" is not a valid stable id`);
      // Checkpoint and cache ids are saved, so they must be unique across the whole world.
      if (o.kind !== 'exit') {
        const other = globalIds.get(o.id);
        if (other) err(`${where}: persistent id "${o.id}" is also used in region "${other}"`);
        globalIds.set(o.id, id);
      }
      if (o.kind === 'lore' && !LORE[o.id]) err(`${where}: lore marker names unknown entry "${o.id}"`);
      if (o.kind === 'cache') {
        for (const it of o.reward.items ?? []) {
          if (!ITEMS[it.item]) err(`${where}: cache "${o.id}" rewards unknown item "${it.item}"`);
          if (!(Number.isInteger(it.quantity) && it.quantity > 0)) err(`${where}: cache "${o.id}" has an invalid quantity`);
        }
        for (const v of [o.reward.gold, o.reward.weaponXp]) if (v !== undefined && !(Number.isInteger(v) && v >= 0)) err(`${where}: cache "${o.id}" has an invalid currency amount`);
      }
      if (o.kind === 'exit') {
        const dest = levels.get(o.to.region);
        const destDef = regions.find((r) => r.id === o.to.region);
        if (!dest) err(`${where}: exit "${o.id}" leads to unknown region "${o.to.region}"`);
        else if (!dest.anchors[o.to.anchor]) err(`${where}: exit "${o.id}" leads to missing anchor "${o.to.anchor}" in "${o.to.region}"`);
        else if (!dest.objects.some((b) => b.kind === 'exit' && b.to.region === id)) err(`${where}: exit "${o.id}" has no way back from "${o.to.region}"`);
        if (destDef?.dev && !regions.find((r) => r.id === id)?.dev) err(`${where}: exit "${o.id}" leads into a development-only region`);
      }
    }
    // Every object can be reached from every arrival point (a jump-reach heuristic, not a physics proof;
    // tests/traversal.test.ts and tests/air-jump.test.ts prove the key routes with real movement).
    // Objects listed in `needsAirJump` must instead be out of base reach and within air-jump reach.
    const def = regions.find((r) => r.id === id);
    const gated = new Set(def?.needsAirJump ?? []);
    for (const g of gated) if (!level.objects.some((o) => o.id === g)) err(`${where}: needsAirJump names unknown object "${g}"`);
    const baseUp = Math.floor(PLAYER_MOVEMENT.jump.height / level.tileSize);
    const airUp = Math.floor((PLAYER_MOVEMENT.jump.height + PLAYER_MOVEMENT.airJump.height) / level.tileSize);
    for (const a of Object.values(level.anchors)) {
      const start = [Math.floor(a.x / level.tileSize), a.y / level.tileSize - 1] as const;
      const reach = reachable(level, start[0], start[1], baseUp);
      const airReach = gated.size ? reachable(level, start[0], start[1], airUp) : reach;
      for (const o of level.objects) {
        const cell = key(Math.floor(o.x / level.tileSize), o.y / level.tileSize - 1);
        if (!gated.has(o.id)) {
          if (!reach.has(cell)) err(`${where}: "${o.id}" can't be reached from anchor "${a.id}"`);
        } else if (gated.has(o.id) && !gated.has(a.id)) {
          if (reach.has(cell)) err(`${where}: "${o.id}" needs an air jump but the base jump already reaches it from "${a.id}"`);
          if (!airReach.has(cell)) err(`${where}: "${o.id}" can't be reached from anchor "${a.id}" even with an air jump`);
        }
      }
    }
  }

  if (!levels.get(start.region)?.anchors[start.anchor]) err(`world start ${start.region}:${start.anchor} does not exist`);
  // Every shipping region is connected to the start.
  const seen = new Set<string>([start.region]);
  const queue = [start.region];
  while (queue.length) {
    const level = levels.get(queue.shift()!);
    for (const o of level?.objects ?? []) {
      if (o.kind === 'exit' && !seen.has(o.to.region)) {
        seen.add(o.to.region);
        queue.push(o.to.region);
      }
    }
  }
  for (const def of regions) if (!def.dev && levels.has(def.id) && !seen.has(def.id)) err(`region "${def.id}" can't be reached from the world start`);
  return errors;
}

function inside(x: number, y: number, o: WorldObject): boolean {
  return x >= o.zone.x && x < o.zone.x + o.zone.w && y >= o.zone.y && y < o.zone.y + o.zone.h;
}

const key = (c: number, r: number) => `${c},${r}`;

function tileAt(level: LevelData, c: number, r: number): number {
  if (c < 0 || c >= level.cols) return TILE.solid;
  if (r < 0) return TILE.empty;
  return level.tiles[r]?.[c] ?? TILE.solid;
}

/** The player (two tiles tall) can stand with feet in cell (c, r). */
function standable(level: LevelData, c: number, r: number): boolean {
  return tileAt(level, c, r) !== TILE.solid && tileAt(level, c, r - 1) !== TILE.solid && tileAt(level, c, r + 1) !== TILE.empty;
}

/** Where a body dropped into column c from row r lands (falling through empty and one-way tiles if `through`). */
function landing(level: LevelData, c: number, r: number): number | null {
  for (let y = r; y < level.rows; y++) {
    if (tileAt(level, c, y) === TILE.solid) return null;
    if (standable(level, c, y)) return y;
  }
  return null;
}

/**
 * Standing cells reachable from (c, r): walk, fall, drop through one-way
 * platforms, and jump up to `up` whole tiles and a conservative horizontal
 * distance. Ceilings are ignored.
 */
function reachable(level: LevelData, c0: number, r0: number, up: number): Set<string> {
  const across = 5;
  const seen = new Set<string>();
  const queue: [number, number][] = [[c0, r0]];
  seen.add(key(c0, r0));
  const visit = (c: number, r: number | null) => {
    if (r === null || !standable(level, c, r) || seen.has(key(c, r))) return;
    seen.add(key(c, r));
    queue.push([c, r]);
  };
  while (queue.length) {
    const [c, r] = queue.shift()!;
    for (const dc of [-1, 1]) {
      if (tileAt(level, c + dc, r) !== TILE.solid && tileAt(level, c + dc, r - 1) !== TILE.solid) visit(c + dc, landing(level, c + dc, r));
    }
    if (tileAt(level, c, r + 1) === TILE.oneWay) visit(c, landing(level, c, r + 1));
    for (let dr = 1; dr <= up; dr++) for (let dc = -across; dc <= across; dc++) visit(c + dc, r - dr);
    for (let dc = -across; dc <= across; dc++) if (dc !== 0) visit(c + dc, r);
    // Jumping across a gap and falling short onto lower ground.
    for (let dc = -across; dc <= across; dc++) if (Math.abs(dc) > 1 && tileAt(level, c + dc, r) !== TILE.solid) visit(c + dc, landing(level, c + dc, r));
  }
  return seen;
}
