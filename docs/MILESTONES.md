# Milestones

## Phase 1 — Foundation ✓
- [x] Phaser 4 + strict TypeScript + Vite + Vitest
- [x] Fixed-timestep deterministic simulation, decoupled from rendering
- [x] Movement: acceleration/deceleration, variable jump, coyote time, jump buffer, apex hang, fast fall, one-way platforms, hard landings
- [x] Dodge roll with startup, i-frames, recovery and cancel window
- [x] Sword attack with 2-hit chain, stamina, hitboxes on active frames only, hit-stop
- [x] Vowcarved Sentinel training enemy: telegraphed cleave, poise/hyper-armour, flinch, death and respawn
- [x] Touch (multi-touch) and keyboard controls, safe areas, no browser gestures
- [x] Placeholder art, parallax, lights, particles, synthesized SFX, debug overlay
- [ ] Hands-on feel tuning on real iPhone/Android hardware

## Phase 2 — Combat depth
### Update 2A — Advanced combat (done, pending device playtest)
- [x] Heavy attack and charged heavy (hold, 42-frame max, auto-release), charge visuals and audio
- [x] Guard with stamina cost, chip damage, block-stun, guard breaks
- [x] Parry with startup / window / whiff recovery, frontal only
- [x] Posture with decay, hyper-armour, posture breaks
- [x] Riposte: range, invulnerable animation, once per opening
- [x] Sentinel: delayed cleave variant, adapts after being parried, punishes guard breaks
- [x] Six-button touch layout + keyboard bindings; DOM-free `TouchRouter` with tests
- [x] Parry/guard/posture/riposte feedback (rings, sparks, sounds, opening marker, posture bar)
- [ ] Hand playtest on iPhone; tune values listed in docs/COMBAT.md

### Update 2B — Weapon identity, enemy variety, loot, currency, equipment (done, pending device playtest)
- [x] Mourning Crescent scythe: 3-hit sweeping light combo, heavy and charged heavy, riposte, own sheet and trails
- [x] Barrow Reaper: spacing AI, low sweep (jumpable) and committed lunge, retreat hop, fragile posture
- [x] Generic data-driven `Enemy` (Sentinel and Reaper are data)
- [x] XP / Gold / Forge Point rewards (Forge Points became Weapon XP in 2B.1), exactly once per kill, with feedback
- [x] Seeded, data-driven drop tables (1% scythe), world pickups
- [x] Inventory (definitions vs instances), equipping via BAG panel, guarded weapon switching
- [x] Versioned browser saves through a storage abstraction; corrupt/newer-save handling
- [x] Extended test chamber (Reaper arena, comparison area, armoury altar)
- [x] Development tools compiled out of commercial builds (verified by `npm run check`)
- [x] Naming screen and third-party record (docs/NAMING.md, docs/THIRD_PARTY.md)
- [ ] Hand playtest on iPhone; tune values listed in the PR

### Update 2B.1 + 2B.2 — Balance, death fix, Weapon XP, pause menu (done, pending device playtest)
- [x] Mourning Crescent rebalanced against a reproducible benchmark, with guard-rail tests
- [x] Enemy death plays once and holds, configurable fade/remains, no slide, no posthumous hits
- [x] Weapon XP replaces Forge Points; per-instance upgrade tiers with an atomic upgrade service
- [x] Save v2 with a tested v1 → v2 migration (backup first, runs once, protects newer saves)
- [x] Data-driven equipment slots (main hand functional; off hand, armour, rings, tool placeholders)
- [x] Grid pause menu: equipment, backpack, details with comparison, progression and upgrades
- [x] Pointer drag and drop (mouse, touch, pen), tap-to-equip fallback, keyboard, adaptive layouts
- [x] Menu input isolation: held, pending and buffered presses are dropped on open and close
- [x] Content validation (references, animation mappings, probabilities, slots, duplicate ids) and docs/CONTENT.md
- [ ] Hand playtest on iPhone (menu drag, layout, upgrade flow)

### Update 2C.1 — The first journey (done, pending device playtest)
- [x] Data-driven region registry, stable ids, marker legend per region; one generalized `WorldScene`
- [x] Doorway transitions with no bounce-back, input isolation, clean teardown; backtracking
- [x] Sanctuary Outskirts (safe start, first shrine, reserved NPC/service places) and Forest Road (enemies, ravine, climb, cache, shrine, sealed gate)
- [x] Shrine activation, rest (enemies return), fast travel between lit shrines, death respawn at the last shrine
- [x] Contextual interaction prompt (E / tap) for shrines, caches and doors
- [x] One-time treasure cache backed by a saved world flag
- [x] Save v3 with a v2 → v3 migration (v1 path kept); world data validated on load
- [x] World validation (ids, exits, anchors, reachability) and docs/WORLD.md
- [x] Test chamber kept as a development-only region; Sentinel shown as "Vowcarved Sentinel"
- [ ] Hand playtest on iPhone

### Update 2C.1a — World composition (done, pending device playtest)
- [x] Sanctuary hall rebuilt on one axis: shrine, central arch, light shaft, gable halo, mirrored walls/galleries/doors/braziers (tested)
- [x] Layered hall art (back wall, arcade, ivy, door frames), anchor-relative `decor` placements, tile materials (`%`, `-`)
- [x] Reusable lighting presets: animated flames, embers, light spill, flicker/pulse, dusty light shafts, fireflies
- [x] Forest Road recomposed in five beats with earth ground, tree-line backdrop and a distant castle landmark
- [x] Real-movement traversal tests for every main route, the way back, the ravine, the optional climb and the gate
- [ ] Hand playtest on iPhone

### Update 2C.2a — The First Voice (done, pending device playtest)
- [x] Sanctuary/forest support fixes: lintels set in the walls, sconces on the columns, a torch post, the bridge meeting its bridgeheads; prop-support regression test
- [x] Data-driven NPCs with focus priority; the Oracle at her reserved anchor
- [x] Data-driven dialogue (conditions, choices, validated outcomes) with a mobile-friendly panel
- [x] Quest engine (ordered typed objectives, catch-up from existing progress, exactly-once completion); The First Omen → The Seven Halos (0/7)
- [x] Readable lore (two inscriptions), journal in the pause menu
- [x] Save v4 with v3 → v4 migration (visited regions reconstructed)
- [ ] Hand playtest on iPhone

### Next (2C.2b — First Adventure, continued)
Hidden cave, more lore, the double-jump ring.

### Earlier plan (2C.2 — First Adventure)
The oracle and NPC dialogue, quests, a hidden cave, lore discovery and the double-jump ring. Then: spending Character XP (levelling) at a shrine, a blacksmith reusing the upgrade service, running and jumping attacks, a ranged enemy, player poise/armour, shields as equipment.

## Phase 3 — RPG layer
Classes and starting kits, attribute levelling with Experience, Gold vendors, Weapon XP upgrades (done in 2B.1), randomized loot tables with rare weapon drops, armour and accessories in the existing slots.

## Phase 4 — World
Shrine checkpoints and interconnected regions (foundation done in 2C.1), a Tiled (or in-house) level pipeline, secrets and shortcuts, the first kingdom's castle.

## Phase 5 — Bosses and presentation
The first fallen-god boss, multi-phase patterns, cinematic intros, final art pipeline, music and recorded SFX, settings (remappable controls, touch layout editor, audio).
