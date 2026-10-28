# Combat design

Every option against an attack trades **timing, stamina and reward** differently:

| Option | Input | Cost | Risk | Reward |
|---|---|---|---|---|
| **Roll** | tap ROLL | 28 stamina | must be timed to the i-frames (2 startup, 13 invincible, 8 recovery) | safe, and puts you beside/behind the enemy for a punish |
| **Guard** | hold GUARD | 40 stamina per Sentinel cleave, 10% chip damage, slow walk, 60% regen while raised | guard breaks when stamina runs out → 1 s helpless, and the Sentinel punishes immediately | easy timing; good while learning a move |
| **Parry** | tap PARRY | 15 stamina | 8-frame window; whiffing leaves 26 frames of recovery; fails from behind; fooled by the delayed cleave | negates the hit, adds 60 posture damage, opens a **riposte** |
| **Light attack** | tap ATK | 18 / 20 stamina | short commitment | fast, 2-hit chain, cancels into roll/jump/guard from frame 16 |
| **Heavy attack** | tap HEAVY | 34 stamina | 20-frame startup, 30-frame recovery, roll-cancel only from frame 46 | high damage and posture damage (30) |
| **Charged heavy** | hold HEAVY | +up to 12 stamina | holds on frame 12 for up to 42 frames (0.7 s); interrupted if hit | up to ×1.65 damage and ×1.8 posture damage |
| **Riposte** | ATK next to an opened enemy | — | only on a parry or posture break, once per opening | 60 base damage, invulnerable throughout |

## Frame data
All timing is in 60 Hz simulation frames (`src/data/weapons.ts`). Each attack has **startup → active → recovery**; hitboxes exist only on active frames.

| Attack | Startup | Active | Recovery | Stamina | Damage | Posture | Guard stamina | Notes |
|---|---|---|---|---|---|---|---|---|
| Sword Slash (`sword.light.1`) | 8 | 4 | 18 | 18 | 26 | 14 | 20 | chains from f14, cancels from f16 |
| Return Slash (`sword.light.2`) | 7 | 4 | 22 | 20 | 30 | 18 | 24 | end of chain |
| Overhead Cleave (`sword.heavy`) | 20 (+charge) | 5 | 30 | 34 (+12 × charge) | 42 → 69 | 30 → 54 | 45 | charge hold on f12, max 42 frames, ground only |
| Riposte (`sword.riposte`) | 12 | 4 | 26 | 0 | 60 | 0 | — | unblockable, unparryable, invulnerable |
| Hollow Cleave (`sentinel.cleave`) | 40 | 6 | 42 | — | 34 | — | 50 | hyper-armoured |
| Hollow Cleave, delayed (`sentinel.cleave.delayed`) | 58 | 6 | 42 | — | 36 | — | 50 | same pose, held at the top; hyper-armoured |

## Weapons
Weapons are data (`src/data/weapons.ts`). The player state machine has no weapon-specific code; it reads the equipped weapon's moveset from `Equipment`.

| | Pilgrim's Sword | Mourning Crescent (scythe) |
|---|---|---|
| Light combo | 2 hits: 8/4/18, 7/4/22 frames | 3 hits: 10/6/19, 8/6/21, 12/9/30 frames |
| Light damage / posture | 26/14, 30/18 | 24/16, 26/18, 35/32 |
| Light stamina | 18, 20 | 17, 17, 20 |
| Reach (furthest connecting distance, feet to feet) | 46 px | 60 px |
| Arc | in front | high-to-low sweep, a backswing that also covers ~22 px behind, then a full spin |
| Heavy | 20/5/30, 34 stamina, 42 dmg | 24/7/40, 36 stamina, 58 dmg, 70 px wide arc |
| Charge | up to 42 frames, ×1.65 dmg | up to 50 frames, ×1.8 dmg, ×1.7 posture (bigger, greener glow) |
| Riposte | 60 dmg | 72 dmg |
| Upgrade scaling (per tier) | +10% | +9% |

The scythe trades speed for reach, coverage and posture pressure. The sword starts faster (8 vs 10 frames) and commits for less time, so it wins up close and on quick punishes. A missed scythe heavy still leaves 40 frames of recovery (the whiff penalty). Upgrade tiers live on owned weapon instances and are bought with Weapon XP (see *Progression* below).

### Balance benchmark (update 2B.1)
`tests/benchmark.ts` runs a reproducible 12 s fight against a pinned Sentinel dummy (health and posture refilled every step). *Sustained* presses only when stamina covers the next attack (how people play); *burst* mashes from full stamina. Sword at 20 px, scythe at 30 px. `tests/weapon-balance.test.ts` keeps the results inside guard rails.

| Benchmark | Sword | Scythe before | Scythe after |
|---|---|---|---|
| Light combo, sustained DPS | 26.2 | 20.8 (0.79×) | 24.5 (0.94×) |
| Light combo, burst DPS | 26.4 | 22.6 | 23.7 |
| Light damage per stamina | 1.26 | 0.95 | 1.25 |
| Light posture over 12 s | 204 | 156 | 244 |
| Heavy, sustained DPS | 24.0 | 21.5 | 25.0 |
| Charged heavy, sustained DPS | 25.4 | 25.7 | 30.7 |
| Reach | 46 px | 60 px | 60 px |

Why: in 2B the scythe lost on every axis except reach. It was slower, costlier and weaker per stamina, so it felt bad even when spacing well. The changes are a frame off every startup, about 20% less stamina, a harder finisher and heavy, more posture damage, and a stronger charge. Together they bring sustained light DPS to about 94% of the sword's, with equal damage per stamina. Its posture damage and charged heavy are now clearly better, and reach and arcs are untouched. The sword keeps the edge in speed, burst and short commitments. No weapon is better at everything.

**Switching weapons** (`Simulation.requestEquip`) is refused unless the player is idle, running, jumping, falling or landing. It can't change an active attack, hitbox, riposte or its stamina cost.

## Dodge roll (`src/config/movement.ts`)
2 startup frames (vulnerable) → 13 invincible frames → 8 recovery frames, ~80 px of travel, 28 stamina (about 3–4 rolls from full). From frame 18 a buffered jump, attack, roll or guard cancels the recovery. Rolls go in the held direction, or the facing direction when nothing is held. Rolling passes through enemies. Ground only for now (`allowInAir`).

## Stamina
100 max, 40/s regeneration after a 0.55 s delay. No regeneration while attacking, rolling, parrying or riposting; 60% while guarding. Emptying the meter applies a longer 1.1 s exhaustion delay. Souls rule: an action can start whenever stamina is above zero, even if it costs more than is left. Jumps cost 8 but are never blocked by low stamina, so the player can't get stuck in a pit.

## Guard (`src/config/combat.ts` → `GUARD`)
- Raised 3 frames after pressing; blocks **frontal** attacks only (attacker on the side you face).
- Blocked hit: 10% chip damage, stamina loss = attack's guard stamina × (1 − 0.2 stability), 14 frames of block-stun, small pushback.
- If the cost exceeds remaining stamina: **guard break**. Stamina empties, the player is helpless for 60 frames, and the Sentinel cancels its recovery to punish with its fast cleave.
- Every other action (roll, jump, attack, parry) cancels the guard instantly.

## Parry (`PARRY`)
4 startup frames → 8-frame window → 26 frames of whiff recovery, 15 stamina, ground only. A parryable, frontal hit landing in the window is negated. The parrier gets 12 invulnerable frames and is free to act. The attacker takes 60 posture damage and enters **parried** (75 frames) with a riposte opening. If that posture damage fills the meter it is a full **posture break** instead.

## Posture (enemies)
- Each hit adds its posture damage. Posture drains back at 20/s after 2.5 s without posture damage, so it rewards sustained pressure, not total damage.
- **Hyper-armour**: during the Sentinel's committed swings, hits don't flinch it, but posture still fills and a full meter still breaks it.
- **Posture break**: the meter fills → 110 frames on one knee with a riposte opening; posture resets afterwards. Hit-stop and a gold ring/gong mark it.
- Outside hyper-armour, hits flinch the Sentinel briefly (10+ frames).
- Sentinel posture: 120 max. A heavy (30) or charged heavy (up to 54) during its recovery, plus a light during its approach, builds toward a break over two or three exchanges. One parry (60) puts it halfway.

## Riposte (`RIPOSTE`)
Pressing light attack within 44 px (and 20 px vertically) of an enemy that is **parried** or **posture-broken** performs a riposte instead: player invulnerable, 12/4/26 frames, 60 base damage. The opening is consumed when the riposte starts (`claimRiposte`), so one opening allows exactly one riposte. A riposted Sentinel is knocked down for 60 frames, can't be riposted again, and its posture resets. Extra normal hits on a reeling enemy deal damage but don't extend the opening.

## Vowcarved Sentinel behaviour
- Walks into range (40 px) and picks a cleave by deterministic weighted choice: standard 65%, delayed 35%. After being parried, the weights flip (30/70), so repeated parrying is gambled against the delay.
- **Read the glint, not the windup**: the white glint always shows in the last third of the startup, for both variants.
- 0.9 s between attacks. Punishes a broken guard immediately.
- 180 HP, 2 defense, 10% absorption.

## Barrow Reaper behaviour
- Faster (74 px/s), notices you from further away (180 px), and keeps its distance: it closes to ~52 px and backs off inside 32 px. After an attack it hops back half the time.
- Attacks are chosen by distance, with deterministic weighted randomness:
  - **Low Reap** (0–60 px): 24 startup / 6 active / 26 recovery, 22 damage. A **low**, wide sweep (hitbox 20 px tall), so it can be jumped, rolled, or stepped back from. No hyper-armour, so a quick hit during the wind-up flinches it.
  - **Harvest Lunge** (44–120 px): 46 / 8 / 56 frames, 38 damage. A deep crouch with a **red** eye flare, then a ~75 px gliding dash and overhead chop. Hyper-armoured. The 56-frame recovery, with the scythe stuck in the ground, is the big punish window.
- Fragile: 110 HP, 80 posture (it breaks fast), no defence. It is parryable, blockable and riposte-able like the Sentinel. After being parried it favours the lunge.
- No attack starts faster than 24 frames (0.4 s), and each has a distinct glint. The sweep glints low by the blade, the lunge high and red.

## Rewards, loot and pickups
- **Currencies** (`rpg/Wallet.ts`): Character XP, Weapon XP and Gold, kept separate (materials are items, not a currency). Each enemy definition lists `rewards`. The simulation grants them when `Enemy.consumeDeath()` returns true, which happens **exactly once per death**. Respawns, lingering hits and repeated processing grant nothing.
- **Loot** (`world/Loot.ts`): each `loot` entry is rolled independently, once per death, on a dedicated seeded stream (`Simulation.lootRandom`) separate from AI randomness. Every entry always consumes the same random numbers, so eligibility rules (`condition: 'notOwned'`) never shift other rolls.
  - Reaper: Mourning Crescent 1% (rare, only if not already owned), Grave Dust 35% ×1–2.
  - Sentinel: Grave Dust 20%.
- **Pickups** (`world/Pickups.ts`): drops pop out of the enemy and stay in the world until collected, even after the enemy respawns. Walking over one collects it, after a 0.35 s pop. Collection happens once: the pickup is removed as it enters the inventory. Items that fall out of the world reappear next to the player.

## Progression: Weapon XP and upgrades
- **Weapon XP (WXP)** is one shared pool earned from kills (Sentinel 10, Reaper 20). It's spent to raise a *specific weapon instance* one tier; duplicate weapons keep separate tiers.
- **Cost curve** (`config/progression.ts`): tier L → L+1 costs `40 × 1.35^L`, rounded to 5 (40, 55, 75, 100, 135, 180, 240, 325, 440, 595; 2,185 WXP from +0 to +10). The maximum tier comes from the weapon (`upgrade.maxLevel`, 10 for both).
- **Transaction** (`rpg/WeaponUpgrades.ts`, reusable by a future blacksmith): validate ownership, weapon, the expected tier, max tier and balance → deduct once → raise the tier → mark the profile changed (it then saves). Any failure changes nothing. A repeated tap carries the old expected tier and is refused, so one press can never pay twice. `Simulation.upgradeWeapon` applies the new stats to the equipped weapon at the next neutral moment, never mid-attack.
- WXP is shown only in the pause menu, never on the combat HUD.
- **Save migration v1 → v2:** Forge Points become WXP at **1 FP = 10 WXP**, which matches what the same kills earn now.

## Enemy death
Death is a state the enemy enters once (`Enemy.markDead`, rewards via `consumeDeath`). From that step it has no hurtbox and no hitboxes, and a hit it landed in the same step it died is discarded (`CombatSystem` skips dead owners). It keeps no lunge momentum, only a 40 px/s shove from the killing blow. The sprite plays the death frames once from simulation state time and holds the last one. It then fades as set in its visual profile (`death: { fadeDelay, fadeDuration, remains, remainsAlpha }`). Training enemies respawn at their spawn point with full health and zero posture.

The 2B glitch: views called Phaser's `anims.play` every frame, which restarts a finished one-shot animation, so the collapse replayed in a loop while the body faded and slid. Frames are now picked by `animFrame(spec, fsm.time)` for every timed animation.

## Hit pipeline (`CombatSystem.step`)
1. Every combatant writes its active hitboxes into the pooled `HitDetection` sink (with the charge level).
2. **Detection** (geometry only): overlaps with opposing hurtboxes, once per attack execution per target. Invincible targets produce an `evade` event.
3. **Defense resolution** (`resolveDefense`, pure): parry / block / guard break / hit, from the target's `defense()` state, facing and the attack's `parryable`/`blockable` flags.
4. **Damage calculation** (`calculateDamage`, pure): damage and posture damage, including charge multipliers.
5. **Reactions**: `receiveHit`, `receiveBlock`, `receiveParrySuccess`, `onAttackParried` apply the result and emit presentation events.
6. Global hit-stop: clean hits use the attack's value; block 3, parry 10, guard break 8, posture break 10, riposte 14 frames. Inputs pressed during hit-stop stay buffered.

## Balance notes
Values worth playtesting by hand are listed in the PR and at the top of this file. Scripted bots (not human play) suggested:
- Spamming heavies without defending kills fast but costs most of your HP, and sometimes a death.
- Light-spam dies.
- Turtling behind the guard can't win.
- Perfect parry → riposte needs four flawless parries.
- Parrying on the windup instead of the glint is punished by the delayed cleave.

## Extension points
- **Movesets:** add running/jumping attacks and new weapon classes as `AttackDefinition`s plus `WeaponDefinition.moveset` entries.
- **Shields:** a shield would supply `GUARD`-like stability/reduction per item instead of the global config.
- **Enemy guarding:** implement `defense()` on an enemy; the resolver already handles it.
- **Magic and projectiles:** projectiles are combatants with hitboxes and no hurtbox.
- **Bosses:** multiple attack options with weights, hyper-armour per attack, and reaction frames in `EnemyDefinition`.
