# Architecture

SEVEN HALOS separates **simulation** (pure TypeScript, deterministic, unit-tested) from **presentation** (Phaser). Gameplay code never imports Phaser.

```
Devices ──► InputHub ──► InputFrame ──► Simulation.step() ──► SimEvents ──► Effects / Sfx
(keyboard,   (actions,     (one per       (fixed 60 Hz)           │
 touch)       edges)        step)              │                  ▼
                                               └──── state ────► Views (sprites, HUD, debug)
```

## Fixed timestep
`TestChamberScene.update` feeds real frame time into `FixedTimestep` (60 Hz, max 5 steps per frame). Every gameplay rule runs in whole 1/60 s steps, so frame data, jump arcs and i-frames are identical on 60, 90 and 120 Hz screens. Views interpolate between each body's previous and current position by the leftover `alpha`.

## Directory map
| Path | Responsibility |
|---|---|
| `src/main.ts` | Boot: services, input devices, browser hygiene, Phaser game |
| `src/game/` | Viewport (integer pixel scaling, safe areas), shared services |
| `src/config/` | All tunables: display, movement, player combat, controls, debug |
| `src/core/` | Engine-agnostic primitives: math, rects, fixed timestep, state machine |
| `src/physics/` | Static collision world, swept AABB kinematic body |
| `src/input/` | Logical actions, `InputHub`, keyboard and touch sources |
| `src/entities/player/` | `Player` (body, resources, gating) and `PlayerStates` (state machine) |
| `src/entities/enemy/` | `Enemy`: one data-driven melee enemy class (spacing, distance-based attack choice, retreat, posture, reactions, exactly-once death tracking). The Hollow Sentinel and Barrow Reaper are both `EnemyDefinition` data |
| `src/combat/` | Attack data types, `AttackRunner` (frames + charge), `HitDetection`, `Defense` (guard/parry resolution), `Damage`, `CombatSystem`, stamina/health/posture |
| `src/data/` | Content: attacks/weapons, enemies, levels |
| `src/world/` | Level parsing, `Simulation` (also rewards, loot and pickups), `Loot`, `Pickups`, simulation events |
| `src/rpg/` | `PlayerProfile` (wallet, inventory, equipped weapon; the persistent player), `Wallet`, attributes |
| `src/inventory/` | `Inventory` (owned `ItemInstance`s, separate from `ITEMS` definitions), `Equipment` (moveset + upgrade scaling) |
| `src/persistence/` | `StorageAdapter` interface, versioned `SaveGame` (validate / migrate / back up), `SaveManager` |
| `src/platform/` | Platform adapters (browser `localStorage`); Steam/mobile adapters go here |
| `src/dev/` | **Development-only** tools (item grants, test drops, save reset). Compiled out of commercial builds |
| `src/render/` | Placeholder art generation, animation specs, views, parallax, lights, effects |
| `src/audio/` | Temporary synthesized SFX |
| `src/ui/` | HUD bars (Phaser), DOM currency read-out, toasts, inventory panel and its DOM-free view model |
| `src/debug/` | Hitbox / state overlay |
| `src/scenes/` | Boot, TestChamber (world), UI (HUD) |
| `tests/` | Vitest: core, movement, combat, advanced combat, input/touch |

## Key rules
- **Input is decoupled from behaviour.** Devices only call `InputHub.press/release`. The simulation reads one `InputFrame` per step. Presses are counted, so a tap shorter than one step still lands, and presses that happen during hit-stop stay queued.
- **State machine.** `StateMachine` runs `exit`/`enter` on transitions. When a state transitions, the new state's update runs in the same step (zero added latency). A state that returns a transition must not have applied per-step movement first.
- **Hit detection ≠ defense ≠ damage.** `HitDetection` only does geometry and once-per-target bookkeeping. `resolveDefense` decides parry/block/guard break from facing and defense state. `calculateDamage` is a pure function. Targets apply results in `receiveHit` / `receiveBlock` / `onAttackParried`.
- **Animation never drives logic.** Attack and dodge sprites are picked from the logic frame counter, not the other way round.
- **No per-step allocation** on the hot path: hitboxes are pooled and input frames are reused. Events are allocated only when something happens.
- **Collision** uses exact swept, axis-separated movement against merged level rectangles, so a body cannot tunnel through thin solids. One-way platforms collide only from above. If levels get large, add a spatial grid in `CollisionWorld`.

## RPG loop data flow
```
Enemy dies ──► Enemy.markDead() (once) ──► Simulation.processDeaths()
                                             ├─ profile.wallet.add(def.rewards)
                                             ├─ rollLoot(def.loot, lootRandom) ──► Pickups in the world
                                             └─ SimEvents: reward, lootDrop
Player walks over pickup ──► profile.inventory.add() ──► SimEvent: pickup
Inventory panel ──► Simulation.requestEquip(uid) (refused mid-action) ──► Player.equipment
PlayerProfile.revision changes ──► SaveManager.saveIfChanged() (≤ 1/s, on hide/pagehide)
```
- The simulation owns *when* rewards, drops and equipment changes happen. The profile owns *what* the player has. Presentation only listens to events.
- **Saves contain only the profile.** Fights, enemies and loose pickups are never saved, so a reload can't duplicate an item or replay a reward. The format is versioned (`SAVE_VERSION`); unreadable saves are backed up and replaced, and saves from a newer version are left untouched.
- **Development tools** are gated by `DEV_TOOLS_ENABLED` (`src/config/build.ts`): on in `npm run dev` and in `npm run build:test` (GitHub Pages preview), off in `npm run build`. `npm run check` fails if dev-tool code appears in the commercial bundle.

## Rendering resolution
Logical height targets 270 px. Zoom is the integer number of *device* pixels per game pixel, picked so the height lands near 270 (range 216–360). Width follows the screen's aspect ratio (384–640 px), so the image is never stretched: an iPhone 14 in landscape renders 633×292 at 4×. Screens wider than 640 logical pixels are letterboxed. Concept art uses a 1448×1086 canvas; that is a reference size, not the game resolution.

## Touch controls
`TouchControls` is a DOM overlay; the finger-binding logic lives in the DOM-free `TouchRouter` (unit-tested). The left side of the screen is a floating joystick: wherever the thumb lands becomes the stick's centre, and the base follows if the thumb drags past the rim. It gives an analog horizontal axis (`InputHub.setAxis`) and a "down" hold. Action buttons sit on the right. A touch goes to the nearest button within 1.6× its radius, and button positions are read at touch time, so rotation can't leave stale hit areas. Each finger keeps its binding until it lifts, and bindings are checked against `TouchEvent.touches` on every event to recover from touchends that iOS drops. Layout and feel are tuned in `src/config/controls.ts`.

## Browser integration
- `touch-action: none`, a blocking `touchmove` listener, `gesturestart`/`dblclick` prevention and a fixed body stop scrolling and zoom.
- Blur and `visibilitychange` release all held inputs, pause the scene and suspend audio. The timestep is reset on return, so there is no catch-up spiral.
- Safe-area insets come from CSS `env()` and are converted to game pixels for the HUD. Touch buttons position themselves with `env()` directly.
