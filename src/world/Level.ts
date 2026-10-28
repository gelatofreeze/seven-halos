import type { Solid } from '../physics/CollisionWorld';

export const TILE = { empty: 0, solid: 1, oneWay: 2 } as const;
export type TileKind = (typeof TILE)[keyof typeof TILE];

export type PropKind = 'shrine' | 'brazier' | 'lore' | 'altar';

export interface LevelDefinition {
  id: string;
  name: string;
  tileSize: number;
  /**
   * ASCII rows, top to bottom. Legend:
   *   #  solid stone          =  one-way platform
   *   P  player spawn         E  Hollow Sentinel   R  Barrow Reaper
   *   S  shrine (checkpoint)  B  brazier light     L  lore / secret marker
   *   A  armoury altar (holds test equipment in development builds)
   * Markers are placed on the tile the entity stands in (feet at the tile's bottom).
   */
  rows: readonly string[];
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
  playerSpawn: { x: number; y: number };
  enemySpawns: { enemyId: string; x: number; y: number }[];
  props: { kind: PropKind; x: number; y: number }[];
}

/** One-way platforms are thin: only their top edge collides. */
const ONE_WAY_THICKNESS = 6;

export function parseLevel(def: LevelDefinition): LevelData {
  const ts = def.tileSize;
  const rows = def.rows.length;
  const cols = Math.max(...def.rows.map((r) => r.length));
  const tiles: TileKind[][] = [];
  let playerSpawn: { x: number; y: number } | null = null;
  const enemySpawns: LevelData['enemySpawns'] = [];
  const props: LevelData['props'] = [];

  for (let r = 0; r < rows; r++) {
    const line = def.rows[r] ?? '';
    const row: TileKind[] = [];
    for (let c = 0; c < cols; c++) {
      const ch = line[c] ?? '.';
      const footX = c * ts + ts / 2;
      const footY = (r + 1) * ts;
      row.push(ch === '#' ? TILE.solid : ch === '=' ? TILE.oneWay : TILE.empty);
      if (ch === 'P') playerSpawn = { x: footX, y: footY };
      else if (ch === 'E') enemySpawns.push({ enemyId: 'hollow-sentinel', x: footX, y: footY });
      else if (ch === 'R') enemySpawns.push({ enemyId: 'barrow-reaper', x: footX, y: footY });
      else if (ch === 'A') props.push({ kind: 'altar', x: footX, y: footY });
      else if (ch === 'S') props.push({ kind: 'shrine', x: footX, y: footY });
      else if (ch === 'B') props.push({ kind: 'brazier', x: footX, y: footY });
      else if (ch === 'L') props.push({ kind: 'lore', x: footX, y: footY });
    }
    tiles.push(row);
  }
  if (!playerSpawn) throw new Error(`Level ${def.id} has no player spawn (P)`);

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
    playerSpawn,
    enemySpawns,
    props,
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
