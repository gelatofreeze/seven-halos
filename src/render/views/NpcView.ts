import type Phaser from 'phaser';
import type { NpcObject } from '../../world/Level';
import type { LightRig } from '../environment/lighting';
import { TEX } from '../textures/registerTextures';

/** NPC visual keys → texture and an optional carried light (offset from the feet, facing right). */
export const NPC_VISUALS: Record<string, { texture: string; light?: { dx: number; dy: number } }> = {
  oracle: { texture: TEX.npcOracle, light: { dx: 13, dy: -37 } },
};

/**
 * Draws the NPCs standing in a region. Purely cosmetic: a slow breath (a
 * one-pixel rise every few seconds) so they read as alive, and their light.
 */
export class NpcViews {
  private readonly sprites: { image: Phaser.GameObjects.Image; y: number; phase: number }[] = [];
  private time = 0;

  constructor(scene: Phaser.Scene, npcs: readonly NpcObject[], rig: LightRig) {
    for (const n of npcs) {
      const v = NPC_VISUALS[n.visual];
      if (!v) continue;
      const image = scene.add.image(n.x, n.y, v.texture).setOrigin(0.5, 1).setDepth(7).setFlipX(n.facing < 0);
      this.sprites.push({ image, y: n.y, phase: n.x * 0.01 });
      if (v.light) rig.add('lantern', n.x + v.light.dx * n.facing, n.y + v.light.dy);
    }
  }

  update(dt: number): void {
    this.time += dt;
    for (const s of this.sprites) s.image.y = s.y - (Math.sin(this.time * 1.6 + s.phase) > 0.6 ? 1 : 0);
  }
}
