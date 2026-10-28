# SEVEN HALOS

A 2D pixel-art dark-fantasy action RPG in the Soulslike tradition. A Creator made seven gods, each given a Halo and a share in shaping the world. They loved one another like siblings until their own choices led to betrayal, centuries of war and mutual destruction. A blind oracle foresees a mortal who gathers the seven Halos, resurrects and reconciles the Seven, and receives an eighth Halo from the Creator, becoming the God and King of Humanity.

This repository holds the game. It currently contains a **playable combat-and-rewards test chamber**: two weapon classes, two enemy types, currencies, randomized loot, a small inventory and browser saves.

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
| Debug overlay | ` or F3 | DBG (also shows a dot for each finger) |

Add `?debug=1` to the URL to start with the hitbox/state overlay on. Use `?touch=1` or `?touch=0` to force the touch controls on or off.

## Test chamber
From left to right:
1. **Movement course:** the start shrine, 1- and 2-tile steps, one-way platforms, a 3-tile pillar (max jump height), and a 4-tile pit (running jump; falling costs 25 HP).
2. **Hollow Sentinel arena.**
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
- Progress (currencies, items and their order, tiers, equipment) saves automatically in the browser. Saves from update 2B are upgraded automatically: Forge Points become Weapon XP at ×10, and the old save is backed up first.

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
- [docs/COMBAT.md](docs/COMBAT.md)
- [docs/ANIMATION.md](docs/ANIMATION.md)
- [docs/MILESTONES.md](docs/MILESTONES.md)
- [docs/NAMING.md](docs/NAMING.md): originality screening log for new names
- [docs/THIRD_PARTY.md](docs/THIRD_PARTY.md): third-party software and asset licences
