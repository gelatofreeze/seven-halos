# Milestones

## Phase 1 — Foundation ✓
- [x] Phaser 4 + strict TypeScript + Vite + Vitest
- [x] Fixed-timestep deterministic simulation, decoupled from rendering
- [x] Movement: acceleration/deceleration, variable jump, coyote time, jump buffer, apex hang, fast fall, one-way platforms, hard landings
- [x] Dodge roll with startup, i-frames, recovery and cancel window
- [x] Sword attack with 2-hit chain, stamina, hitboxes on active frames only, hit-stop
- [x] Hollow Sentinel training enemy: telegraphed cleave, poise/hyper-armour, flinch, death and respawn
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
- [x] XP / Gold / Forge Point rewards, exactly once per kill, with feedback
- [x] Seeded, data-driven drop tables (1% scythe), world pickups
- [x] Inventory (definitions vs instances), equipping via BAG panel, guarded weapon switching
- [x] Versioned browser saves through a storage abstraction; corrupt/newer-save handling
- [x] Extended test chamber (Reaper arena, comparison area, armoury altar)
- [x] Development tools compiled out of commercial builds (verified by `npm run check`)
- [x] Naming screen and third-party record (docs/NAMING.md, docs/THIRD_PARTY.md)
- [ ] Hand playtest on iPhone; tune values listed in the PR

### Next
Spending Forge Points (weapon upgrades) and Experience (levelling) at a shrine, running and jumping attacks, a ranged enemy, player poise/armour, shields as equipment.

## Phase 3 — RPG layer
Classes and starting kits, attribute levelling with Experience, Gold vendors, Forge Point weapon upgrades, randomized loot tables with rare weapon drops, inventory/equipment UI, saving.

## Phase 4 — World
Shrine checkpoints with rest/respawn, interconnected rooms and level streaming, a Tiled (or in-house) level pipeline, secrets and shortcuts, the first kingdom's castle.

## Phase 5 — Bosses and presentation
The first fallen-god boss, multi-phase patterns, cinematic intros, final art pipeline, music and recorded SFX, settings (remappable controls, touch layout editor, audio).
