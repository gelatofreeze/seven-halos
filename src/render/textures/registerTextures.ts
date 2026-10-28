import type Phaser from 'phaser';
import { DISPLAY } from '../../config/display';
import { PLAYER_ANIMS, PLAYER_SHEET, SENTINEL_ANIMS, SENTINEL_SHEET, type AnimSpec, type SheetSpec } from '../animation/specs';
import { buildPlayerSheet, buildSentinelSheet } from './characterArt';
import {
  buildBrazier,
  buildFarLayer,
  buildFog,
  buildLoreStone,
  buildMidLayer,
  buildMoon,
  buildPixel,
  buildRadialGlow,
  buildShrine,
  buildSky,
  buildTileset,
} from './environmentArt';

/** Texture keys used by the presentation layer. Final art loaded via the Loader must use the same keys. */
export const TEX = {
  player: PLAYER_SHEET.key,
  sentinel: SENTINEL_SHEET.key,
  tiles: 'tiles',
  sky: 'bg.sky',
  moon: 'bg.moon',
  far: 'bg.far',
  mid: 'bg.mid',
  fog: 'bg.fog',
  glow: 'fx.glow',
  spark: 'fx.spark',
  mote: 'fx.mote',
  dust: 'fx.dust',
  ember: 'fx.ember',
  shrine: 'prop.shrine',
  brazier: 'prop.brazier',
  lore: 'prop.lore',
} as const;

function addSheet(textures: Phaser.Textures.TextureManager, spec: SheetSpec, canvas: HTMLCanvasElement): void {
  const texture = textures.addCanvas(spec.key, canvas);
  if (!texture) return;
  for (let f = 0; f < spec.frameCount; f++) {
    texture.add(f, 0, (f % spec.columns) * spec.frameWidth, Math.floor(f / spec.columns) * spec.frameHeight, spec.frameWidth, spec.frameHeight);
  }
}

/** Generate all temporary placeholder textures. Skips any key that real art already provided. */
export function registerPlaceholderTextures(scene: Phaser.Scene): void {
  const t = scene.textures;
  const add = (key: string, make: () => HTMLCanvasElement) => {
    if (!t.exists(key)) t.addCanvas(key, make());
  };
  if (!t.exists(TEX.player)) addSheet(t, PLAYER_SHEET, buildPlayerSheet());
  if (!t.exists(TEX.sentinel)) addSheet(t, SENTINEL_SHEET, buildSentinelSheet());
  add(TEX.tiles, () => buildTileset(DISPLAY.tileSize));
  add(TEX.sky, () => buildSky(256, 360));
  add(TEX.moon, buildMoon);
  add(TEX.far, () => buildFarLayer(512, 220));
  add(TEX.mid, () => buildMidLayer(512, 170));
  add(TEX.fog, () => buildFog(512, 96));
  add(TEX.glow, () => buildRadialGlow(64));
  add(TEX.spark, () => buildPixel(2, '#ffffff'));
  add(TEX.mote, () => buildPixel(1, '#ffffff'));
  add(TEX.dust, () => buildPixel(2, '#8d86a8'));
  add(TEX.ember, () => buildPixel(1, '#ffc070'));
  add(TEX.shrine, buildShrine);
  add(TEX.brazier, buildBrazier);
  add(TEX.lore, buildLoreStone);
}

function addAnims(scene: Phaser.Scene, sheet: string, anims: readonly AnimSpec[]): void {
  for (const a of anims) {
    if (scene.anims.exists(a.key)) continue;
    scene.anims.create({
      key: a.key,
      frames: a.frames.map((frame) => ({ key: sheet, frame })),
      frameRate: a.fps,
      repeat: a.loop ? -1 : 0,
    });
  }
}

export function registerAnimations(scene: Phaser.Scene): void {
  addAnims(scene, PLAYER_SHEET.key, PLAYER_ANIMS);
  addAnims(scene, SENTINEL_SHEET.key, SENTINEL_ANIMS);
}
