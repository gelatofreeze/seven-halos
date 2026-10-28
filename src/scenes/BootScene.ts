import Phaser from 'phaser';
import { Viewport } from '../game/Viewport';
import { getServices } from '../game/services';
import { registerAnimations, registerPlaceholderTextures } from '../render/textures/registerTextures';

/**
 * Boot: set up the viewport, then build textures and animations. Final art
 * will be queued in `preload` with the same keys; placeholders only fill gaps.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    // Future: this.load.spritesheet(PLAYER_SHEET.key, 'assets/player.png', {...}) etc.
  }

  create(): void {
    const services = getServices(this);
    const container = this.game.canvas.parentElement ?? document.body;
    services.viewport = new Viewport(this.game, container);
    registerPlaceholderTextures(this);
    registerAnimations(this);
    this.scene.start('TestChamber');
  }
}
