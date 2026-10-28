import type { DecorLayer, PropKind } from '../../world/Level';
import { HALL } from '../textures/architectureArt';
import { TEX } from '../textures/registerTextures';
import type { LightName } from './lighting';

/**
 * How each prop kind is drawn: texture, depth band, and the lights that come
 * with it (offsets from the prop's bottom centre, px; mirrored props mirror
 * them). Adding a prop kind = a texture plus one entry here.
 */
export interface PropVisual {
  texture: string;
  /** Overrides the placement's layer depth (e.g. a door frame drawn over wall tiles). */
  depth?: number;
  lights?: readonly { name: LightName; dx: number; dy: number; flameDy?: number }[];
  /** A dust-filled shaft of light (additive). */
  shaft?: boolean;
  alpha?: number;
  /** Draw scale (distant landmarks are drawn smaller). */
  scale?: number;
  /** Additive blend (light-like props). */
  additive?: boolean;
}

/** Depth of each decoration layer. Tiles are at 0, enemies 8, the player 10. */
export const LAYER_DEPTH: Record<DecorLayer, number> = { far: -40, back: -20, mid: -6, front: 14 };
/** Distant layers are dimmed toward the sky so the playfield reads first. */
export const LAYER_TINT: Record<DecorLayer, number> = { far: 0x8c88aa, back: 0xffffff, mid: 0xffffff, front: 0xffffff };

const windowLights = HALL.windows.flatMap((w) => {
  const dy = -(HALL.h - (w.top + HALL.sill) / 2);
  return w.dx === 0 ? [{ name: 'window' as const, dx: 0, dy }] : [{ name: 'window' as const, dx: -w.dx, dy }, { name: 'window' as const, dx: w.dx, dy }];
});

export const PROP_VISUALS: Record<PropKind, PropVisual> = {
  shrine: { texture: TEX.shrine, depth: -5, lights: [{ name: 'shrine', dx: 0, dy: -40 }] },
  brazier: { texture: TEX.brazierBase, depth: -4, lights: [{ name: 'brazier', dx: 0, dy: -20, flameDy: -16 }] },
  torch: { texture: TEX.torch, depth: 2, lights: [{ name: 'torch', dx: 0, dy: -22, flameDy: -15 }] },
  lore: { texture: TEX.lore, depth: -4, lights: [{ name: 'divine', dx: 0, dy: -8 }] },
  altar: { texture: TEX.altar, depth: -4, lights: [{ name: 'divine', dx: 0, dy: -12 }] },
  tree: { texture: TEX.tree },
  ancientTree: { texture: TEX.ancientTree },
  bush: { texture: TEX.bush, depth: 4 },
  flowers: { texture: TEX.flowers, depth: 4 },
  ruin: { texture: TEX.ruin },
  fallenColumn: { texture: TEX.fallenColumn, depth: 3 },
  colonnade: { texture: TEX.colonnade },
  plinth: { texture: TEX.plinth, depth: -4 },
  sanctuaryWall: { texture: TEX.sanctuaryWall, depth: -24, lights: windowLights },
  sanctuaryFrame: { texture: TEX.sanctuaryFrame, depth: -23 },
  sanctuaryIvy: { texture: TEX.sanctuaryIvy, depth: -22 },
  gable: { texture: TEX.gable, depth: -1 },
  halo: { texture: TEX.halo, depth: -0.5, lights: [{ name: 'divine', dx: 0, dy: -14 }] },
  doorArch: { texture: TEX.doorArch, depth: 2 },
  lightShaft: { texture: TEX.lightShaft, depth: 7, shaft: true, additive: true },
  waymarker: { texture: TEX.waymarker, depth: -4, lights: [{ name: 'lantern', dx: 6, dy: -16 }] },
  bridgeRuin: { texture: TEX.bridgeRuin, depth: -8 },
  stream: { texture: TEX.stream, depth: 1, lights: [{ name: 'moon', dx: 0, dy: -4 }] },
  shrineArch: { texture: TEX.shrineArch, depth: -7 },
  gate: { texture: TEX.gate, depth: -4, lights: [{ name: 'seal', dx: 0, dy: -34 }] },
};
