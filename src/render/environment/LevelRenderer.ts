import Phaser from 'phaser';
import { TILE, type LevelData } from '../../world/Level';
import type { WorldProgress } from '../../world/WorldProgress';
import { GROUND_OFFSET, TILESET } from '../textures/environmentArt';
import { TEX } from '../textures/registerTextures';
import { LightRig, type LightHandle } from './lighting';
import { LAYER_DEPTH, LAYER_TINT, PROP_VISUALS } from './props';

interface ShrineView {
  id: string;
  image: Phaser.GameObjects.Image;
  lights: LightHandle[];
}

interface CacheView {
  id: string;
  image: Phaser.GameObjects.Image;
  light: LightHandle;
}

/**
 * Builds a level's look, in fixed depth bands (back to front): far and back
 * decoration, mid props, the tilemap (0), light spill and flames (1-2),
 * characters (8-10), front accents. Props come from `PROP_VISUALS`, lights
 * from `LightRig` presets, so regions only supply data. World objects show
 * saved progress: an unlit shrine is dim until activated; an opened cache
 * stays open.
 */
export class LevelRenderer {
  readonly rig: LightRig;
  private readonly shrines: ShrineView[] = [];
  private readonly caches: CacheView[] = [];

  constructor(
    scene: Phaser.Scene,
    level: LevelData,
    private readonly progress: WorldProgress | null = null,
  ) {
    this.rig = new LightRig(scene);
    const ground = GROUND_OFFSET[level.environment.ground ?? 'stone'];
    const data = level.tiles.map((row, r) =>
      row.map((kind, c) => {
        if (kind === TILE.empty) return -1;
        const masonry = level.masonry[r]?.[c] ?? false;
        const base = masonry ? GROUND_OFFSET.stone : ground;
        if (kind === TILE.oneWay) return base + (masonry ? TILESET.slab : TILESET.oneWay);
        const above = level.tiles[r - 1]?.[c] ?? TILE.solid;
        if (above !== TILE.solid) return base + TILESET.top;
        const left = row[c - 1] ?? TILE.solid;
        const right = row[c + 1] ?? TILE.solid;
        if (left !== TILE.solid || right !== TILE.solid) return base + TILESET.wall;
        return base + ((c * 7 + r * 13) % 5 === 0 ? TILESET.innerB : TILESET.innerA);
      }),
    );
    const map = scene.make.tilemap({ data, tileWidth: level.tileSize, tileHeight: level.tileSize });
    const tileset = map.addTilesetImage(TEX.tiles, TEX.tiles, level.tileSize, level.tileSize, 0, 0);
    if (tileset) map.createLayer(0, tileset, 0, 0)?.setDepth(0);

    // Props in authoring order; Phaser keeps insertion order within equal depths.
    for (const prop of level.props) {
      const v = PROP_VISUALS[prop.kind];
      const image = scene.add
        .image(prop.x, prop.y, v.texture)
        .setOrigin(0.5, 1)
        .setDepth(v.depth ?? LAYER_DEPTH[prop.layer])
        .setFlipX(prop.flip)
        .setTint(LAYER_TINT[prop.layer]);
      if (v.alpha !== undefined) image.setAlpha(v.alpha);
      if (v.scale !== undefined) image.setScale(v.scale);
      if (v.additive) image.setBlendMode(Phaser.BlendModes.ADD);
      const mirror = prop.flip ? -1 : 1;
      for (const l of v.lights ?? []) this.rig.add(l.name, prop.x + l.dx * mirror, prop.y + l.dy, l.flameDy !== undefined ? prop.y + l.flameDy : undefined);
      if (v.shaft) {
        // Dust drifting inside the shaft only.
        const w = image.width * 0.6;
        scene.add
          .particles(0, 0, TEX.mote, {
            x: { min: prop.x - w / 2, max: prop.x + w / 2 },
            y: { min: prop.y - image.height, max: prop.y - 8 },
            lifespan: { min: 3000, max: 6000 },
            speedX: { min: -3, max: 3 },
            speedY: { min: 1, max: 5 },
            frequency: 260,
            maxAliveParticles: 18,
            tint: [0xfff2d0, 0xffffff],
            alpha: { onUpdate: (_p, _k, t) => Math.sin(t * Math.PI) * 0.8, onEmit: () => 0 },
            blendMode: Phaser.BlendModes.ADD,
          })
          .setDepth(7.5);
      }
    }

    for (const o of level.objects) {
      if (o.kind === 'checkpoint') {
        const image = scene.add.image(o.x, o.y, TEX.shrine).setOrigin(0.5, 1).setDepth(-5);
        this.shrines.push({ id: o.id, image, lights: [this.rig.add('shrine', o.x, o.y - 40)] });
      } else if (o.kind === 'cache') {
        const image = scene.add.image(o.x, o.y, TEX.cacheClosed).setOrigin(0.5, 1).setDepth(-3);
        this.caches.push({ id: o.id, image, light: this.rig.add('treasure', o.x, o.y - 8) });
      } else if (o.kind === 'lore') {
        scene.add.image(o.x, o.y, TEX.lore).setOrigin(0.5, 1).setDepth(-4);
        this.rig.add('divine', o.x, o.y - 8);
      }
      // Exits are marked by the region's own decoration (waymarkers, arches), not a generic glow.
    }
    this.refreshObjects();
  }

  /** Show saved state: lit/unlit shrines, open/closed caches. Call after an activation or opening. */
  refreshObjects(): void {
    for (const s of this.shrines) {
      const active = this.progress?.isActive(s.id) ?? true;
      s.image.setTint(active ? 0xffffff : 0x8a86a0);
      for (const l of s.lights) this.rig.setLevel(l, active ? 1 : 0.12);
    }
    for (const c of this.caches) {
      const opened = this.progress?.hasFlag(c.id) ?? false;
      c.image.setTexture(opened ? TEX.cacheOpen : TEX.cacheClosed);
      this.rig.setLevel(c.light, opened ? 0 : 1);
    }
  }

  /** Purely cosmetic flicker and flame animation, independent of the simulation. */
  update(dt: number): void {
    this.rig.update(dt);
  }
}
