import { describe, expect, it } from 'vitest';
import { HALL } from '../src/render/textures/architectureArt';
import { TILE } from '../src/world/Level';
import { getRegion } from '../src/world/regions';

const sanctuary = getRegion('sanctuary-outskirts');
const shrine = sanctuary.objects.find((o) => o.id === 'sanctuary.shrine')!;
const ts = sanctuary.tileSize;
const axisCol = (shrine.x - ts / 2) / ts;

describe('Sanctuary composition', () => {
  it('the shrine stands exactly on the hall axis (tile column 41, x = 664)', () => {
    expect(axisCol).toBe(41);
    expect(shrine.x).toBe(664);
  });

  it("the hall's back wall, arcade, light shaft, gable and halo share the shrine's centre", () => {
    for (const kind of ['sanctuaryWall', 'sanctuaryFrame', 'sanctuaryIvy', 'lightShaft', 'gable', 'halo'] as const) {
      const props = sanctuary.props.filter((p) => p.kind === kind);
      expect(props, kind).toHaveLength(1);
      expect(props[0]!.x, kind).toBe(shrine.x);
    }
    // The dominant (central) window is on the texture's centre line, so on the axis too.
    expect(HALL.windows[0]).toMatchObject({ dx: 0 });
    expect(Math.max(...HALL.windows.map((w) => w.w))).toBe(HALL.windows[0]!.w);
  });

  it('the hall is symmetric about the axis: walls, doorways, galleries, roof opening and steps', () => {
    for (let r = 0; r < sanctuary.rows; r++) {
      for (let d = 1; d <= 20; d++) {
        const left = sanctuary.tiles[r]![axisCol - d];
        const right = sanctuary.tiles[r]![axisCol + d];
        expect(`${r}:${d}:${left}`).toBe(`${r}:${d}:${right}`);
      }
    }
    // The roof has an opening right over the shrine.
    expect(sanctuary.tiles[3]![axisCol]).toBe(TILE.empty);
    expect(sanctuary.tiles[3]![axisCol - 4]).toBe(TILE.solid);
  });

  it('the back wall fills the hall exactly between its inner walls', () => {
    const wall = sanctuary.props.find((p) => p.kind === 'sanctuaryWall')!;
    let inner = axisCol;
    while (sanctuary.tiles[5]![inner - 1] === TILE.empty) inner--;
    expect(HALL.w).toBe((axisCol - inner) * 2 * ts + ts);
    expect(wall.x - HALL.w / 2).toBe(inner * ts);
    // Bottom on the hall floor; top under the roof.
    expect(wall.y).toBe(shrine.y);
    expect(wall.y - HALL.h).toBe(4 * ts);
  });

  it('paired decoration is mirrored exactly around the shrine', () => {
    const flipped = sanctuary.props.filter((p) => p.flip);
    expect(flipped.length).toBeGreaterThanOrEqual(5);
    for (const f of flipped) {
      const twin = sanctuary.props.find((p) => !p.flip && p.kind === f.kind && p.y === f.y && p.x === 2 * shrine.x - f.x);
      expect(twin, `${f.kind} at ${f.x}`).toBeDefined();
    }
  });

  it('the reserved NPC and service places come in symmetric pairs off the axis', () => {
    const a = sanctuary.anchors;
    expect(a['service.smith']!.x + a['service.storage']!.x).toBe(2 * shrine.x);
    expect(a['npc.oracle']!.x + a['service.merchant']!.x).toBe(2 * shrine.x);
    for (const id of ['service.smith', 'service.storage', 'npc.oracle', 'service.merchant']) expect(a[id]!.x).not.toBe(shrine.x);
  });
});

describe('Forest composition', () => {
  const forest = getRegion('forest-road');
  const fshrine = forest.objects.find((o) => o.id === 'forest.shrine')!;

  it('the forest shrine is centred on its plateau and its arch', () => {
    const col = (fshrine.x - ts / 2) / ts;
    const row = fshrine.y / ts;
    let l = col;
    let r = col;
    while (forest.masonry[row]![l - 1]) l--;
    while (forest.masonry[row]![r + 1]) r++;
    expect((l + r) / 2).toBe(col);
    expect(forest.props.find((p) => p.kind === 'shrineArch')!.x).toBe(fshrine.x);
  });

  it('keeps every enemy, the cache, the shrine and both exits of 2C.1, plus the way down into the Root Hollow', () => {
    expect(forest.enemySpawns.map((e) => e.enemyId).sort()).toEqual(['barrow-reaper', 'hollow-sentinel', 'hollow-sentinel']);
    expect(forest.objects.map((o) => o.id).sort()).toEqual(['forest.cache.canopy', 'forest.shrine', 'forest.to-hollow', 'forest.to-sanctuary', 'lore.sealed-gate']);
  });

  it('the crossing has no free-floating stone: every masonry tile is held up by the tile below it or by its neighbours in a wall', () => {
    // A one-way slab or block with empty space on every side but one is a floating step; the old
    // deck stones were exactly that. Every masonry tile in the ravine area rests on something solid.
    const ts = forest.tileSize;
    for (let c = 30; c <= 50; c++) {
      for (let r = 0; r < forest.rows; r++) {
        if (!forest.masonry[r]![c]) continue;
        expect(forest.tiles[r]![c], `masonry at ${c},${r} is solid, not a deck slab`).toBe(1);
        const below = forest.tiles[r + 1]?.[c] ?? 1;
        expect(below, `masonry at ${c},${r} (x ${c * ts}) rests on something`).toBe(1);
      }
    }
  });

  it('the ancient tree: its limbs are joined to the trunk, and the hollow sits under its roots', () => {
    const tree = forest.props.find((p) => p.kind === 'ancientTree')!;
    const trunk = { left: tree.x - 32, right: tree.x + 16 };
    const limbs: { r: number; c0: number; c1: number }[] = [];
    for (let r = 0; r < forest.rows; r++) {
      let c = 48;
      while (c < 66) {
        if (forest.tiles[r]![c] === 2) {
          const c0 = c;
          while (forest.tiles[r]![c] === 2) c++;
          limbs.push({ r, c0, c1: c - 1 });
        } else c++;
      }
    }
    expect(limbs.length).toBe(2);
    // Each limb touches the trunk's span (no branch floats off on its own).
    for (const l of limbs) expect(l.c1 * 16 + 16 >= trunk.left - 1 && l.c0 * 16 <= trunk.right + 1, `limb at row ${l.r}`).toBe(true);
    const hollow = forest.objects.find((o) => o.id === 'forest.to-hollow')!;
    expect(Math.abs(hollow.zone.x + hollow.zone.w / 2 - tree.x)).toBeLessThanOrEqual(8);
    expect(forest.props.some((p) => p.kind === 'rootHollow' && Math.abs(p.x - tree.x) <= 8)).toBe(true);
  });
});

describe('Save compatibility', () => {
  it('every id a v3 save can hold still exists, so saved locations stay valid', () => {
    expect(Object.keys(sanctuary.anchors).sort()).toEqual(['from-forest', 'npc.oracle', 'sanctuary.shrine', 'service.merchant', 'service.smith', 'service.storage', 'start'].sort());
    // v3/v4 ids are all still there (the hollow's arrival point is new).
    expect(Object.keys(getRegion('forest-road').anchors).sort()).toEqual(['forest.shrine', 'from-hollow', 'from-sanctuary']);
  });
});
