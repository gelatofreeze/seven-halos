import Phaser from 'phaser';
import type { Player } from '../entities/player/Player';
import { getServices } from '../game/services';
import { Hud } from '../ui/Hud';

/** Screen-space HUD, in its own scene so world camera shake never moves it. */
export class UIScene extends Phaser.Scene {
  private hud!: Hud;

  constructor() {
    super('UI');
  }

  create(data: { player: Player }): void {
    this.hud = new Hud(this, data.player);
    const viewport = getServices(this).viewport;
    if (viewport) {
      this.hud.setSafeArea(viewport.safeArea);
      viewport.onChange((_layout, safe) => this.hud.setSafeArea(safe));
    }
    this.scale.on(Phaser.Scale.Events.RESIZE, (size: Phaser.Structs.Size) => this.cameras.main.setSize(size.width, size.height));
  }

  /** The gameplay scene loaded a new region (the UI scene itself keeps running). */
  setPlayer(player: Player): void {
    this.hud?.setPlayer(player);
  }

  override update(_time: number, deltaMs: number): void {
    this.hud.update(deltaMs / 1000);
  }
}
