import type { RegionDefinition } from '../../world/regions';

/**
 * Region B — the first forest road, in five beats (west to east):
 * A. Calm entrance (cols 1-21): the waymarker matching the sanctuary's, a
 *    soft rise, flowers and room to breathe before anything hostile.
 * B. The collapsed bridge (30-50): both bridgeheads stand, each with a stub of
 *    its broken span corbelled out over the ravine; one pier survives in the
 *    middle, rising from the ravine floor. Two short jumps cross it. Fallen
 *    stones lie heaped against the pier and the east span, so a fall is never
 *    a trap: the rubble climbs back out, forward.
 * C. The ancient tree (52-62): its roots heave the road into a low mound with
 *    a hollow under the trunk (the way down into the Root Hollow, an optional
 *    cave). Two thick limbs grow out of the trunk; climbing them is optional and
 *    leads to the treasure cache in the crook of the high one.
 * D. Ruined clearing (66-100): fallen columns mark its edges; a colonnade
 *    behind, a standing wall fragment and a dais give the fight terrain; a
 *    Reaper, then a Sentinel, far enough apart to meet one at a time.
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
    // The hollow under the ancient tree: a door the player chooses to take (never fallen into).
    H: { type: 'exit', id: 'forest.to-hollow', to: { region: 'root-hollow', anchor: 'from-forest' }, width: 2, height: 2, interact: true, label: 'Enter the hollow' },
    h: { type: 'anchor', id: 'from-hollow', facing: 1 },
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
    // B: what is left of the arches under the spans (dim, behind the tiles), the
    // stream on the ravine floor, roots and ivy hanging off the broken stone.
    { prop: 'bridgeRuin', at: { col: 40, row: 22 }, layer: 'back' },
    { prop: 'stream', at: { col: 36, row: 22 }, dx: 4 },
    { prop: 'hangingRoots', at: { col: 35, row: 20 }, dx: 6 },
    { prop: 'hangingRoots', at: { col: 41, row: 20 }, dx: 5 },
    { prop: 'ivy', at: { col: 39, row: 19 }, dx: -5, dy: 10 },
    { prop: 'ivy', at: { col: 45, row: 19 }, dx: -5, dy: 10 },
    { prop: 'rubble', at: { col: 36, row: 22 } },
    { prop: 'fern', at: { col: 42, row: 22 } },
    // C: the ancient tree on its root mound, its roots over the shoulders and the hollow beneath.
    { prop: 'ancientTree', at: { col: 56, row: 18 }, dx: 8, layer: 'back' },
    { prop: 'treeRoots', at: { col: 56, row: 18 }, dx: 8 },
    { prop: 'rootHollow', at: 'from-hollow', dx: -8 },
    { prop: 'fern', at: { col: 60, row: 18 } },
    { prop: 'flowers', at: { col: 52, row: 18 } },
    // D: a colonnade behind the clearing; ivy on the standing wall fragment.
    { prop: 'colonnade', at: { col: 80, row: 18 }, layer: 'far' },
    { prop: 'ruin', at: { col: 79, row: 18 } },
    { prop: 'ivy', at: { col: 76, row: 17 }, dx: 5, dy: 10 },
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
    '#.....................................................................................................................................%%%%%%',
    '#............................................................T........................................................................%%%%%%',
    '#........................................................======.......................................................................%%%%%%',
    '#.....................................................................................................................................%%%%%%',
    '#.....................................................................................................................................%%%%%%',
    '#.................................................=====............................................................................L.G%%%%%%',
    '#................................................................................................................................%%%%%%%%%%%',
    '#............................................................................................................................%%%%%%%%%%%%%%%',
    '#...............f.....................................##..................%%%...................................C........%%%%%%%%%%%%%%%%%%%',
    '#X.w.a...t..f.######.bt...t..E.....................b.###..##..f....o....R.%%%.....%%%%%%%...o....E...t..b.%%%%%%%%%%%%%.t%%%%%%%%%%%%%%%%%%%',
    '##############################%%%%%%...%%%...%%%%%%#####Hh##################################################################################',
    '##############################%%%%%%...%%%...%%%%%%#########################################################################################',
    '##############################%%%%%#..%%%%..%#%%%%%#########################################################################################',
    '##############################%%%%##.%%%%%.%%##%%%%#########################################################################################',
    '############################################################################################################################################',
  ],
};
