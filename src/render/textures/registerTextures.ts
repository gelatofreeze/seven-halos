import type Phaser from 'phaser';
import { DISPLAY } from '../../config/display';
import { PLAYER_SCYTHE_SHEET, PLAYER_SHEET, REAPER_SHEET, SENTINEL_SHEET, type SheetSpec } from '../animation/specs';
import { buildPlayerScytheSheet, buildPlayerSheet, buildReaperSheet, buildSentinelSheet } from './characterArt';
import {
  buildAltar,
  buildBrazier,
  buildMaterialIcon,
  buildWeaponIcon,
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
  buildTreeLine,
} from './environmentArt';
import {
  buildAncientTree,
  buildBrazierBase,
  buildBridgeRuin,
  buildCastle,
  buildColonnade,
  buildDoorArch,
  buildFallenColumn,
  buildFlameSheet,
  buildFlowers,
  buildGable,
  buildHalo,
  buildLightShaft,
  buildSanctuaryFrame,
  buildSanctuaryIvy,
  buildSanctuaryWall,
  buildShrineArch,
  buildStream,
  buildTorch,
  buildWaymarker,
} from './architectureArt';
import { buildBush, buildCache, buildGate, buildPlinth, buildRuin, buildTree } from './worldArt';

/** Texture keys used by the presentation layer. Final art loaded via the Loader must use the same keys. */
export const TEX = {
  player: PLAYER_SHEET.key,
  playerScythe: PLAYER_SCYTHE_SHEET.key,
  sentinel: SENTINEL_SHEET.key,
  reaper: REAPER_SHEET.key,
  tiles: 'tiles',
  sky: 'bg.sky',
  moon: 'bg.moon',
  far: 'bg.far',
  mid: 'bg.mid',
  fog: 'bg.fog',
  forestFar: 'bg.forest.far',
  forestMid: 'bg.forest.mid',
  glow: 'fx.glow',
  spark: 'fx.spark',
  mote: 'fx.mote',
  dust: 'fx.dust',
  ember: 'fx.ember',
  shrine: 'prop.shrine',
  brazier: 'prop.brazier',
  lore: 'prop.lore',
  altar: 'prop.altar',
  tree: 'prop.tree',
  bush: 'prop.bush',
  ruin: 'prop.ruin',
  plinth: 'prop.plinth',
  brazierBase: 'prop.brazier.base',
  torch: 'prop.torch',
  flame: 'fx.flame',
  sanctuaryWall: 'prop.sanctuary.wall',
  sanctuaryFrame: 'prop.sanctuary.frame',
  sanctuaryIvy: 'prop.sanctuary.ivy',
  gable: 'prop.gable',
  halo: 'prop.halo',
  doorArch: 'prop.door-arch',
  lightShaft: 'fx.light-shaft',
  waymarker: 'prop.waymarker',
  ancientTree: 'prop.ancient-tree',
  colonnade: 'prop.colonnade',
  fallenColumn: 'prop.fallen-column',
  flowers: 'prop.flowers',
  bridgeRuin: 'prop.bridge-ruin',
  stream: 'prop.stream',
  shrineArch: 'prop.shrine-arch',
  castle: 'prop.castle',
  gate: 'prop.gate',
  cacheClosed: 'prop.cache.closed',
  cacheOpen: 'prop.cache.open',
  iconWeapon: 'icon.weapon',
  iconMaterial: 'icon.material',
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
  if (!t.exists(TEX.playerScythe)) addSheet(t, PLAYER_SCYTHE_SHEET, buildPlayerScytheSheet());
  if (!t.exists(TEX.sentinel)) addSheet(t, SENTINEL_SHEET, buildSentinelSheet());
  if (!t.exists(TEX.reaper)) addSheet(t, REAPER_SHEET, buildReaperSheet());
  add(TEX.tiles, () => buildTileset(DISPLAY.tileSize));
  add(TEX.sky, () => buildSky(256, 360));
  add(TEX.moon, buildMoon);
  add(TEX.far, () => buildFarLayer(512, 220));
  add(TEX.mid, () => buildMidLayer(512, 170));
  add(TEX.fog, () => buildFog(512, 96));
  add(TEX.forestFar, () => buildTreeLine(512, 200, 'far'));
  add(TEX.forestMid, () => buildTreeLine(512, 160, 'near'));
  add(TEX.glow, () => buildRadialGlow(64));
  add(TEX.spark, () => buildPixel(2, '#ffffff'));
  add(TEX.mote, () => buildPixel(1, '#ffffff'));
  add(TEX.dust, () => buildPixel(2, '#8d86a8'));
  add(TEX.ember, () => buildPixel(1, '#ffc070'));
  add(TEX.shrine, buildShrine);
  add(TEX.brazier, buildBrazier);
  add(TEX.lore, buildLoreStone);
  add(TEX.altar, buildAltar);
  add(TEX.tree, buildTree);
  add(TEX.bush, buildBush);
  add(TEX.ruin, buildRuin);
  add(TEX.plinth, buildPlinth);
  add(TEX.brazierBase, buildBrazierBase);
  add(TEX.torch, buildTorch);
  if (!t.exists(TEX.flame)) {
    const flame = t.addCanvas(TEX.flame, buildFlameSheet(4));
    for (let f = 0; f < 4; f++) flame?.add(f, 0, f * 10, 0, 10, 14);
  }
  add(TEX.sanctuaryWall, buildSanctuaryWall);
  add(TEX.sanctuaryFrame, buildSanctuaryFrame);
  add(TEX.sanctuaryIvy, buildSanctuaryIvy);
  add(TEX.gable, buildGable);
  add(TEX.halo, buildHalo);
  add(TEX.doorArch, buildDoorArch);
  add(TEX.lightShaft, buildLightShaft);
  add(TEX.waymarker, buildWaymarker);
  add(TEX.ancientTree, buildAncientTree);
  add(TEX.colonnade, buildColonnade);
  add(TEX.fallenColumn, buildFallenColumn);
  add(TEX.flowers, buildFlowers);
  add(TEX.bridgeRuin, buildBridgeRuin);
  add(TEX.stream, buildStream);
  add(TEX.shrineArch, buildShrineArch);
  add(TEX.castle, buildCastle);
  add(TEX.gate, buildGate);
  add(TEX.cacheClosed, () => buildCache(false));
  add(TEX.cacheOpen, () => buildCache(true));
  add(TEX.iconWeapon, buildWeaponIcon);
  add(TEX.iconMaterial, buildMaterialIcon);
}
