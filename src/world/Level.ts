import type { Rect } from '../core/Rect';
import type { Facing } from '../core/math';
import type { Solid } from '../physics/CollisionWorld';

export const TILE = { empty: 0, solid: 1, oneWay: 2 } as const;
export type TileKind = (typeof TILE)[keyof typeof TILE];

/** Decorative props (no gameplay). Textures and lights live in render/environment/props.ts. */
export type PropKind =
  | 'shrine'
  | 'brazier'
  | 'torch'
  | 'torchPost'
  | 'lore'
  | 'altar'
  | 'tree'
  | 'ancientTree'
  | 'bush'
  | 'flowers'
  | 'ruin'
  | 'fallenColumn'
  | 'colonnade'
  | 'plinth'
  | 'sanctuaryWall'
  | 'sanctuaryFrame'
  | 'sanctuaryIvy'
  | 'gable'
  | 'halo'
  | 'doorArch'
  | 'lightShaft'
  | 'waymarker'
  | 'bridgeRuin'
  | 'stream'
  | 'shrineArch'
  | 'gate'
  | 'treeRoots'
  | 'rootHollow'
  | 'hangingRoots'
  | 'ivy'
  | 'rubble'
  | 'fern'
  | 'glowMoss'
  | 'stalagmite';

/**
 * Draw layers for decoration, back to front. Gameplay never reads them.
 * far: distant architecture · back: walls and frames behind the playfield ·
 * mid: props at the playfield (default) · front: low foreground accents.
 */
export type DecorLayer = 'far' | 'back' | 'mid' | 'front';

/**
 * Decoration placed relative to a named point, in pixels, instead of on a
 * tile marker. This is how a backdrop and the object it frames share one
 * exact centre (the sanctuary's hall, window and shrine), and how symmetric
 * pairs are authored once (`mirror`).
 */
export interface DecorPlacement {
  prop: PropKind;
  /** An anchor or world-object id in this level, or a tile `{ col, row }` (the tile's bottom centre). */
  at: string | { col: number; row: number };
  /** Offset from `at`, px (+x right, +y down). */
  dx?: number;
  dy?: number;
  /** Also place a mirrored copy at -dx (a symmetric pair around `at`). */
  mirror?: boolean;
  layer?: DecorLayer;
}

/** A one-time reward, e.g. a treasure cache. Items must exist in data/items.ts. */
export interface CacheReward {
  items?: readonly { item: string; quantity: number }[];
  gold?: number;
  weaponXp?: number;
}

export type CacheLook = 'chest' | 'relic';

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
  /**
   * A one-time treasure cache. `look: 'relic'` shows a single treasure set out
   * on a stone (e.g. a ring) instead of a chest; the rules are the same.
   */
  | { type: 'cache'; id: string; reward: CacheReward; look?: CacheLook }
  /** Something readable (an inscription, a book): `lore` is an entry in data/lore.ts. Drawn as a lore stone. */
  | { type: 'lore'; lore: string }
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
  /** Backdrop palette: the original moonlit ruins, a forest variant, or underground (no sky). */
  backdrop?: 'ruins' | 'forest' | 'sanctuary' | 'cave';
  /**
   * What `#` and `=` look like: worked stone, earth with roots and branches,
   * or natural cave rock with rock shelves. `%` and `-` are always masonry.
   */
  ground?: 'stone' | 'earth' | 'rock';
  /** Fireflies drifting low over the ground (forests). */
  fireflies?: number;
  /**
   * A distant landmark in the parallax backdrop (behind the far tree line),
   * seen most clearly when the camera is near world x `x`: where the road leads.
   */
  landmark?: { kind: 'castle'; x: number };
  /** Tint of the drifting motes. */
  motes?: readonly number[];
  moteDensity?: number;
}

export interface LevelDefinition {
  id: string;
  name: string;
  tileSize: number;
  /**
   * ASCII rows, top to bottom. `#` solid ground, `=` one-way platform, `%`
   * solid masonry, `-` one-way masonry slab, `.` or space empty; any other
   * character is looked up in `markers` (then in `DEFAULT_MARKERS`). Markers sit on the tile the object stands in (feet at
   * the tile's bottom).
   */
  rows: readonly string[];
  markers?: Readonly<Record<string, MarkerDef>>;
  /** Decoration placed by anchor and offset (see `DecorPlacement`). */
  decor?: readonly DecorPlacement[];
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
  look: CacheLook;
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

export interface LoreObject {
  kind: 'lore';
  /** The lore entry id (stable; also the object's id). */
  id: string;
  x: number;
  y: number;
  zone: Rect;
}

/** An NPC standing in the world. Built by the simulation from data/npcs.ts, not by the level parser. */
export interface NpcObject {
  kind: 'npc';
  id: string;
  name: string;
  dialogue: string;
  visual: string;
  facing: Facing;
  x: number;
  y: number;
  zone: Rect;
}

export type WorldObject = CheckpointObject | CacheObject | ExitObject | LoreObject | NpcObject;

/**
 * When the player stands where several objects' zones overlap, the highest
 * priority wins (then the nearest): talking to someone beats reading, which
 * beats using a shrine. One press acts on one object only.
 */
export const FOCUS_PRIORITY: Record<WorldObject['kind'], number> = { npc: 4, lore: 3, cache: 3, checkpoint: 2, exit: 1 };

export interface Prop {
  kind: PropKind;
  /** Bottom centre, px. */
  x: number;
  y: number;
  layer: DecorLayer;
  /** Mirrored horizontally (the second of a `mirror` pair). */
  flip: boolean;
}

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
  /** Decoration from tile markers and from `decor` placements, in authoring order. */
  props: Prop[];
  objects: WorldObject[];
  /** masonry[row][col]: the tile is worked stone (`%`, `-`) whatever the region's ground. */
  masonry: boolean[][];
  /** `decor` placements whose `at` names nothing in the level (content errors). */
  unresolvedDecor: string[];
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
  const masonry: boolean[][] = [];
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
    const stone: boolean[] = [];
    for (let c = 0; c < cols; c++) {
      const ch = line[c] ?? '.';
      row.push(ch === '#' || ch === '%' ? TILE.solid : ch === '=' || ch === '-' ? TILE.oneWay : TILE.empty);
      stone.push(ch === '%' || ch === '-');
      if (ch === '#' || ch === '=' || ch === '%' || ch === '-' || ch === '.' || ch === ' ') continue;
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
          props.push({ kind: m.prop, x, y, layer: 'mid', flip: false });
          break;
        case 'checkpoint':
          claim(m.id);
          anchors[m.id] = { id: m.id, x, y, facing: m.facing ?? 1 };
          objects.push({ kind: 'checkpoint', id: m.id, name: m.name, x, y, zone: { x: x - CHECKPOINT_ZONE.w / 2, y: y - CHECKPOINT_ZONE.h, w: CHECKPOINT_ZONE.w, h: CHECKPOINT_ZONE.h } });
          break;
        case 'cache':
          claim(m.id);
          objects.push({ kind: 'cache', id: m.id, reward: m.reward, look: m.look ?? 'chest', x, y, zone: { x: x - CACHE_ZONE.w / 2, y: y - CACHE_ZONE.h, w: CACHE_ZONE.w, h: CACHE_ZONE.h } });
          break;
        case 'lore':
          claim(m.lore);
          objects.push({ kind: 'lore', id: m.lore, x, y, zone: { x: x - CACHE_ZONE.w / 2, y: y - CACHE_ZONE.h, w: CACHE_ZONE.w, h: CACHE_ZONE.h } });
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
    masonry.push(stone);
  }

  // Anchor-relative decoration. Resolved after the markers so `at` can name any of them.
  const unresolvedDecor: string[] = [];
  for (const d of def.decor ?? []) {
    let base: { x: number; y: number } | undefined;
    if (typeof d.at === 'string') base = anchors[d.at] ?? objects.find((o) => o.id === d.at);
    else base = { x: d.at.col * ts + ts / 2, y: (d.at.row + 1) * ts };
    if (!base) {
      unresolvedDecor.push(`${d.prop} @ ${String(d.at)}`);
      continue;
    }
    const dx = d.dx ?? 0;
    const y = base.y + (d.dy ?? 0);
    const layer = d.layer ?? 'mid';
    props.push({ kind: d.prop, x: base.x + dx, y, layer, flip: false });
    if (d.mirror && dx !== 0) props.push({ kind: d.prop, x: base.x - dx, y, layer, flip: true });
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
    masonry,
    unresolvedDecor,
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
