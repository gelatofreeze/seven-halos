# Animation and sprite standards

The contract lives in `src/render/animation/specs.ts`. Final art must match it, or that file must change with it.

## Global
- Pixel art at 1:1 logical pixels, nearest-neighbour scaling only. No sub-pixel rotation in final frames (the placeholder roll uses rotation only temporarily).
- 16×16 px tiles.
- Every sheet is anchored at the **feet**: horizontally centred, at row `footY`. Gameplay positions are foot positions.
- Characters are drawn facing **right**. Facing left is a horizontal flip.
- 60 Hz simulation. Logic-driven animations (attacks, roll) pick frames from action progress, so frame counts can change without touching gameplay.

## Player — `player`, 64×48 frames, feet at (32, 44)
Collision/hurtbox is 12×26 px. Extra frame width leaves room for sword swings.

| Range | Frames | Driven by |
|---|---|---|
| idle | 0–3 | 5 fps loop |
| run | 4–11 | 14 fps loop |
| jump (rising) | 12–13 | 10 fps, once |
| fall | 14–15 | 8 fps loop |
| land | 16–17 | 20 fps, once |
| dodge | 18–25 | roll progress (23 logic frames) |
| attack 1 startup/active/recovery | 26–27 / 28–29 / 30–31 | attack phase progress |
| hurt | 32–33 | 12 fps, once |
| dead | 34–35 | 3 fps, once |
| attack 2 startup/active/recovery | 36–37 / 38–39 / 40–41 | attack phase progress |
| heavy startup / charge hold / active / recovery | 42–43 / 44–45 / 46–47 / 48–49 | phase progress; charge alternates at 10 fps while held |
| guard / guard impact | 50 / 51 | raised guard; impact during block-stun |
| parry startup / window / whiff recovery | 52 / 53 / 54 | parry frame counter |
| riposte startup / thrust / recovery | 55–56 / 57 / 58 | attack phase progress |
| guard broken | 59 | held for the break duration |

## Hollow Sentinel — `sentinel`, 96×72 frames, feet at (48, 66)
Collision/hurtbox is 20×34 px. Ranges: idle 0–3, walk 4–9, windup 10–13 (telegraph, by startup progress), strike 14–15, recover 16–17, stagger/parried 18–19, dead 20–23, posture broken (kneeling, also held while parried) 24–25, riposted 26–27.

## Telegraph language
Feedback language: white sparks = clean hit, orange-white sparks = block, blue flash = guard break, gold ring + ringing tone = parry, gold ring + gong = posture break, pulsing gold ◆ over an enemy = riposte opening (brighter when in reach).

Enemy attacks must read before they land: a distinct windup pose, an eye flare that brightens through startup, and a white glint in the last third of the windup. A rising tone plays when the windup starts. Final art should keep the same timing: the glint appears at roughly 62–90% of startup.

## Replacing placeholders
Load real sheets in `BootScene.preload` using the same texture keys (`TEX` in `registerTextures.ts`). The placeholder generator skips any key that already exists.
