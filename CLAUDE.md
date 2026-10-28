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

- Enemies are data: add new ones as `EnemyDefinition`s (and a visual profile in `render/views/enemyProfiles.ts`), not as new classes, unless behaviour truly can't be expressed as data.
- Rewards and loot happen in `Simulation.processDeaths()` off `Enemy.consumeDeath()` (exactly once per death). Loot uses `Simulation.lootRandom`, never the AI stream.
- Only the `PlayerProfile` is persisted (via `SaveManager` + a `StorageAdapter`). Never save in-progress combat state. Bump `SAVE_VERSION` and add a migration when the format changes.
- Currencies: Character XP, Weapon XP, Gold. Materials are items, not currencies. Weapon XP is never shown on the combat HUD.
- Equipment goes through the `Loadout` rules and `Simulation.requestEquip(uid, slot)`; upgrades through `rpg/WeaponUpgrades.ts`. UI code never mutates the profile directly except backpack order (`Inventory.move`).
- Sprites pick frames from logic state (`animFrame`); never call `anims.play` per frame.
- Run `validateContent` / `validateVisuals` (part of `npm test`) when adding content; see docs/CONTENT.md.
- The world is data: add regions as `RegionDefinition`s in `src/data/world/` and register them in `src/world/regions.ts` (docs/WORLD.md). Never add a scene per area; `WorldScene` shows every region.
- Region, checkpoint and cache ids are saved: never rename a shipped one. World progress lives in `profile.world`; per-session state (defeated enemies) in `WorldSession`.
- Development-only features go through `DEV_TOOLS_ENABLED` / `src/dev/` and must compile out of `npm run build`; `npm run check` enforces this.

## Originality and licensing
The game is for commercial release (Steam, iOS, Android). Screen new distinctive proper names and log them in `docs/NAMING.md`; record any third-party code or asset and its licence in `docs/THIRD_PARTY.md` *before* adding it. Never copy protected characters, art, sounds or text from other games. Flag doubtful cases to the owner; don't rename approved content on your own.

## Art
Placeholders are procedural (`src/render/textures/`). Follow `docs/ANIMATION.md` for sheet sizes, foot anchors and frame order. Don't generate "final-looking" art to fill space; keep placeholders obviously temporary until art is approved.

## Testing
Add or adjust tests in `tests/` for any movement or combat rule change (see `tests/helpers.ts` for `flatSim` and `ScriptedInput`). With `?debug=1`, the running game exposes `window.__sevenHalos.sim` for browser-driven checks. Never claim something was playtested on a device unless it was.

## Git
Work on `dev/*` branches and open PRs. Don't merge without the owner's approval.
Whenever you ask the owner to merge, give the direct PR link (`https://github.com/<owner>/<repo>/pull/<n>`); the merge button is at the bottom of that page. Say when CI is green so they know it's safe to merge.
After a merge to `main`, give the play link: https://gelatofreeze.github.io/seven-halos/ (GitHub Pages redeploys from `main`).
