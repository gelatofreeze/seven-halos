import Phaser from 'phaser';
import { getItem } from '../../data/items';
import type { Pickup } from '../../world/Pickups';
import { TEX } from '../textures/registerTextures';

const RARITY_TINT: Record<string, number> = { common: 0xc9c1ae, uncommon: 0x9fe8ff, rare: 0xffd27a, legendary: 0xff9ff0 };

/**
 * Draws world pickups: a bobbing icon with a rarity-coloured glow and a light
 * beam for rare items, so a rare drop is impossible to miss.
 */
export class PickupViews {
  private readonly views = new Map<number, { icon: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; beam: Phaser.GameObjects.Rectangle | null }>();
  private time = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  update(pickups: readonly Pickup[], dt: number): void {
    this.time += dt;
    const live = new Set<number>();
    for (const p of pickups) {
      live.add(p.id);
      let v = this.views.get(p.id);
      if (!v) {
        const def = getItem(p.itemId);
        const tint = RARITY_TINT[p.rarity] ?? 0xffffff;
        const rare = p.rarity === 'rare' || p.rarity === 'legendary';
        v = {
          glow: this.scene.add.image(0, 0, TEX.glow).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(rare ? 0.9 : 0.45).setDepth(7),
          icon: this.scene.add.image(0, 0, def.kind === 'weapon' ? TEX.iconWeapon : TEX.iconMaterial).setDepth(7.5),
          beam: rare ? this.scene.add.rectangle(0, 0, 2, 60, tint, 0.35).setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(6.5) : null,
        };
        this.views.set(p.id, v);
      }
      const b = p.body;
      const bob = b.grounded ? Math.round(Math.sin(this.time * 3 + p.id) * 1.5) : 0;
      const x = Math.round(b.footX);
      const y = Math.round(b.footY - 6 + bob);
      v.icon.setPosition(x, y);
      v.glow.setPosition(x, y).setAlpha(0.5 + 0.25 * Math.sin(this.time * 5 + p.id));
      v.beam?.setPosition(x, Math.round(b.footY)).setAlpha(0.2 + 0.15 * Math.sin(this.time * 4));
    }
    for (const [id, v] of this.views) {
      if (live.has(id)) continue;
      v.icon.destroy();
      v.glow.destroy();
      v.beam?.destroy();
      this.views.delete(id);
    }
  }
}
