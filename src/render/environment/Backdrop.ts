import type Phaser from 'phaser';
import type { EnvironmentConfig } from '../../world/Level';
import { TEX } from '../textures/registerTextures';

/** Per-backdrop tints over the shared placeholder layers: sky, far, mid, fog. */
const TINTS: Record<NonNullable<EnvironmentConfig['backdrop']>, readonly [number, number, number, number]> = {
  ruins: [0xffffff, 0xffffff, 0xffffff, 0xffffff],
  // Forest: green-gold canopy light instead of cold violet.
  forest: [0xa8c8b0, 0x7fa886, 0x6f9a6c, 0xb8e0b0],
  // Sanctuary: a warmer dusk.
  sanctuary: [0xffd6c4, 0xe0c4cc, 0xd8c0c0, 0xffe4c8],
};

interface Layer {
  sprite: Phaser.GameObjects.TileSprite;
  factorX: number;
  factorY: number;
  /** Height of the layer's bottom edge above the floor line, px (negative tucks it below the floor). */
  baseOffset: number;
  driftSpeed: number;
}

/**
 * Screen-space parallax. Layers are TileSprites fixed to the camera whose
 * texture offset follows camera scroll at a fraction of its speed.
 */
export class Backdrop {
  private readonly layers: Layer[] = [];
  private readonly sky: Phaser.GameObjects.TileSprite;
  private readonly moon: Phaser.GameObjects.Image;
  private drift = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    /** World Y of the level's main floor; layers rest on this line. */
    private readonly horizonY: number,
    environment: EnvironmentConfig = {},
  ) {
    this.sky = scene.add.tileSprite(0, 0, 16, 16, TEX.sky).setOrigin(0, 0).setScrollFactor(0).setDepth(-100);
    this.moon = scene.add.image(0, 0, TEX.moon).setScrollFactor(0).setDepth(-99);
    this.addLayer(TEX.far, 0.08, 0.05, -70, 0, -90);
    this.addLayer(TEX.mid, 0.3, 0.2, -40, 0, -80);
    this.addLayer(TEX.fog, 0.55, 0.4, -30, 6, -70).sprite.setAlpha(0.8);
    const tint = TINTS[environment.backdrop ?? 'ruins'];
    this.sky.setTint(tint[0]);
    this.layers.forEach((l, i) => l.sprite.setTint(tint[i + 1]!));
    this.resize();
  }

  private addLayer(key: string, factorX: number, factorY: number, baseOffset: number, driftSpeed: number, depth: number): Layer {
    const frame = this.scene.textures.getFrame(key);
    const sprite = this.scene.add.tileSprite(0, 0, 16, frame.height, key).setOrigin(0, 1).setScrollFactor(0).setDepth(depth);
    const layer = { sprite, factorX, factorY, baseOffset, driftSpeed };
    this.layers.push(layer);
    return layer;
  }

  resize(): void {
    const { width, height } = this.scene.scale;
    this.sky.setSize(width, height);
    for (const l of this.layers) l.sprite.setSize(width + 2, l.sprite.height);
    this.moon.setPosition(Math.round(width * 0.78), Math.round(height * 0.2));
  }

  update(camera: Phaser.Cameras.Scene2D.Camera, dt: number): void {
    this.drift += dt;
    const sx = camera.scrollX;
    const sy = camera.scrollY;
    // The sky barely moves: it reads as infinitely distant.
    this.sky.tilePositionX = Math.round(sx * 0.02);
    for (const l of this.layers) {
      l.sprite.tilePositionX = Math.round(sx * l.factorX + this.drift * l.driftSpeed);
      // A layer at world line Y with vertical factor f appears at Y - scrollY * f.
      l.sprite.y = Math.round(this.horizonY - l.baseOffset - sy * l.factorY);
    }
  }
}
