import type { DecorLayer, PropKind } from '../../world/Level';
import { HALL, LINTEL, SCONCE } from '../textures/architectureArt';
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
  /** Drawn size, px (bottom-centre anchored), used by the support checks. */
  footprint: { w: number; h: number };
  /**
   * What holds it up, checked by tests/prop-support.test.ts against the tiles:
   * - floor: its whole base rests on ground (solid or platform tops);
   * - embedded: it lies entirely inside solid masonry (a lintel in a wall);
   * - mounted: its fixing point is on masonry, a solid tile or another prop's `mounts`;
   * - none: sky, light, distant or overlay art with nothing to stand on.
   */
  support: 'floor' | 'embedded' | 'mounted' | 'none';
  /** For `mounted`: the fixing point relative to the bottom centre (e.g. a sconce's plate). */
  mountPoint?: { dx: number; dy: number };
  /** Surfaces other props may be mounted on, relative to the bottom centre (e.g. columns). */
  mounts?: readonly { x: number; y: number; w: number; h: number }[];
}

/** Depth of each decoration layer. Tiles are at 0, enemies 8, the player 10. */
export const LAYER_DEPTH: Record<DecorLayer, number> = { far: -40, back: -20, mid: -6, front: 14 };
/** Distant layers are dimmed toward the sky so the playfield reads first. */
export const LAYER_TINT: Record<DecorLayer, number> = { far: 0x8c88aa, back: 0xffffff, mid: 0xffffff, front: 0xffffff };

const windowLights = HALL.windows.flatMap((w) => {
  const dy = -(HALL.h - (w.top + HALL.sill) / 2);
  return w.dx === 0 ? [{ name: 'window' as const, dx: 0, dy }] : [{ name: 'window' as const, dx: -w.dx, dy }, { name: 'window' as const, dx: w.dx, dy }];
});

/** The hall arcade's columns, as mount surfaces (relative to the hall's bottom centre). */
const columnMounts = HALL.columns.flatMap((dx) => [-dx, dx].map((x) => ({ x: x - 6, y: -(HALL.h - 12), w: 12, h: HALL.h - 20 })));

export const PROP_VISUALS: Record<PropKind, PropVisual> = {
  shrine: { texture: TEX.shrine, depth: -5, lights: [{ name: 'shrine', dx: 0, dy: -40 }], footprint: { w: 32, h: 48 }, support: 'floor' },
  brazier: { texture: TEX.brazierBase, depth: -4, lights: [{ name: 'brazier', dx: 0, dy: -20, flameDy: -16 }], footprint: { w: 16, h: 24 }, support: 'floor' },
  torch: { texture: TEX.torch, depth: 2, lights: [{ name: 'torch', dx: 0, dy: -24, flameDy: -19 }], footprint: { w: SCONCE.w, h: SCONCE.h }, support: 'mounted', mountPoint: { dx: 0, dy: -8 } },
  lore: { texture: TEX.lore, depth: -4, lights: [{ name: 'divine', dx: 0, dy: -8 }], footprint: { w: 12, h: 16 }, support: 'floor' },
  altar: { texture: TEX.altar, depth: -4, lights: [{ name: 'divine', dx: 0, dy: -12 }], footprint: { w: 24, h: 16 }, support: 'floor' },
  torchPost: { texture: TEX.torchPost, depth: -4, lights: [{ name: 'torch', dx: 0, dy: -46, flameDy: -41 }], footprint: { w: 10, h: 44 }, support: 'floor' },
  tree: { texture: TEX.tree, footprint: { w: 18, h: 112 }, support: 'floor' },
  ancientTree: { texture: TEX.ancientTree, footprint: { w: 80, h: 236 }, support: 'floor' },
  bush: { texture: TEX.bush, depth: 4, footprint: { w: 24, h: 12 }, support: 'floor' },
  flowers: { texture: TEX.flowers, depth: 4, footprint: { w: 16, h: 8 }, support: 'floor' },
  ruin: { texture: TEX.ruin, footprint: { w: 16, h: 44 }, support: 'floor' },
  fallenColumn: { texture: TEX.fallenColumn, depth: 3, footprint: { w: 48, h: 14 }, support: 'floor' },
  colonnade: { texture: TEX.colonnade, footprint: { w: 256, h: 104 }, support: 'none' },
  plinth: { texture: TEX.plinth, depth: -4, footprint: { w: 16, h: 12 }, support: 'floor' },
  sanctuaryWall: { texture: TEX.sanctuaryWall, depth: -24, lights: windowLights, footprint: { w: HALL.w, h: HALL.h }, support: 'floor' },
  sanctuaryFrame: { texture: TEX.sanctuaryFrame, depth: -23, footprint: { w: HALL.w, h: HALL.h }, support: 'floor', mounts: columnMounts },
  sanctuaryIvy: { texture: TEX.sanctuaryIvy, depth: -22, footprint: { w: HALL.w, h: HALL.h }, support: 'none' },
  gable: { texture: TEX.gable, depth: -1, footprint: { w: 560, h: 44 }, support: 'floor' },
  halo: { texture: TEX.halo, depth: -0.5, lights: [{ name: 'divine', dx: 0, dy: -14 }], footprint: { w: 28, h: 28 }, support: 'none' },
  doorArch: { texture: TEX.doorArch, depth: 2, footprint: { w: LINTEL.w, h: LINTEL.h }, support: 'embedded' },
  lightShaft: { texture: TEX.lightShaft, depth: 7, shaft: true, additive: true, footprint: { w: 104, h: 112 }, support: 'none' },
  waymarker: { texture: TEX.waymarker, depth: -4, lights: [{ name: 'lantern', dx: 6, dy: -16 }], footprint: { w: 16, h: 38 }, support: 'floor' },
  bridgeRuin: { texture: TEX.bridgeRuin, depth: -8, footprint: { w: 224, h: 84 }, support: 'none' },
  stream: { texture: TEX.stream, depth: 1, lights: [{ name: 'moon', dx: 0, dy: -4 }], footprint: { w: 192, h: 8 }, support: 'floor' },
  shrineArch: { texture: TEX.shrineArch, depth: -7, footprint: { w: 96, h: 84 }, support: 'floor' },
  gate: { texture: TEX.gate, depth: -4, lights: [{ name: 'seal', dx: 0, dy: -34 }], footprint: { w: 40, h: 72 }, support: 'floor' },
};
