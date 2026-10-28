# Third-party software and content

All game art, animation and sound in this repository are **original and procedural**, generated at runtime by code in `src/render/textures/` and `src/audio/`. No third-party images, fonts, sounds, music or code have been imported. UI text uses the device's system monospace font, nothing is bundled.

## Runtime dependency (shipped in the game bundle)
| Package | Licence | Obligation |
|---|---|---|
| [Phaser](https://github.com/phaserjs/phaser) 4.2.1 | MIT | Keep the copyright and licence notice with distributed copies (e.g. an in-game credits/licences screen or a bundled LICENSES file before release). |

## Development-only tools (not shipped)
| Package | Licence |
|---|---|
| TypeScript 7 | Apache-2.0 |
| Vite 8 | MIT |
| Vitest 5 | MIT |
| Playwright / Chromium (used only for automated browser checks in CI-like sessions) | Apache-2.0 / BSD |

## Before release
- Add a licences/credits screen (or a LICENSES file in store builds) containing Phaser's MIT notice.
- Record any future asset packs, fonts or audio here with their licence and commercial-use terms *before* they're added.
