import Phaser from 'phaser';
import { Viewport } from '../game/Viewport';
import { getServices } from '../game/services';
import { registerPlaceholderTextures } from '../render/textures/registerTextures';

/**
 * Boot: set up the viewport, then build textures. (Animations need no registration: views pick frames from simulation state time.) Final art
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
    this.scene.start('World');
  }
}
