import type { RegionDefinition } from '../../world/regions';

/**
 * Region A — Sanctuary Outskirts. A safe approach (no enemies) to a ruined
 * sacred refuge: the player's future home base.
 *
 * The principal hall is symmetric about one axis: tile column 41 (x = 664),
 * where the shrine stands. Walls, doorways, galleries, the roof opening and
 * the front steps are mirrored in the rows; every piece of hall decoration is
 * placed relative to the shrine (`decor`, dx/dy in px, `mirror` for pairs),
 * so the back wall's central arch, the light through the roof, the gable's
 * halo and the shrine share one centre by construction (tested).
 *
 * The hall's floor keeps reserved places (anchors) for the future oracle,
 * smith, merchant and storage, in symmetric pairs off the axis. The final
 * name and design aren't fixed.
 */
export const SANCTUARY_OUTSKIRTS: RegionDefinition = {
  id: 'sanctuary-outskirts',
  name: 'Sanctuary Outskirts',
  tileSize: 16,
  enemyRespawn: 'rest',
  environment: { backdrop: 'sanctuary', ground: 'stone', motes: [0xffe2a8, 0xfff4d6, 0xc8ffd8], moteDensity: 0.6 },
  markers: {
    C: { type: 'checkpoint', id: 'sanctuary.shrine', name: 'Sanctuary Shrine' },
    X: { type: 'exit', id: 'sanctuary.to-forest', to: { region: 'forest-road', anchor: 'from-sanctuary' }, height: 4 },
    f: { type: 'anchor', id: 'from-forest', facing: -1 },
    // Reserved for later updates (no gameplay yet), mirrored around the axis.
    s: { type: 'anchor', id: 'service.smith', facing: 1 },
    k: { type: 'anchor', id: 'service.storage', facing: -1 },
    o: { type: 'anchor', id: 'npc.oracle', facing: 1 },
    m: { type: 'anchor', id: 'service.merchant', facing: -1 },
    t: { type: 'prop', prop: 'tree' },
    b: { type: 'prop', prop: 'bush' },
    u: { type: 'prop', prop: 'ruin' },
    w: { type: 'prop', prop: 'waymarker' },
    // The carved stone by the road out: the first readable lore.
    L: { type: 'lore', lore: 'lore.waystone' },
  },
  decor: [
    // The hall, back to front, all on the shrine's axis. Bottom = the hall floor (y 176).
    { prop: 'sanctuaryWall', at: 'sanctuary.shrine', layer: 'back' },
    { prop: 'sanctuaryFrame', at: 'sanctuary.shrine', layer: 'back' },
    { prop: 'sanctuaryIvy', at: 'sanctuary.shrine', layer: 'back' },
    { prop: 'lightShaft', at: 'sanctuary.shrine' },
    // Exterior: the pediment on the roof (roof top y 48) with the Halo in its oculus.
    { prop: 'gable', at: 'sanctuary.shrine', dy: -128 },
    { prop: 'halo', at: 'sanctuary.shrine', dy: -130 },
    // Mirrored pairs: braziers beside the shrine, plinths on the galleries.
    { prop: 'brazier', at: 'sanctuary.shrine', dx: 64, mirror: true },
    { prop: 'plinth', at: 'sanctuary.shrine', dx: 160, dy: -48, mirror: true },
    // Sconces fixed to the outermost arcade columns (column centres at ±238).
    { prop: 'torch', at: 'sanctuary.shrine', dx: 238, dy: -48, mirror: true },
    // Lintels over the two doorways: set into the 2-tile walls (centres ±264), bottom on the opening's top (32 px up).
    { prop: 'doorArch', at: 'sanctuary.shrine', dx: 264, dy: -32, mirror: true },
    { prop: 'flowers', at: 'sanctuary.shrine', dx: 120, mirror: true },
    // The approach and the road out: flowers and a fallen column on the way in.
    { prop: 'flowers', at: { col: 11, row: 12 } },
    { prop: 'fallenColumn', at: { col: 15, row: 12 } },
    { prop: 'flowers', at: { col: 67, row: 12 } },
  ],
  rows: [
    '##..........................................................................',
    '##..........................................................................',
    '##..........................................................................',
    '##......................%%%%%%%%%%%%%%.......%%%%%%%%%%%%%%.................',
    '##......................%%...............................%%.................',
    '##......................%%...............................%%.................',
    '##......................%%...............................%%.................',
    '##......................%%...............................%%.................',
    '##......................%%....------...........------....%%.................',
    '##..........................................................................',
    '##..........................s.....o......C......m.....k.....................',
    '##......................%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%.................',
    '##..t.P.w.t..u..t..w.%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%..t.b.t.fL.tX.',
    '############################################################################',
    '############################################################################',
    '############################################################################',
    '############################################################################',
  ],
};
