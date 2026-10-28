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

## Development regions
The combat **Test Chamber** is registered only in development builds (`setUpDevWorld` in `src/dev/devTools.ts`):
- Reach it from **MENU → Progression → Development tools → Go to the Test Chamber**, or with `?region=test-chamber`.
- Its enemies keep their timer respawns and death respawns locally.
- It is never saved as the player's location.
- `npm run check` fails if it leaks into the commercial build.

## Saves
Save format v3 adds `world: { location, respawn, checkpoints, flags }`, holding only stable ids. On load, unknown regions, anchors, shrines and flags are dropped. A respawn point must be a lit shrine. The v2 → v3 migration keeps everything and starts the player at the sanctuary approach, after backing up the v2 save (`seven-halos.save.v2-backup`).
