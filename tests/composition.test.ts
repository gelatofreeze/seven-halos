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

  it('keeps every enemy, the cache, the shrine and both exits of 2C.1', () => {
    expect(forest.enemySpawns.map((e) => e.enemyId).sort()).toEqual(['barrow-reaper', 'hollow-sentinel', 'hollow-sentinel']);
    expect(forest.objects.map((o) => o.id).sort()).toEqual(['forest.cache.canopy', 'forest.shrine', 'forest.to-sanctuary']);
  });
});

describe('Save compatibility', () => {
  it('every id a v3 save can hold still exists, so saved locations stay valid', () => {
    expect(Object.keys(sanctuary.anchors).sort()).toEqual(['from-forest', 'npc.oracle', 'sanctuary.shrine', 'service.merchant', 'service.smith', 'service.storage', 'start'].sort());
    expect(Object.keys(getRegion('forest-road').anchors).sort()).toEqual(['forest.shrine', 'from-sanctuary']);
  });
});
