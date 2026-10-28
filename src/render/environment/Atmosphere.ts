import Phaser from 'phaser';
import type { LevelData } from '../../world/Level';
import { buildVignette } from '../textures/environmentArt';
import { TEX } from '../textures/registerTextures';

const VIGNETTE_KEY = 'fx.vignette';

/** Spectral motes drifting through the level, a foreground fog sheen and a screen vignette. */
export class Atmosphere {
  private vignette: Phaser.GameObjects.Image | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    level: LevelData,
  ) {
    scene.add
      .particles(0, 0, TEX.mote, {
        x: { min: 0, max: level.widthPx },
        y: { min: 0, max: level.heightPx - 40 },
        lifespan: { min: 4000, max: 8000 },
        speedX: { min: -5, max: 5 },
        speedY: { min: -9, max: -2 },
        frequency: 140 / (level.environment.moteDensity ?? 1),
        quantity: 1,
        maxAliveParticles: Math.round(70 * (level.environment.moteDensity ?? 1)),
        tint: [...(level.environment.motes ?? [0x9fe8ff, 0xc8b8ff, 0xffffff])],
        alpha: { onUpdate: (_p, _k, t) => Math.sin(t * Math.PI) * 0.85, onEmit: () => 0 },
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(6);
    const fireflies = level.environment.fireflies ?? 0;
    if (fireflies > 0) {
      // Slow, blinking points low over the ground: life in the forest, never in the way.
      scene.add
        .particles(0, 0, TEX.mote, {
          x: { min: 0, max: level.widthPx },
          y: { min: level.heightPx * 0.45, max: level.heightPx - 72 },
          lifespan: { min: 3000, max: 6000 },
          speedX: { min: -8, max: 8 },
          speedY: { min: -6, max: 6 },
          frequency: 400 / fireflies,
          maxAliveParticles: Math.round(24 * fireflies),
          scale: 2,
          tint: [0xd8ff8a, 0xfff2a8],
          alpha: { onUpdate: (_p, _k, t) => Math.max(0, Math.sin(t * Math.PI * 3)) * 0.9, onEmit: () => 0 },
          blendMode: Phaser.BlendModes.ADD,
        })
        .setDepth(6);
    }
    this.resize();
  }

  resize(): void {
    const { width, height } = this.scene.scale;
    const w = Math.max(1, Math.ceil(width));
    const h = Math.max(1, Math.ceil(height));
    if (this.scene.textures.exists(VIGNETTE_KEY)) {
      this.vignette?.destroy();
      this.scene.textures.remove(VIGNETTE_KEY);
    }
    this.scene.textures.addCanvas(VIGNETTE_KEY, buildVignette(w, h));
    this.vignette = this.scene.add.image(0, 0, VIGNETTE_KEY).setOrigin(0, 0).setScrollFactor(0).setDepth(50);
  }
}
