import Phaser from 'phaser';
import { TILE, type LevelData } from '../../world/Level';
import type { WorldProgress } from '../../world/WorldProgress';
import { TEX } from '../textures/registerTextures';
import { TILESET } from '../textures/environmentArt';

export interface LightSource {
  image: Phaser.GameObjects.Image;
  baseAlpha: number;
  baseScale: number;
  phase: number;
  flicker: number;
}

interface ShrineView {
  id: string;
  image: Phaser.GameObjects.Image;
  lights: LightSource[];
}

interface CacheView {
  id: string;
  image: Phaser.GameObjects.Image;
  light: LightSource;
}

/**
 * Builds the tilemap, props, world objects (shrines, caches, doorways) and
 * their light sources for a level. Objects reflect saved progress: an
 * unlit shrine is dim until activated; an opened cache stays open.
 */
export class LevelRenderer {
  readonly lights: LightSource[] = [];
  private time = 0;
  private readonly shrines: ShrineView[] = [];
  private readonly caches: CacheView[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    level: LevelData,
    private readonly progress: WorldProgress | null = null,
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
      } else if (prop.kind === 'altar') {
        scene.add.image(prop.x, prop.y, TEX.altar).setOrigin(0.5, 1).setDepth(-4);
        this.addLight(prop.x, prop.y - 12, 0x9fe8ff, 0.3, 1.8, 0.06);
      } else if (prop.kind === 'tree') {
        scene.add.image(prop.x, prop.y + 2, TEX.tree).setOrigin(0.5, 1).setDepth(-6);
      } else if (prop.kind === 'bush') {
        scene.add.image(prop.x, prop.y + 1, TEX.bush).setOrigin(0.5, 1).setDepth(4);
      } else if (prop.kind === 'ruin') {
        scene.add.image(prop.x, prop.y, TEX.ruin).setOrigin(0.5, 1).setDepth(-6);
      } else if (prop.kind === 'plinth') {
        scene.add.image(prop.x, prop.y, TEX.plinth).setOrigin(0.5, 1).setDepth(-4);
      } else if (prop.kind === 'sanctuary') {
        scene.add.image(prop.x, prop.y, TEX.sanctuary).setOrigin(0.5, 1).setDepth(-20);
        this.addLight(prop.x, prop.y - 70, 0xffd9a0, 0.22, 7, 0.02);
      } else if (prop.kind === 'gate') {
        scene.add.image(prop.x, prop.y, TEX.gate).setOrigin(0.5, 1).setDepth(-4);
        this.addLight(prop.x, prop.y - 36, 0xc8b8ff, 0.18, 2.6, 0.04);
      } else {
        scene.add.image(prop.x, prop.y, TEX.lore).setOrigin(0.5, 1).setDepth(-4);
        this.addLight(prop.x, prop.y - 8, 0x9fe8ff, 0.4, 1.2, 0.1);
      }
    }

    for (const o of level.objects) {
      if (o.kind === 'checkpoint') {
        const image = scene.add.image(o.x, o.y, TEX.shrine).setOrigin(0.5, 1).setDepth(-5);
        const lights = [this.addLight(o.x, o.y - 40, 0xe8c77a, 0.35, 1.6, 0.05), this.addLight(o.x, o.y - 22, 0x9fb6ff, 0.18, 3.2, 0.02)];
        this.shrines.push({ id: o.id, image, lights });
      } else if (o.kind === 'cache') {
        const image = scene.add.image(o.x, o.y, TEX.cacheClosed).setOrigin(0.5, 1).setDepth(-3);
        this.caches.push({ id: o.id, image, light: this.addLight(o.x, o.y - 8, 0xffd27a, 0.35, 1.1, 0.12) });
      } else {
        // A doorway: a faint column of light so the way on is visible.
        const z = o.zone;
        this.addLight(z.x + z.w / 2, z.y + z.h / 2, 0xc8e0ff, 0.16, Math.max(z.h, z.w) / 28, 0.04);
      }
    }
    this.refreshObjects();
  }

  /** Show saved state: lit/unlit shrines, open/closed caches. Call after an activation or opening. */
  refreshObjects(): void {
    for (const s of this.shrines) {
      const active = this.progress?.isActive(s.id) ?? true;
      s.image.setTint(active ? 0xffffff : 0x8a86a0);
      s.lights.forEach((l, i) => (l.baseAlpha = active ? (i === 0 ? 0.5 : 0.24) : 0.04));
    }
    for (const c of this.caches) {
      const opened = this.progress?.hasFlag(c.id) ?? false;
      c.image.setTexture(opened ? TEX.cacheOpen : TEX.cacheClosed);
      c.light.baseAlpha = opened ? 0 : 0.35;
    }
  }

  private addLight(x: number, y: number, tint: number, alpha: number, scale: number, flicker: number): LightSource {
    const image = this.scene.add.image(x, y, TEX.glow).setTint(tint).setAlpha(alpha).setScale(scale).setBlendMode(Phaser.BlendModes.ADD).setDepth(-2);
    const light = { image, baseAlpha: alpha, baseScale: scale, phase: x * 0.13, flicker };
    this.lights.push(light);
    return light;
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
