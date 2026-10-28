import type { RegionDefinition } from '../../world/regions';

/**
 * Region A — Sanctuary Outskirts. A safe approach (no enemies) to a ruined
 * sacred refuge: the player's future home base. West to east: the approach
 * (start), the terrace and the roofless hall with the first shrine, braziers
 * and two galleries, then the path down to the forest.
 *
 * The hall's floor has reserved places (anchors) for the future oracle,
 * smith, merchant and storage, so later updates can place NPCs and services
 * by id without moving anything. The final name and design aren't fixed.
 */
export const SANCTUARY_OUTSKIRTS: RegionDefinition = {
  id: 'sanctuary-outskirts',
  name: 'Sanctuary Outskirts',
  tileSize: 16,
  enemyRespawn: 'rest',
  environment: { backdrop: 'sanctuary', motes: [0xffe2a8, 0xfff4d6, 0xc8ffd8], moteDensity: 0.8 },
  markers: {
    C: { type: 'checkpoint', id: 'sanctuary.shrine', name: 'Sanctuary Shrine' },
    X: { type: 'exit', id: 'sanctuary.to-forest', to: { region: 'forest-road', anchor: 'from-sanctuary' }, height: 4 },
    f: { type: 'anchor', id: 'from-forest', facing: -1 },
    // Reserved for later updates (no gameplay yet).
    o: { type: 'anchor', id: 'npc.oracle', facing: 1 },
    s: { type: 'anchor', id: 'service.smith', facing: 1 },
    m: { type: 'anchor', id: 'service.merchant', facing: -1 },
    k: { type: 'anchor', id: 'service.storage', facing: -1 },
    Y: { type: 'prop', prop: 'sanctuary' },
    p: { type: 'prop', prop: 'plinth' },
    t: { type: 'prop', prop: 'tree' },
    b: { type: 'prop', prop: 'bush' },
    u: { type: 'prop', prop: 'ruin' },
  },
  rows: [
    '##..........................................................................',
    '##..........................................................................',
    '##..........................................................................',
    '##......................#############........##############.................',
    '##......................##...............................##.................',
    '##......................##...............................##.................',
    '##......................##...............................##.................',
    '##......................##.....p..................p......##.................',
    '##......................##....======...........======....##.................',
    '##..........................................................................',
    '##...........................s...o....B..Y.C....B...m..k....................',
    '##...............u.t....###################################.................',
    '##..t.P..b.t..################################################..t.b..tf.L.X.',
    '############################################################################',
    '############################################################################',
    '############################################################################',
    '############################################################################',
  ],
};
