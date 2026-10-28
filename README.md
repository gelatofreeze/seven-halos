# SEVEN HALOS

A 2D pixel-art dark-fantasy action RPG in the Soulslike tradition. A Creator made seven gods, each given a Halo and a share in shaping the world. They loved one another like siblings until their own choices led to betrayal, centuries of war and mutual destruction. A blind oracle foresees a mortal who gathers the seven Halos, resurrects and reconciles the Seven, and receives an eighth Halo from the Creator, becoming the God and King of Humanity.

This repository holds the game. It is currently at **Phase 1: a playable movement and combat test chamber**.

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
| `npm run build` | Type-check, then production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run check` | Type-check + tests + build (what CI runs) |

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
| Debug overlay | ` or F3 | DBG (also shows a dot for each finger) |

Add `?debug=1` to the URL to start with the hitbox/state overlay on. Use `?touch=1` or `?touch=0` to force the touch controls on or off.

## Test chamber
From left to right: the start shrine, 1- and 2-tile steps, one-way platforms, a 3-tile pillar (max jump height), a 4-tile pit (running jump; falling costs 25 HP), the Hollow Sentinel arena, a low-ceiling corridor, and a one-way climb to a hidden ledge.

The Sentinel walks into range and raises its greatsword: a long windup, an eye flare, a glint and a rising tone. Sometimes it holds the sword at the top longer (delayed cleave), so react to the **glint**, not the windup. You can:
- **roll** through the swing and punish it during its long recovery;
- **guard** it, at a heavy stamina cost (run out and your guard breaks);
- **parry** it just before it lands, then press attack for a **riposte**;
- break its **posture** (gold bar under its health) with heavy and charged attacks for another riposte opening.

It respawns 4 s after it dies. See [docs/COMBAT.md](docs/COMBAT.md) for all the numbers.

## Phone preview via GitHub Pages
`.github/workflows/deploy-pages.yml` builds and publishes `dist/` on every push to `main`, and can also be run manually.

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
