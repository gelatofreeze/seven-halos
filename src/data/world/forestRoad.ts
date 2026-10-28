import type { RegionDefinition } from '../../world/regions';

/**
 * Region B — the first forest road, in five beats (west to east):
 * A. Calm entrance (cols 1-21): the waymarker matching the sanctuary's, a
 *    soft rise, flowers and room to breathe before anything hostile.
 * B. Broken bridge (30-50): flush masonry bridgeheads, the old arches below,
 *    the fallen deck as stepping stones one step up. Falling is safe: a step on the east
 *    side climbs back out.
 * C. The ancient tree (50-63): its low branch is in plain sight from the
 *    road; climbing it is optional and leads to the treasure cache, whose
 *    glow shows at the top of the screen from below.
 * D. Ruined clearing (66-100): fallen columns mark its edges; a colonnade
 *    behind, a dais and a perch give the fight terrain; a Reaper, then a
 *    Sentinel, far enough apart to meet one at a time.
 * E. The forest shrine on its plateau under a sacred arch, then stairs up to
 *    the sealed gate; the first castle rises in the distance beyond it (the
 *    backdrop landmark), the destination of a later update.
 */
export const FOREST_ROAD: RegionDefinition = {
  id: 'forest-road',
  name: 'Forest Road',
  tileSize: 16,
  enemyRespawn: 'rest',
  environment: { backdrop: 'forest', ground: 'earth', motes: [0xc8ffb0, 0x9fe8ff, 0xfff2a8], moteDensity: 0.5, fireflies: 1, landmark: { kind: 'castle', x: 2150 } },
  markers: {
    X: { type: 'exit', id: 'forest.to-sanctuary', to: { region: 'sanctuary-outskirts', anchor: 'from-forest' }, height: 4 },
    a: { type: 'anchor', id: 'from-sanctuary', facing: 1 },
    C: { type: 'checkpoint', id: 'forest.shrine', name: 'Forest Road Shrine', facing: -1 },
    T: { type: 'cache', id: 'forest.cache.canopy', reward: { items: [{ item: 'grave-dust', quantity: 3 }], gold: 60, weaponXp: 30 } },
    G: { type: 'prop', prop: 'gate' },
    t: { type: 'prop', prop: 'tree' },
    b: { type: 'prop', prop: 'bush' },
    f: { type: 'prop', prop: 'flowers' },
    o: { type: 'prop', prop: 'fallenColumn' },
    w: { type: 'prop', prop: 'waymarker' },
    // A note at the sealed gate.
    L: { type: 'lore', lore: 'lore.sealed-gate' },
  },
  decor: [
    // B: the old bridge under the crossing, and water far below.
    // Its top meets the bridgeheads' floor line (y 304); its feet go down behind the ravine floor.
    { prop: 'bridgeRuin', at: { col: 40, row: 22 }, dy: 20, layer: 'back' },
    { prop: 'stream', at: { col: 40, row: 22 } },
    // C: the ancient tree, centred under its branches; a shaft of moonlight on the cache.
    { prop: 'ancientTree', at: { col: 56, row: 18 }, layer: 'back' },
    { prop: 'flowers', at: { col: 53, row: 18 } },
    // D: a colonnade behind the clearing.
    { prop: 'colonnade', at: { col: 80, row: 18 }, layer: 'far' },
    { prop: 'ruin', at: { col: 79, row: 18 } },
    // E: the shrine framed by an arch, a brazier either side; the castle far behind the gate.
    { prop: 'shrineArch', at: 'forest.shrine' },
    { prop: 'brazier', at: 'forest.shrine', dx: 48, mirror: true },
    { prop: 'flowers', at: 'forest.shrine', dx: 80, mirror: true },
    // A torch post on the top step lights the way to the gate.
    { prop: 'torchPost', at: { col: 130, row: 14 } },
  ],
  rows: [
    '#...........................................................................................................................................',
    '#...........................................................................................................................................',
    '#...........................................................................................................................................',
    '#.....................................................................................................................................%%%%%%',
    '#.....................................................................................................................................%%%%%%',
    '#.....................................................................................................................................%%%%%%',
    '#.....................................................................................................................................%%%%%%',
    '#.....................................................................................................................................%%%%%%',
    '#.....................................................................................................................................%%%%%%',
    '#.....................................................T...............................................................................%%%%%%',
    '#...................................................=====.............................................................................%%%%%%',
    '#.....................................................................................................................................%%%%%%',
    '#.....................................................................................................................................%%%%%%',
    '#........................................................====.........................................................................%%%%%%',
    '#..................................................................................................................................L.G%%%%%%',
    '#................................................................................................................................%%%%%%%%%%%',
    '#...................................................====..................----...............................................%%%%%%%%%%%%%%%',
    '#...............f...............................................................................................C........%%%%%%%%%%%%%%%%%%%',
    '#X.w.a...t..f.######.bt...t..E......---..---......b..........f.t...o....R.........%%%%%%%...o....E...t..b.%%%%%%%%%%%%%.t%%%%%%%%%%%%%%%%%%%',
    '##############################%%%%.............%%%%#########################################################################################',
    '##############################%%%%.............%%%%#########################################################################################',
    '##############################%%%%...........%%%%%%#########################################################################################',
    '##############################%%%%...........%%%%%%#########################################################################################',
    '############################################################################################################################################',
  ],
};
