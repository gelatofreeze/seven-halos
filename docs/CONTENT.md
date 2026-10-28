# Adding content

Content is data. Gameplay code shouldn't change to add an enemy, weapon or item. After any change, run `npm test`. `tests/content.test.ts` runs `validateContent()` and `validateVisuals()`, which report missing references, broken animation mappings, invalid probabilities and weights, incompatible slots, looping combos and duplicate ids.

## A new weapon
1. **Attacks** in `src/data/weapons.ts` (`ATTACKS`). Copy an existing attack of the same role and change its frames, damage, hitboxes and cancels. Frame counts are 60 Hz frames, distances are px. Chain a combo with `next`; the last hit has no `next`.
2. **Weapon** in `WEAPONS`: `moveset` (light entry, heavy, riposte), `category`, and `upgrade: { damagePerLevel, maxLevel }`.
3. **Item** in `src/data/items.ts`: `kind: 'weapon'`, `weaponId`, `equip: ['weapon']`, `stackable: false`, rarity and description. Set `twoHanded: true` if it should clear the off hand.
4. **Visuals** in `src/render/animation/specs.ts`: a `WEAPON_SHEETS` entry, and a `PLAYER_ATTACK_FRAMES` entry for every attack in the moveset (startup / active / recovery frame lists, optional `charge`).
5. **Balance:** add the weapon to `tests/benchmark.ts` and give it guard rails in `tests/weapon-balance.test.ts`. No weapon should win on every axis.
6. **Name:** screen it and log it in `docs/NAMING.md` before it ships.

## A new enemy
1. **Attacks** in `ATTACKS` (`kind: 'enemy'`). Keep every startup ≥ 24 frames so it can be reacted to, and give each one a distinct telegraph.
2. **Definition** in `src/data/enemies.ts` (`ENEMIES`). Start from the Barrow Reaper (spacing, retreat) or the Hollow Sentinel (slow, hyper-armoured). Fields: body, health, posture, AI ranges, `attacks` options (weight and range window), reactions, `respawnDelay`, `rewards` `{ experience, gold, weaponXp }`, `loot` entries (`chance` within 0..1).
3. **Visual profile** in `src/render/views/enemyProfiles.ts`: sheet, the animations `idle, walk, stagger, parried, broken, riposted, dead`, telegraph visuals for every attack, and `death` (fade delay and duration, or `remains`). The fade must finish before `respawnDelay`.
4. **Placement:** put a level marker in a level (`src/data/levels/`), mapped to the enemy id in `parseLevel` (`src/world/Level.ts`) next to `E` / `R`.
5. **Tests:** copy the shape of `tests/reaper.test.ts` (telegraph-to-active gap, recovery window, AI choices).

## A new item or material
Add it to `ITEMS`. Materials are `kind: 'material'`, usually `stackable: true`, with no `equip`. Add drops to an enemy's `loot`. Armour, rings and tools will set `equip` to `head`, `chest`, `legs`, `boots`, `ring`, `tool` or `shield`. The slots already exist in `src/data/equipmentSlots.ts`, but only the main hand affects gameplay so far.

## A new equipment slot
Add a `SlotDefinition` to `EQUIPMENT_SLOTS` (unique id; `accepts` a slot type). The menu, saves and rules pick it up automatically. Mark it `functional: true` only once gameplay reads it.

## Rules of thumb
- Tunables belong in `src/config/` or `src/data/`, never in states or views.
- Don't add Phaser imports to data or gameplay files.
- Placeholder art stays obviously temporary until art is approved (docs/ANIMATION.md).
