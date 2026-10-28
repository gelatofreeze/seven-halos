# CLAUDE.md — working on SEVEN HALOS

## Project
2D pixel-art Soulslike action RPG. Phaser 4 + strict TypeScript + Vite. Targets mobile browsers first (iPhone/Android, landscape), then desktop. The developer often works from an iPhone through cloud sessions, so keep the game playable from a deployed build and keep instructions phone-friendly.

## Lore guardrails
One Creator; seven gods, each with a Halo; sibling love → betrayal → war → mutual destruction; a blind oracle's prophecy; a mortal gathers the seven Halos, resurrects and reconciles the gods, and receives an eighth Halo, becoming God and King of Humanity. Seven kingdoms, each built around a fallen god's castle. Do not add other divine families or contradict this.

## Commands
- `npm run check`: type-check + tests + build. Run before every commit.
- `npm test`, `npm run typecheck`, `npm run dev`.

## Architecture rules (see docs/ARCHITECTURE.md)
- Gameplay (`core`, `physics`, `input/InputHub`, `entities`, `combat`, `world`, `data`, `config`) must **not import Phaser**. It runs in Vitest under Node.
- The simulation advances in fixed 60 Hz steps (`FixedTimestep`). Never use frame delta in gameplay. Frame data is in 60 Hz frames, everything else in px and seconds.
- Devices → `InputHub` → `InputFrame`. Entities read only the `InputFrame`.
- Hit detection (`HitDetection`) is separate from damage (`calculateDamage`) and from reactions (`receiveHit`).
- Animation is chosen from logic state. Never gate gameplay on an animation finishing.
- State machine convention: a state that returns a transition must not have applied movement that step (the next state runs in the same step).
- No allocations in per-step hot paths: reuse objects and pool hitboxes.
- Tunables live in `src/config/` and `src/data/`. Don't hard-code gameplay numbers in states.
- Presentation reacts to `SimEvent`s. The simulation must not depend on them being consumed.

## Art
Placeholders are procedural (`src/render/textures/`). Follow `docs/ANIMATION.md` for sheet sizes, foot anchors and frame order. Don't generate "final-looking" art to fill space; keep placeholders obviously temporary until art is approved.

## Testing
Add or adjust tests in `tests/` for any movement or combat rule change (see `tests/helpers.ts` for `flatSim` and `ScriptedInput`). With `?debug=1`, the running game exposes `window.__sevenHalos.sim` for browser-driven checks. Never claim something was playtested on a device unless it was.

## Git
Work on `dev/*` branches and open PRs. Don't merge without the owner's approval.
