import type Phaser from 'phaser';
import type { Player } from '../entities/player/Player';
import type { SafeArea } from '../game/Viewport';

const HEALTH_WIDTH = 100;
const STAMINA_WIDTH = 80;
const BAR_HEIGHT = 4;

/**
 * Health and stamina bars, Souls-style with a trailing "recent loss"
 * segment. Drawn in screen space and offset by the device safe area.
 */
export class Hud {
  private readonly g: Phaser.GameObjects.Graphics;
  private shownHealth = 1;
  private shownStamina = 1;
  private safe: SafeArea = { left: 0, right: 0, top: 0, bottom: 0 };

  constructor(
    scene: Phaser.Scene,
    private player: Player,
  ) {
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(100);
  }

  /** A new region was loaded: follow its player (the bars snap to the new values). */
  setPlayer(player: Player): void {
    this.player = player;
    this.shownHealth = player.health.ratio;
    this.shownStamina = player.stamina.ratio;
  }

  setSafeArea(safe: SafeArea): void {
    this.safe = safe;
  }

  update(dt: number): void {
    const p = this.player;
    const health = p.health.ratio;
    const stamina = p.stamina.ratio;
    this.shownHealth = health > this.shownHealth ? health : Math.max(health, this.shownHealth - dt * 0.5);
    this.shownStamina = stamina > this.shownStamina ? stamina : Math.max(stamina, this.shownStamina - dt * 1.2);

    const x = Math.round(8 + this.safe.left);
    const y = Math.round(8 + this.safe.top);
    const g = this.g;
    g.clear();
    this.bar(x, y, HEALTH_WIDTH, health, this.shownHealth, 0xa3263a, 0xe6d3a8);
    this.bar(x, y + BAR_HEIGHT + 4, STAMINA_WIDTH, stamina, this.shownStamina, stamina <= 0 ? 0x4e6b45 : 0x6fa35a, 0xd8e8b0);
  }

  private bar(x: number, y: number, w: number, value: number, trailing: number, color: number, trailColor: number): void {
    const g = this.g;
    g.fillStyle(0x000000, 0.6).fillRect(x - 2, y - 2, w + 4, BAR_HEIGHT + 4);
    g.fillStyle(0x3a3550, 1).fillRect(x - 1, y - 1, w + 2, BAR_HEIGHT + 2);
    g.fillStyle(0x0c0a14, 1).fillRect(x, y, w, BAR_HEIGHT);
    g.fillStyle(trailColor, 1).fillRect(x, y, Math.round(w * trailing), BAR_HEIGHT);
    g.fillStyle(color, 1).fillRect(x, y, Math.round(w * value), BAR_HEIGHT);
    g.fillStyle(0xffffff, 0.18).fillRect(x, y, Math.round(w * value), 1);
  }
}
