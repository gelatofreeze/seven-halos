import Phaser from 'phaser';
import { TILE, type LevelData } from '../../world/Level';
import { TEX } from '../textures/registerTextures';
import { TILESET } from '../textures/environmentArt';

export interface LightSource {
  image: Phaser.GameObjects.Image;
  baseAlpha: number;
  baseScale: number;
  phase: number;
  flicker: number;
}

/** Builds the tilemap, props and their light sources for a level. */
export class LevelRenderer {
  readonly lights: LightSource[] = [];
  private time = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    level: LevelData,
  ) {
    const data = level.tiles.map((row, r) =>
      row.map((kind, c) => {
        if (kind === TILE.empty) return -1;
        if (kind === TILE.oneWay) return TILESET.oneWay;
        const above = level.tiles[r - 1]?.[c] ?? TILE.solid;
        if (above !== TILE.solid) return TILESET.top;
        const left = row[c - 1] ?? TILE.solid;
        const right = row[c + 1] ?? TILE.solid;
        if (left !== TILE.solid || right !== TILE.solid) return TILESET.wall;
        return (c * 7 + r * 13) % 5 === 0 ? TILESET.innerB : TILESET.innerA;
      }),
    );
    const map = scene.make.tilemap({ data, tileWidth: level.tileSize, tileHeight: level.tileSize });
    const tileset = map.addTilesetImage(TEX.tiles, TEX.tiles, level.tileSize, level.tileSize, 0, 0);
    if (tileset) map.createLayer(0, tileset, 0, 0)?.setDepth(0);

    for (const prop of level.props) {
      if (prop.kind === 'shrine') {
        scene.add.image(prop.x, prop.y, TEX.shrine).setOrigin(0.5, 1).setDepth(-5);
        this.addLight(prop.x, prop.y - 40, 0xe8c77a, 0.35, 1.6, 0.05);
        this.addLight(prop.x, prop.y - 22, 0x9fb6ff, 0.18, 3.2, 0.02);
      } else if (prop.kind === 'brazier') {
        scene.add.image(prop.x, prop.y, TEX.brazier).setOrigin(0.5, 1).setDepth(-4);
        this.addLight(prop.x, prop.y - 19, 0xff9a40, 0.55, 1.5, 0.18);
        this.addLight(prop.x, prop.y - 16, 0xff7a30, 0.16, 4.5, 0.08);
        scene.add
          .particles(prop.x, prop.y - 20, TEX.ember, {
            lifespan: { min: 600, max: 1300 },
            speedY: { min: -34, max: -14 },
            speedX: { min: -6, max: 6 },
            frequency: 160,
            quantity: 1,
            alpha: { start: 1, end: 0 },
            blendMode: Phaser.BlendModes.ADD,
          })
          .setDepth(-3);
      } else {
        scene.add.image(prop.x, prop.y, TEX.lore).setOrigin(0.5, 1).setDepth(-4);
        this.addLight(prop.x, prop.y - 8, 0x9fe8ff, 0.4, 1.2, 0.1);
      }
    }
  }

  private addLight(x: number, y: number, tint: number, alpha: number, scale: number, flicker: number): void {
    const image = this.scene.add.image(x, y, TEX.glow).setTint(tint).setAlpha(alpha).setScale(scale).setBlendMode(Phaser.BlendModes.ADD).setDepth(-2);
    this.lights.push({ image, baseAlpha: alpha, baseScale: scale, phase: x * 0.13, flicker });
  }

  /** Purely cosmetic flicker, independent of the simulation. */
  update(dt: number): void {
    this.time += dt;
    for (const l of this.lights) {
      const n = Math.sin(this.time * 9 + l.phase) * 0.5 + Math.sin(this.time * 23 + l.phase * 2) * 0.3;
      l.image.setAlpha(l.baseAlpha * (1 + n * l.flicker * 2));
      l.image.setScale(l.baseScale * (1 + n * l.flicker * 0.3));
    }
  }
}
