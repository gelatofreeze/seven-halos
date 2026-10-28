import type { Rect } from '../core/Rect';
import type { Facing } from '../core/math';
import type { Solid } from '../physics/CollisionWorld';

export const TILE = { empty: 0, solid: 1, oneWay: 2 } as const;
export type TileKind = (typeof TILE)[keyof typeof TILE];

/** Decorative props (no gameplay). */
export type PropKind = 'shrine' | 'brazier' | 'lore' | 'altar' | 'tree' | 'bush' | 'ruin' | 'plinth' | 'sanctuary' | 'gate';

/** A one-time reward, e.g. a treasure cache. Items must exist in data/items.ts. */
export interface CacheReward {
  items?: readonly { item: string; quantity: number }[];
  gold?: number;
  weaponXp?: number;
}

/**
 * What a character in a level's ASCII rows means. Markers with an `id` are
 * stable world objects and must appear exactly once in their level.
 */
export type MarkerDef =
  /** A named arrival point (region entries, future NPC places). */
  | { type: 'anchor'; id: string; facing?: Facing }
  | { type: 'enemy'; enemy: string }
  | { type: 'prop'; prop: PropKind }
  /** A shrine checkpoint: activated, rested at and travelled to. Also an arrival point. */
  | { type: 'checkpoint'; id: string; name: string; facing?: Facing }
  /** A one-time treasure cache. */
  | { type: 'cache'; id: string; reward: CacheReward }
  /**
   * A doorway to another region. Walk-in by default; `interact: true` makes it
   * a door the player chooses to open. The zone covers `width` × `height`
   * tiles, with the marker at its bottom-left.
   */
  | { type: 'exit'; id: string; to: { region: string; anchor: string }; width?: number; height?: number; interact?: boolean; label?: string };

/** The legend every level gets; a level's own `markers` add to or override it. */
export const DEFAULT_MARKERS: Readonly<Record<string, MarkerDef>> = {
  P: { type: 'anchor', id: 'start', facing: 1 },
  E: { type: 'enemy', enemy: 'hollow-sentinel' },
  R: { type: 'enemy', enemy: 'barrow-reaper' },
  S: { type: 'prop', prop: 'shrine' },
  B: { type: 'prop', prop: 'brazier' },
  L: { type: 'prop', prop: 'lore' },
  A: { type: 'prop', prop: 'altar' },
};

/** Per-region look. Optional; everything has a default. */
export interface EnvironmentConfig {
  /** Backdrop palette: the original moonlit ruins, or a forest variant. */
  backdrop?: 'ruins' | 'forest' | 'sanctuary';
  /** Tint of the drifting motes. */
  motes?: readonly number[];
  moteDensity?: number;
}

export interface LevelDefinition {
  id: string;
  name: string;
  tileSize: number;
  /**
   * ASCII rows, top to bottom. `#` solid stone, `=` one-way platform, `.` or
   * space empty; any other character is looked up in `markers` (then in
   * `DEFAULT_MARKERS`). Markers sit on the tile the object stands in (feet at
   * the tile's bottom).
   */
  rows: readonly string[];
  markers?: Readonly<Record<string, MarkerDef>>;
  environment?: EnvironmentConfig;
  /**
   * How defeated ordinary enemies come back: `rest` (stay down until the
   * player rests or dies; the world rule) or `timer` (their own respawn delay;
   * training rooms).
   */
  enemyRespawn?: 'rest' | 'timer';
}

export interface Anchor {
  id: string;
  x: number;
  y: number;
  facing: Facing;
}

export interface EnemySpawn {
  /** Stable within the level: `<level>.enemy.<n>` in reading order. */
  id: string;
  enemyId: string;
  x: number;
  y: number;
}

export interface CheckpointObject {
  kind: 'checkpoint';
  id: string;
  name: string;
  x: number;
  y: number;
  zone: Rect;
}

export interface CacheObject {
  kind: 'cache';
  id: string;
  reward: CacheReward;
  x: number;
  y: number;
  zone: Rect;
}

export interface ExitObject {
  kind: 'exit';
  id: string;
  to: { region: string; anchor: string };
  interact: boolean;
  label: string;
  x: number;
  y: number;
  zone: Rect;
}

export type WorldObject = CheckpointObject | CacheObject | ExitObject;

export interface LevelData {
  id: string;
  name: string;
  tileSize: number;
  cols: number;
  rows: number;
  widthPx: number;
  heightPx: number;
  /** tiles[row][col] */
  tiles: TileKind[][];
  solids: Solid[];
  /** Default arrival: the `start` anchor, else the first anchor or checkpoint. */
  playerSpawn: { x: number; y: number };
  /** Arrival points by id (anchors and checkpoints). */
  anchors: Record<string, Anchor>;
  enemySpawns: EnemySpawn[];
  props: { kind: PropKind; x: number; y: number }[];
  objects: WorldObject[];
  environment: EnvironmentConfig;
  enemyRespawn: 'rest' | 'timer';
  /** Characters with no meaning (content errors, reported by validation). */
  unknownMarkers: string[];
  /** Marker ids seen more than once (content errors). */
  duplicateIds: string[];
}

/** One-way platforms are thin: only their top edge collides. */
const ONE_WAY_THICKNESS = 6;
/** Interaction zone sizes around a shrine or cache, px. */
const CHECKPOINT_ZONE = { w: 36, h: 44 };
const CACHE_ZONE = { w: 28, h: 28 };

export function parseLevel(def: LevelDefinition): LevelData {
  const ts = def.tileSize;
  const rows = def.rows.length;
  const cols = Math.max(...def.rows.map((r) => r.length));
  const legend = { ...DEFAULT_MARKERS, ...def.markers };
  const tiles: TileKind[][] = [];
  const anchors: Record<string, Anchor> = {};
  const enemySpawns: EnemySpawn[] = [];
  const props: LevelData['props'] = [];
  const objects: WorldObject[] = [];
  const unknown = new Set<string>();
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const claim = (id: string) => {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  };

  for (let r = 0; r < rows; r++) {
    const line = def.rows[r] ?? '';
    const row: TileKind[] = [];
    for (let c = 0; c < cols; c++) {
      const ch = line[c] ?? '.';
      row.push(ch === '#' ? TILE.solid : ch === '=' ? TILE.oneWay : TILE.empty);
      if (ch === '#' || ch === '=' || ch === '.' || ch === ' ') continue;
      const m = legend[ch];
      if (!m) {
        unknown.add(ch);
        continue;
      }
      const x = c * ts + ts / 2;
      const y = (r + 1) * ts;
      switch (m.type) {
        case 'anchor':
          claim(m.id);
          anchors[m.id] = { id: m.id, x, y, facing: m.facing ?? 1 };
          break;
        case 'enemy':
          enemySpawns.push({ id: `${def.id}.enemy.${enemySpawns.length}`, enemyId: m.enemy, x, y });
          break;
        case 'prop':
          props.push({ kind: m.prop, x, y });
          break;
        case 'checkpoint':
          claim(m.id);
          anchors[m.id] = { id: m.id, x, y, facing: m.facing ?? 1 };
          objects.push({ kind: 'checkpoint', id: m.id, name: m.name, x, y, zone: { x: x - CHECKPOINT_ZONE.w / 2, y: y - CHECKPOINT_ZONE.h, w: CHECKPOINT_ZONE.w, h: CHECKPOINT_ZONE.h } });
          break;
        case 'cache':
          claim(m.id);
          objects.push({ kind: 'cache', id: m.id, reward: m.reward, x, y, zone: { x: x - CACHE_ZONE.w / 2, y: y - CACHE_ZONE.h, w: CACHE_ZONE.w, h: CACHE_ZONE.h } });
          break;
        case 'exit': {
          claim(m.id);
          const w = (m.width ?? 1) * ts;
          const h = (m.height ?? 3) * ts;
          objects.push({ kind: 'exit', id: m.id, to: m.to, interact: m.interact ?? false, label: m.label ?? 'Enter', x, y, zone: { x: c * ts, y: y - h, w, h } });
          break;
        }
      }
    }
    tiles.push(row);
  }
  const firstArrival = anchors.start ?? Object.values(anchors)[0];
  if (!firstArrival) throw new Error(`Level ${def.id} has no arrival point (P, an anchor or a checkpoint)`);

  return {
    id: def.id,
    name: def.name,
    tileSize: ts,
    cols,
    rows,
    widthPx: cols * ts,
    heightPx: rows * ts,
    tiles,
    solids: buildSolids(tiles, ts),
    playerSpawn: { x: firstArrival.x, y: firstArrival.y },
    anchors,
    enemySpawns,
    props,
    objects,
    environment: def.environment ?? {},
    enemyRespawn: def.enemyRespawn ?? 'timer',
    unknownMarkers: [...unknown],
    duplicateIds: [...duplicates],
  };
}

/**
 * Merge tiles into as few rectangles as possible: horizontal runs per row,
 * then identical runs stacked in consecutive rows. Fewer, larger solids make
 * collision both faster and free of seams between tiles.
 */
export function buildSolids(tiles: readonly (readonly TileKind[])[], ts: number): Solid[] {
  const solids: Solid[] = [];
  const open = new Map<string, Solid>();
  for (let r = 0; r < tiles.length; r++) {
    const row = tiles[r]!;
    const seen = new Set<string>();
    let c = 0;
    while (c < row.length) {
      const kind = row[c]!;
      if (kind === TILE.empty) {
        c++;
        continue;
      }
      const start = c;
      while (c < row.length && row[c] === kind) c++;
      const key = `${kind}:${start}:${c}`;
      const above = kind === TILE.solid ? open.get(key) : undefined;
      if (above && above.y + above.h === r * ts) {
        above.h += ts;
      } else {
        const solid: Solid = {
          x: start * ts,
          y: r * ts,
          w: (c - start) * ts,
          h: kind === TILE.oneWay ? ONE_WAY_THICKNESS : ts,
          oneWay: kind === TILE.oneWay,
        };
        solids.push(solid);
        if (kind === TILE.solid) open.set(key, solid);
      }
      seen.add(key);
    }
    for (const key of open.keys()) if (!seen.has(key)) open.delete(key);
  }
  return solids;
}
