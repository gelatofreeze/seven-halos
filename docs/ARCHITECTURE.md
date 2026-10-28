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
| `src/entities/enemy/` | Enemy AI (`Sentinel` training enemy) |
| `src/combat/` | Attack data types, `AttackRunner`, `HitDetection`, `Damage`, `CombatSystem`, resources |
| `src/data/` | Content: attacks/weapons, enemies, levels |
| `src/world/` | Level parsing, `Simulation`, simulation events |
| `src/rpg/`, `src/inventory/` | Attributes/currencies and equipment (minimal, already consumed by combat) |
| `src/render/` | Placeholder art generation, animation specs, views, parallax, lights, effects |
| `src/audio/` | Temporary synthesized SFX |
| `src/ui/` | HUD |
| `src/debug/` | Hitbox / state overlay |
| `src/scenes/` | Boot, TestChamber (world), UI (HUD) |
| `tests/` | Vitest: core, movement, combat |

## Key rules
- **Input is decoupled from behaviour.** Devices only call `InputHub.press/release`. The simulation reads one `InputFrame` per step. Presses are counted, so a tap shorter than one step still lands, and presses that happen during hit-stop stay queued.
- **State machine.** `StateMachine` runs `exit`/`enter` on transitions. When a state transitions, the new state's update runs in the same step (zero added latency). A state that returns a transition must not have applied per-step movement first.
- **Hit detection ≠ damage.** `HitDetection` only does geometry and once-per-target bookkeeping. `calculateDamage` is a pure function. Targets apply results in `receiveHit`.
- **Animation never drives logic.** Attack and dodge sprites are picked from the logic frame counter, not the other way round.
- **No per-step allocation** on the hot path: hitboxes are pooled and input frames are reused. Events are allocated only when something happens.
- **Collision** uses exact swept, axis-separated movement against merged level rectangles, so a body cannot tunnel through thin solids. One-way platforms collide only from above. If levels get large, add a spatial grid in `CollisionWorld`.

## Rendering resolution
Logical height targets 270 px. Zoom is the integer number of *device* pixels per game pixel, picked so the height lands near 270 (range 216–360). Width follows the screen's aspect ratio (384–640 px), so the image is never stretched: an iPhone 14 in landscape renders 633×292 at 4×. Screens wider than 640 logical pixels are letterboxed. Concept art uses a 1448×1086 canvas; that is a reference size, not the game resolution.

## Browser integration
- `touch-action: none`, a blocking `touchmove` listener, `gesturestart`/`dblclick` prevention and a fixed body stop scrolling and zoom.
- Blur and `visibilitychange` release all held inputs, pause the scene and suspend audio. The timestep is reset on return, so there is no catch-up spiral.
- Safe-area insets come from CSS `env()` and are converted to game pixels for the HUD. Touch buttons position themselves with `env()` directly.
