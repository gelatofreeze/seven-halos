import { describe, expect, it } from 'vitest';
import { PROP_VISUALS } from '../src/render/environment/props';
import { TILE, type LevelData } from '../src/world/Level';
import { getRegion, REGIONS } from '../src/world/regions';

const tileAt = (l: LevelData, x: number, y: number) => l.tiles[Math.floor(y / l.tileSize)]?.[Math.floor(x / l.tileSize)] ?? TILE.empty;
const solid = (l: LevelData, x: number, y: number) => tileAt(l, x, y) === TILE.solid;
const ground = (l: LevelData, x: number, y: number) => tileAt(l, x, y) !== TILE.empty;

/** Why a placed prop isn't supported, or null when it is. */
function unsupported(level: LevelData, index: number): string | null {
  const p = level.props[index]!;
  const v = PROP_VISUALS[p.kind];
  const { w, h } = v.footprint;
  const ts = level.tileSize;
  switch (v.support) {
    case 'floor': {
      if (p.y % ts !== 0) return `base y ${p.y} is not on a tile edge`;
      const xs = w > 48 ? [p.x - w / 2 + 2, p.x + w / 2 - 2] : [p.x - w / 2 + 2, p.x, p.x + w / 2 - 2];
      for (const x of xs) if (!ground(level, x, p.y + 1)) return `nothing under x ${x}`;
      if (solid(level, p.x, p.y - 1)) return 'buried in solid ground';
      return null;
    }
    case 'embedded': {
      for (const [x, y] of [
        [p.x - w / 2 + 1, p.y - 1],
        [p.x + w / 2 - 1, p.y - 1],
        [p.x - w / 2 + 1, p.y - h + 1],
        [p.x + w / 2 - 1, p.y - h + 1],
      ] as const)
        if (!solid(level, x, y)) return `corner (${x}, ${y}) is not inside masonry`;
      return null;
    }
    case 'mounted': {
      const mx = p.x + (v.mountPoint?.dx ?? 0);
      const my = p.y + (v.mountPoint?.dy ?? 0);
      if (solid(level, mx, my)) return null;
      const onMount = level.props.some((q, j) => j !== index && (PROP_VISUALS[q.kind].mounts ?? []).some((m) => mx >= q.x + m.x && mx < q.x + m.x + m.w && my >= q.y + m.y && my < q.y + m.y + m.h));
      return onMount ? null : `fixing point (${mx}, ${my}) is on nothing`;
    }
    case 'none':
      return null;
  }
}

describe('Prop support', () => {
  for (const def of REGIONS) {
    it(`every prop in ${def.id} stands, hangs or is set on something real`, () => {
      const level = getRegion(def.id);
      const problems = level.props.map((p, i) => [p, unsupported(level, i)] as const).filter(([, why]) => why).map(([p, why]) => `${p.kind} at (${p.x}, ${p.y}): ${why}`);
      expect(problems).toEqual([]);
    });
  }

  it('the support check itself catches floating, overhanging and unmounted props', () => {
    const level = structuredClone(getRegion('sanctuary-outskirts'));
    const shrine = level.objects.find((o) => o.id === 'sanctuary.shrine')!;
    level.props.push({ kind: 'torch', x: shrine.x, y: 40, layer: 'mid', flip: false }); // in the open sky
    level.props.push({ kind: 'brazier', x: shrine.x, y: shrine.y - 20, layer: 'mid', flip: false }); // hovering
    level.props.push({ kind: 'doorArch', x: 400, y: 176, layer: 'mid', flip: false }); // in the opening, not the wall
    const n = level.props.length;
    expect(unsupported(level, n - 3)).toMatch(/fixing point/);
    expect(unsupported(level, n - 2)).toMatch(/not on a tile edge|nothing under/);
    expect(unsupported(level, n - 1)).toMatch(/not inside masonry/);
  });

  it('the sanctuary lintels sit exactly in the walls over the doorways, and the sconces on the outer columns', () => {
    const level = getRegion('sanctuary-outskirts');
    const shrine = level.objects.find((o) => o.id === 'sanctuary.shrine')!;
    const lintels = level.props.filter((p) => p.kind === 'doorArch');
    expect(lintels.map((p) => p.x).sort((a, b) => a - b)).toEqual([shrine.x - 264, shrine.x + 264]);
    for (const l of lintels) {
      // Directly above an open doorway: the two tiles under the lintel are empty (the passage).
      expect(tileAt(level, l.x - 8, l.y + 4)).toBe(TILE.empty);
      expect(tileAt(level, l.x + 8, l.y + 4)).toBe(TILE.empty);
    }
    expect(level.props.filter((p) => p.kind === 'torch').map((p) => Math.abs(p.x - shrine.x))).toEqual([238, 238]);
  });
});
