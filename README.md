# SEVEN HALOS

A 2D pixel-art dark-fantasy action RPG in the Soulslike tradition. A Creator made seven gods, each given a Halo and a share in shaping the world. They loved one another like siblings until their own choices led to betrayal, centuries of war and mutual destruction. A blind oracle foresees a mortal who gathers the seven Halos, resurrects and reconciles the Seven, and receives an eighth Halo from the Creator, becoming the God and King of Humanity.

This repository holds the game. It currently contains **the first small, persistent world**: a sanctuary and a forest road joined by doorways, shrine checkpoints with resting and fast travel, a one-time treasure cache, and the combat systems (two weapon classes, two enemy types, currencies, loot, inventory and upgrades), all saved in the browser. The original combat test chamber is still available in development builds.

## Tech
Phaser 4 · TypeScript (strict) · Vite · Vitest · npm. Runs in modern mobile and desktop browsers.

## Run it
```bash
npm install
npm run dev          # dev server on your LAN (vite --host); open the printed Network URL
```
To play on a phone, open the dev server's Network URL on a phone on the same Wi-Fi network. You can also deploy to GitHub Pages (see below).

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | Vitest: movement, combat and core rules |
| `npm run build` | Type-check, then **commercial** production build to `dist/` (no development tools) |
| `npm run build:test` | Production build **with** development tools (what the GitHub Pages preview serves) |
| `npm run preview` | Serve the last build |
| `npm run check` | Type-check + tests + commercial build + a check that no dev tools leaked into it (what CI runs) |

## Controls
| Action | Keyboard | Touch |
|---|---|---|
| Move | A/D or ←/→ | Joystick: put a thumb anywhere on the left side of the screen |
| Jump (hold for higher) | Space, W, ↑, Z | JUMP |
| Light attack (riposte when an enemy shows the gold ◆) | J, X | ATK |
| Heavy attack (hold to charge) | K, V | HEAVY |
| Dodge roll | L, C | ROLL |
| Guard (hold) | Shift, O | GUARD |
| Parry | P, F | PARRY |
| Drop through platform | ↓/S + Jump | Joystick down + JUMP |
| Pause menu: equipment, backpack, upgrades (pauses the game) | I, Tab (Esc or I closes; arrows move, Enter selects) | MENU (top right) |
| Pick up items | walk over them | walk over them |
| Use a shrine, cache or door (a prompt appears when you're close) | E, Enter | tap the prompt |
| Debug overlay | ` or F3 | DBG (also shows a dot for each finger) |

Add `?debug=1` to the URL to start with the hitbox/state overlay on. Use `?touch=1` or `?touch=0` to force the touch controls on or off.

## The world
You start just outside the **sanctuary**, a ruined refuge that will become your home base.
- In the hall stands **the Oracle**. Walk up to her and press **E** (or tap **Talk · The Oracle**). Tap the panel, or press Enter, to continue; Esc or ✕ ends the conversation. Her task, **The First Omen**, sends you down the forest road and back. Afterwards the main quest begins: the Seven Halos (0/7).
- **MENU → Journal** shows your quests and current objective, and everything you've read. Old stones by the roads have something to say (**Read**).
1. Walk right into the hall. Stand at the **shrine** and press **E** (or tap **Light the shrine**). Lit shrines are where you return when you fall.
2. Using a lit shrine opens its menu:
   - **Rest:** full health; ordinary enemies return.
   - **Travel:** go to any other lit shrine.
   - **Leave.**
3. Keep walking right, out of the sanctuary, onto the **Forest Road**:
   - a Sentinel on the forest floor;
   - a ravine crossed on stepping stones (fall in and climb out on the far side);
   - a tall tree to climb, with a **treasure cache** at the top (it opens once);
   - a clearing with a Reaper and another Sentinel;
   - the **Forest Road Shrine**;
   - a road that ends at a sealed gate, the way to the first castle (a later update).
4. Enemies you defeat stay down until you rest or die. If you die, you wake at the last shrine you used, with all your items and currencies.
5. Everything permanent (lit shrines, the opened cache, items, equipment, currencies, where you were) survives a page reload.

## Test chamber (development builds)
Open **MENU → Progression → Development tools → Go to the Test Chamber**, or add `?region=test-chamber` to the URL. The same menu button brings you back to the sanctuary.

From left to right:
1. **Movement course:** the start shrine, 1- and 2-tile steps, one-way platforms, a 3-tile pillar (max jump height), and a 4-tile pit (running jump; falling costs 25 HP).
2. **Vowcarved Sentinel arena.**
3. **Corridor and climb:** a low-ceiling corridor, and a one-way climb to a hidden ledge.
4. **Barrow Reaper arena**, across a 3-tile gap.
5. **Comparison area**, over a low pillar: a Sentinel holds the floor, and a second Reaper guards a raised ledge that ends at the **armoury altar**.

The Sentinel walks into range and raises its greatsword: a long windup, an eye flare, a glint and a rising tone. Sometimes it holds the sword at the top longer (delayed cleave), so react to the **glint**, not the windup. You can:
- **roll** through the swing and punish it during its long recovery;
- **guard** it, at a heavy stamina cost (run out and your guard breaks);
- **parry** it just before it lands, then press attack for a **riposte**;
- break its **posture** (gold bar under its health) with heavy and charged attacks for another riposte opening.

It respawns 4 s after it dies. See [docs/COMBAT.md](docs/COMBAT.md) for all the numbers.

The **Barrow Reaper** is faster and keeps its distance. It has two attacks:
- **Low Reap:** a wide sweep along the ground, with a glint low by the blade. Jump it, roll it, or step back out of reach.
- **Harvest Lunge:** a crouching wind-up with a **red** eye flare, then a gliding dash and an overhead chop. Its long recovery is the time to punish.

It's fragile and breaks posture easily.

## Rewards, loot and equipment
- Every kill grants **Character XP** and **Gold** (shown under the health bars) and **Weapon XP** (shown only in the menu). Sentinel: 40 / 12 / 10 WXP. Reaper: 65 / 20 / 20 WXP.
- Enemies roll a drop table once per death. Drops land as glowing pickups and stay until you walk over them:
  - **Grave Dust** is a stacking crafting material (used in a later update).
  - The Reaper has a **1% chance** to drop its scythe, the **Mourning Crescent**. Rare drops get a gold beam and a banner.
- **MENU** pauses the game. It has four areas: **Equipment** (nine slots, only the main hand works so far), **Backpack** (a grid of everything you own), **Item** details (stats compared with your equipped weapon) and **Progression** (currencies and the next upgrade).
  - Equip by dragging an item onto a glowing slot. On a phone, press and hold (or swipe sideways) to pick it up. Or tap the item, then tap the glowing slot, or use the Equip button.
  - Drag items within the backpack to rearrange them; the order is saved.
  - **Upgrade** spends Weapon XP to raise the selected weapon one tier (+10% damage per tier for the sword, +9% for the scythe).
  - Weapons can't be changed mid-action. Nothing you pressed before or during the menu fires when you close it.
- Progress (currencies, items and their order, tiers, equipment, world progress) saves automatically in the browser. Older saves are upgraded automatically and backed up first: from update 2B, Forge Points become Weapon XP at ×10; from 2B.2, everything is kept and you start at the sanctuary.

### Testing the scythe without farming (test builds only)
The GitHub Pages preview and `npm run dev` include development tools. A plain `npm run build` (the basis for commercial releases) compiles them out, and `npm run check` verifies that.
- The **armoury altar** at the far east end holds a Mourning Crescent if you don't own one yet. Walk over it.
- **MENU → Progression → Development tools** offers: Grant Mourning Crescent, Drop scythe in front, + Currencies (500 XP, 200 Gold, 300 WXP), Reset save.

## Phone preview via GitHub Pages
`.github/workflows/deploy-pages.yml` runs `npm run check`, then publishes a **test build** (`npm run build:test`, development tools on) on every push to `main`. It can also be run manually.

1. Once: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Merge to `main` (or run the workflow manually from `main`).
3. Play at `https://<owner>.github.io/seven-halos/`.

The `github-pages` environment only accepts deployments from the default branch by default. To deploy a feature branch, add it under **Settings → Environments → github-pages → Deployment branches**.

On iPhone, use **Share → Add to Home Screen** for full-screen landscape play. iOS Safari does not support the Fullscreen API.

## Docs
- [CLAUDE.md](CLAUDE.md): conventions for contributors and AI agents
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/WORLD.md](docs/WORLD.md): regions, shrines and how to add a region
- [docs/COMBAT.md](docs/COMBAT.md)
- [docs/ANIMATION.md](docs/ANIMATION.md)
- [docs/MILESTONES.md](docs/MILESTONES.md)
- [docs/NAMING.md](docs/NAMING.md): originality screening log for new names
- [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md): third-party software and asset licences
