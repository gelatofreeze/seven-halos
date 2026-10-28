# World building

The world is a set of **regions** connected by **exits**. Only the current region is loaded and simulated. Each region is plain data, so adding one needs no new scene, class or lifecycle code.

## How it fits together
| Piece | File | Role |
|---|---|---|
| Region data | `src/data/world/*.ts` | ASCII rows + a marker legend + environment config |
| Registry | `src/world/regions.ts` | `REGIONS`, `WORLD_START`, lookups (`getRegion`, `allCheckpoints`, `isValidLocation`) |
| Parser | `src/world/Level.ts` | Rows → tiles, solids, anchors, enemy spawns, props and world objects |
| Runtime | `src/world/GameWorld.ts` | Loads one region at a time; applies doorway / rest / travel / death rules |
| Rules | `src/world/Simulation.ts` | Interaction focus, shrines, caches, exits, rest and fast-travel requests |
| Progress (saved) | `src/world/WorldProgress.ts` | Resume location, respawn shrine, active shrines, permanent flags |
| Session (not saved) | `WorldSession` | Ordinary enemies defeated since the last rest; health carried through doorways |
| Scene | `src/scenes/WorldScene.ts` | Draws whatever region is loaded; fades and restarts itself on every transition |
| Validation | `src/world/validateWorld.ts` | Run by `npm test` (`tests/world.test.ts`) |

## World rules
- **Doorway** (walk into an exit): health carries over. Defeated ordinary enemies stay down. The arrival anchor becomes the resume location.
- **Shrine**: unlit until the player uses it. Lighting one adds it to the saved set, makes it the respawn point and opens the shrine menu.
- **Rest**: full restore; ordinary enemies return; items, currencies, shrines and flags are kept.
- **Fast travel**: only from a lit shrine, only to another lit shrine. It counts as resting at the destination.
- **Death**: back to the last shrine used (in any region), or the world start before any shrine. Nothing permanent is lost.
- **One-time objects** (caches) set a permanent flag *before* granting their reward, and the flag is saved. They never reopen.
- Exits only work once the player has stepped out of every exit zone, so arriving can't bounce straight back. Validation also rejects anchors placed inside exits.

## Adding a region
1. **Create `src/data/world/<name>.ts`** exporting a `RegionDefinition`:
   - `id`: a stable, lower-case id (never rename it once shipped; saves store it).
   - `name`: shown on arrival.
   - `tileSize: 16`.
   - `enemyRespawn: 'rest'`.
   - `environment`: backdrop `ruins` | `forest` | `sanctuary`, mote colours and density.
   - `rows`: `#` solid, `=` one-way platform, `.` empty. Keep gaps ≤ 5 tiles and climbs ≤ 3 tiles (jump height 52 px).
   - `markers`: one character per object.
     ```ts
     markers: {
       a: { type: 'anchor', id: 'from-forest', facing: -1 },          // arrival point
       C: { type: 'checkpoint', id: 'marsh.shrine', name: 'Marsh Shrine' },
       X: { type: 'exit', id: 'marsh.to-forest', to: { region: 'forest-road', anchor: 'from-marsh' }, height: 4 },
       T: { type: 'cache', id: 'marsh.cache.reeds', reward: { items: [{ item: 'grave-dust', quantity: 2 }], gold: 40 } },
       E: { type: 'enemy', enemy: 'hollow-sentinel' },                 // E and R exist by default
       t: { type: 'prop', prop: 'tree' },
     }
     ```
     Characters with an `id` must appear exactly once. Checkpoint and cache ids are saved, so they must be unique across the whole world (e.g. `<region>.shrine`, `<region>.cache.<place>`).
2. **Register it**: add it to `REGIONS` in `src/world/regions.ts`.
3. **Connect it both ways**: an exit in the neighbour pointing at the new region's anchor, and an exit back. Validation fails without a way back.
4. **Run `npm test`.** `validateWorld` reports:
   - duplicate region or object ids, and invalid ids;
   - unknown markers;
   - exits to missing regions or anchors;
   - anchors not on open ground, or inside an exit;
   - unknown enemies or cache items;
   - regions not connected to the start;
   - objects that the jump-reach heuristic can't reach from every anchor.
5. **Play it**: `npm run dev`, walk in from the neighbour, light the shrine, rest, die, reload.

New prop kinds need a texture (`src/render/textures/worldArt.ts`, registered in `registerTextures.ts`) and a line in `LevelRenderer`. New interactable kinds (NPCs, doors, lore, resource nodes) follow the same pattern:
1. add a marker type in `Level.ts`;
2. handle it in `Simulation.interact()`;
3. give it a prompt label in `ui/worldModel.ts`;
4. if it changes permanently, give it a stable id and a `WorldProgress` flag.

## Composition conventions (2C.1a)
Gameplay geometry lives in the ASCII rows; everything else a region shows is decoration placed by data. Collision never depends on decoration.

**Tile materials.** `#` and `=` use the region's ground (`environment.ground`: `stone` or `earth`). `%` (solid) and `-` (one-way slab) are always masonry. Use masonry for anything built (bridgeheads, a shrine plateau, stairs), so built and natural surfaces read differently at a glance.

**Decoration placed relative to points.** `decor` entries put a prop at an anchor or object id, or at a tile `{ col, row }`, plus a pixel offset:
```ts
decor: [
  { prop: 'sanctuaryWall', at: 'sanctuary.shrine', layer: 'back' },     // centred on the shrine
  { prop: 'brazier', at: 'sanctuary.shrine', dx: 64, mirror: true },    // a symmetric pair at ±64 px
  { prop: 'bridgeRuin', at: { col: 40, row: 22 }, layer: 'back' },
]
```
- **Symmetric architecture** (a principal hall, a shrine plateau): pick the axis object (usually the checkpoint), mirror the collision tiles around its column, and place every major piece relative to it, with `mirror: true` for pairs.
  - `tests/composition.test.ts` checks the sanctuary's axis, tile symmetry, mirrored pairs and wall fit.
  - Don't force symmetry where the architecture doesn't call for it; ivy, rubble and the wilderness stay organic.
- Symmetric textures are drawn as their left half and mirrored (`mirrorLeftHalf`), so their centre is exact.

**Layers and depth** (back to front):
- backdrop (screen-space parallax, with the optional distant `environment.landmark`);
- `far` (−40, dimmed toward the sky);
- `back` (−20: walls, arcades, the bridge, big trees);
- `mid` (−6, default props);
- tiles (0);
- light spill, flames, door frames (1–2);
- shafts of light (7);
- enemies (8), player (10);
- `front` (14, sparse low accents only).

Per-kind depths live in `PROP_VISUALS` (`src/render/environment/props.ts`), so a new prop kind is a texture plus one table entry.

**Light.** `LightRig` (`src/render/environment/lighting.ts`) has named presets: `brazier`, `torch`, `shrine`, `window`, `divine`, `treasure`, `lantern`, `seal`, `moon`. Each light is:
- a glow behind the tiles;
- a wide, faint additive spill over them (so stone near a brazier warms up);
- optionally an animated flame, sparse embers, flicker or a slow pulse.

Props declare their lights in `PROP_VISUALS`; regions never place raw light sprites. A `lightShaft` prop adds a beam with dust drifting only inside it. `environment.fireflies` adds forest life.

**Readability rules.**
- Exits are marked by matching waymarkers on both sides, not by UI.
- Every platform the eye reads as one is reachable with the base jump: ≤ 3 tiles up, gaps ≤ 5 tiles.
- Optional routes start in plain sight of the main path (the tree's low branch) and show their reward's glow from below.
- Combat spaces are open, with enemies far enough apart to be met one at a time.
- The interaction prompt floats above the player, never over the object.

**Traversal tests.** `tests/traversal.test.ts` drives the real movement code with a bot that holds a direction and jumps at walls and gap edges. It covers each region's main route, the way back, falling into the ravine, the optional climb and the sealed gate. `validateWorld`'s reachability check stays as a fast structural screen, but only these tests prove a route. Add one for every new mandatory route; if it fails, fix the geometry, not the movement tuning.

## Development regions
The combat **Test Chamber** is registered only in development builds (`setUpDevWorld` in `src/dev/devTools.ts`):
- Reach it from **MENU → Progression → Development tools → Go to the Test Chamber**, or with `?region=test-chamber`.
- Its enemies keep their timer respawns and death respawns locally.
- It is never saved as the player's location.
- `npm run check` fails if it leaks into the commercial build.

## Saves
Save format v3 adds `world: { location, respawn, checkpoints, flags }`, holding only stable ids. On load, unknown regions, anchors, shrines and flags are dropped. A respawn point must be a lit shrine. The v2 → v3 migration keeps everything and starts the player at the sanctuary approach, after backing up the v2 save (`seven-halos.save.v2-backup`).
