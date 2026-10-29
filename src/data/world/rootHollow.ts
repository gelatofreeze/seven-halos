import type { RegionDefinition } from '../../world/regions';

/**
 * Region C — Root Hollow (provisional name). An optional cave under the
 * ancient tree on the Forest Road, entered through the hollow in its roots.
 * Natural rock, with a little old masonry where someone once kept something
 * here. West to east:
 * A. The way in (cols 1-8): a low passage from the roots above (the exit back
 *    up is its west end), then natural steps down to a junction.
 * B. The broken span (18-32): a thick lip of rock off the junction and a thin
 *    shelf off the far outcrop, a short jump apart. Dropping into the gap is
 *    the other way: the basin below, a Sentinel and a small cache, and steps
 *    up its east side to the outcrop (every rise at most three tiles).
 * C. The chamber (33-45): an old paved floor and broken columns; the ring
 *    rests on a stone in the middle, lit.
 * D. The cliff (46+): five tiles of sheer rock, one more than any base jump,
 *    to a worked ledge and a small alcove above, glowing faintly from below.
 *    It is reachable with the ring's extra jump, and nothing else gets there
 *    (validated: `needsAirJump`). Dropping back down is always possible.
 * Leaving never needs the ring: the way back west is all base jumps.
 */
export const ROOT_HOLLOW: RegionDefinition = {
  id: 'root-hollow',
  name: 'Root Hollow',
  tileSize: 16,
  enemyRespawn: 'rest',
  environment: { backdrop: 'cave', ground: 'rock', motes: [0x9fe8d8, 0xc8f0ff], moteDensity: 0.35 },
  needsAirJump: ['hollow.cache.ledge', 'lore.hollow-ledge'],
  markers: {
    X: { type: 'exit', id: 'hollow.to-forest', to: { region: 'forest-road', anchor: 'from-hollow' }, height: 3 },
    a: { type: 'anchor', id: 'from-forest', facing: 1 },
    K: { type: 'cache', id: 'hollow.cache.basin', reward: { items: [{ item: 'grave-dust', quantity: 1 }], gold: 40 } },
    Y: { type: 'cache', id: 'hollow.relic.ring', reward: { items: [{ item: 'updraft-ring', quantity: 1 }] }, look: 'relic' },
    Z: { type: 'cache', id: 'hollow.cache.ledge', reward: { items: [{ item: 'grave-dust', quantity: 2 }], gold: 120, weaponXp: 60 } },
    L: { type: 'lore', lore: 'lore.hollow-ledge' },
  },
  decor: [
    // A: roots through the passage ceiling, the first glow of moss.
    { prop: 'hangingRoots', at: { col: 4, row: 3 }, dy: 8 },
    { prop: 'hangingRoots', at: { col: 8, row: 3 }, dx: 3, dy: 8 },
    { prop: 'glowMoss', at: { col: 7, row: 5 } },
    { prop: 'glowMoss', at: { col: 15, row: 9 } },
    // B: the basin.
    { prop: 'stalagmite', at: { col: 20, row: 18 }, layer: 'far' },
    { prop: 'stalagmite', at: { col: 25, row: 18 }, dx: 4, layer: 'far' },
    { prop: 'glowMoss', at: { col: 24, row: 18 } },
    { prop: 'rubble', at: { col: 22, row: 18 } },
    // C: the chamber's remnants.
    { prop: 'ruin', at: { col: 35, row: 12 }, layer: 'back' },
    { prop: 'fallenColumn', at: { col: 42, row: 12 } },
    { prop: 'glowMoss', at: { col: 44, row: 12 } },
    // D: a draft of light up the cliff face; moss on the ledge above.
    { prop: 'lightShaft', at: { col: 45, row: 12 } },
    { prop: 'glowMoss', at: { col: 49, row: 7 } },
  ],
  rows: [
    '################################################################',
    '################################################################',
    '#################.##############....#####.....##################',
    '#..........###....#######...####......#.......##################',
    '#.....................#.....####..........................######',
    '#X...a........................#...........................######',
    '#########.................................................######',
    '#########...........................................L..Z..######',
    '#############.................................#%%%%%############',
    '#############.................................##################',
    '#######################...=====##.............##################',
    '#######################........##.............##################',
    '##################.............##.....Y.......##################',
    '##################...........#####%%%%%%%%%%%###################',
    '##################...........###################################',
    '##################...........###################################',
    '##################.........#####################################',
    '##################.........#####################################',
    '##################.K.E.....#####################################',
    '################################################################',
    '################################################################',
    '################################################################',
  ],
};
