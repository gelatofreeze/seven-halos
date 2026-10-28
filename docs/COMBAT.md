# Combat design

## Frame data
All timing is in 60 Hz simulation frames (`src/data/weapons.ts`). Each attack has **startup → active → recovery**. Hitboxes exist only on active frames.

| Attack | Startup | Active | Recovery | Stamina | Damage | Poise dmg | Notes |
|---|---|---|---|---|---|---|---|
| Sword Slash (`sword.light.1`) | 8 | 4 | 18 | 18 | 26 | 22 | chains from f14, roll/jump cancel from f16 |
| Return Slash (`sword.light.2`) | 7 | 4 | 22 | 20 | 30 | 26 | end of chain |
| Hollow Cleave (`sentinel.cleave`) | 40 | 6 | 42 | – | 34 | 40 | hyper-armour +30 during startup and active |

## Dodge roll (`src/config/movement.ts`)
2 startup frames (vulnerable) → 13 invincible frames → 8 recovery frames, ~80 px of travel, 20 stamina. From frame 18 a buffered jump, attack or roll cancels the recovery. Rolls go in the held direction, or the facing direction when nothing is held. Rolling passes through enemies (no body push). Ground only for now (`allowInAir`).

## Stamina
100 max, 48/s regeneration after a 0.55 s delay, no regeneration while attacking or rolling. Souls rule: an action can start whenever stamina is above zero, even if it costs more than what is left.

## Hit pipeline (`CombatSystem.step`)
1. Every combatant writes its active hitboxes into the pooled `HitDetection` sink.
2. Overlaps with opposing hurtboxes become candidates. Each attack execution (`instanceId`) hits each target at most once.
3. Invincible targets produce an `evade` event instead. The attack is not consumed, so if the i-frames end while the hitbox is still active, it can still hit.
4. `calculateDamage` → `target.receiveHit` applies health, poise and knockback, then picks a reaction.
5. Global hit-stop (`hitstopFrames`) freezes the simulation briefly. Inputs pressed during the freeze are kept.

## Poise and hyper-armour
Enemies have poise, which resets 2.5 s after the last hit. A hit that breaks poise staggers the target. Outside its attacks, the Sentinel flinches briefly from any hit. During attack startup and active frames, `hyperArmor` is added to its poise threshold, so it keeps swinging unless poise breaks.

## Extension points
- **Movesets:** `WeaponDefinition.moveset` maps inputs to attack ids. Add heavy, running and jumping attacks as new data plus one input mapping.
- **Blocking/parry:** add a guard state on `Player`, and handle `guarding`/`parryWindow` inside `receiveHit` (or a resolver step between detection and damage).
- **Magic and projectiles:** projectiles are combatants with hitboxes and no hurtbox.
- **Damage types:** `DamageSpec` is a record; `calculateDamage` already loops over types.
- **Bosses:** many `AttackDefinition`s per boss, plus a phase-aware AI state machine like `Sentinel`'s.
