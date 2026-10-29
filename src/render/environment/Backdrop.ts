import type Phaser from 'phaser';
import type { EnvironmentConfig } from '../../world/Level';
import { TEX } from '../textures/registerTextures';

/** Per-backdrop tints over the shared placeholder layers: sky, far, mid, fog. */
const TINTS: Record<NonNullable<EnvironmentConfig['backdrop']>, readonly [number, number, number, number]> = {
  ruins: [0xffffff, 0xffffff, 0xffffff, 0xffffff],
  // Forest: green-gold canopy light instead of cold violet.
  forest: [0xb0c8c0, 0xffffff, 0xffffff, 0xb8e0b0],
  // Sanctuary: a warmer dusk.
  sanctuary: [0xffd6c4, 0xe0c4cc, 0xd8c0c0, 0xffe4c8],
  // Underground: no tint over its own dark art; the fog turns a cold teal.
  cave: [0xffffff, 0xffffff, 0xffffff, 0x406060],
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
  private readonly landmark: { image: Phaser.GameObjects.Image; x: number } | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    /** World Y of the level's main floor; layers rest on this line. */
    private readonly horizonY: number,
    environment: EnvironmentConfig = {},
  ) {
    const cave = environment.backdrop === 'cave';
    // Underground there is no sky and no moon: just rock fading into darkness.
    this.sky = scene.add.tileSprite(0, 0, 16, 16, cave ? TEX.caveBack : TEX.sky).setOrigin(0, 0).setScrollFactor(0).setDepth(-100);
    this.moon = scene.add.image(0, 0, TEX.moon).setScrollFactor(0).setDepth(-99).setVisible(!cave);
    // Forests swap the ruined skyline for tree lines; everything else is shared.
    // The ruined-arch skyline belongs to the old ruins only; the sanctuary is ringed by
    // woods (no free-floating arches behind a building), the forest is all trees.
    const forest = environment.backdrop === 'forest';
    const wooded = forest || environment.backdrop === 'sanctuary';
    this.addLayer(cave ? TEX.caveFar : forest ? TEX.forestFar : TEX.far, 0.08, 0.05, -70, 0, -90);
    this.addLayer(cave ? TEX.caveMid : wooded ? TEX.forestMid : TEX.mid, 0.3, 0.2, -40, 0, -80);
    this.addLayer(TEX.fog, 0.55, 0.4, -30, 6, -70).sprite.setAlpha(cave ? 0.35 : 0.8);
    if (environment.landmark) {
      // Between the sky and the far tree line, so the tree line hides its base.
      const image = scene.add.image(0, 0, TEX.castle).setOrigin(0.5, 1).setScrollFactor(0).setDepth(-95).setScale(0.6);
      this.landmark = { image, x: environment.landmark.x };
    }
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
    if (this.landmark) {
      const far = this.layers[0]!;
      const w = this.scene.scale.width;
      // Centred on screen when the camera is centred on the landmark; moves at the far layer's rate.
      this.landmark.image.x = Math.round(w / 2 + (this.landmark.x - (sx + w / 2)) * far.factorX * 2);
      this.landmark.image.y = far.sprite.y - 70;
    }
    for (const l of this.layers) {
      l.sprite.tilePositionX = Math.round(sx * l.factorX + this.drift * l.driftSpeed);
      // Relative to the scroll at which the floor line sits ~60% down the screen, a
      // layer with vertical factor f moves f times as fast as the world. Works
      // for any level height (the floor line, not the level top, is the reference).
      const ref = this.horizonY - this.scene.scale.height * 0.6;
      l.sprite.y = Math.round(this.horizonY - l.baseOffset - ref - (sy - ref) * l.factorY);
    }
  }
}
