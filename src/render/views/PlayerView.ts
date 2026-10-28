import Phaser from 'phaser';
import { PLAYER_MOVEMENT } from '../../config/movement';
import { lerp } from '../../core/math';
import type { Player } from '../../entities/player/Player';
import { frameAt, PLAYER_FRAMES, PLAYER_SHEET } from '../animation/specs';
import { TEX } from '../textures/registerTextures';

const AFTERIMAGES = 4;

/**
 * Renders the player from simulation state. Locomotion uses timed loops;
 * dodge and attack frames are chosen from the action's frame counter so the
 * picture can never drift from the real hit/i-frame timing.
 */
export class PlayerView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly light: Phaser.GameObjects.Image;
  private readonly ghosts: Phaser.GameObjects.Sprite[] = [];
  private ghostIndex = 0;
  private lastGhostFrame = -1;
  private time = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly player: Player,
  ) {
    for (let i = 0; i < AFTERIMAGES; i++) {
      const g = scene.add.sprite(0, 0, TEX.player, 0).setOrigin(0.5, PLAYER_SHEET.footY / PLAYER_SHEET.frameHeight);
      g.setVisible(false).setTint(0x7fd8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(9);
      this.ghosts.push(g);
    }
    this.light = scene.add.image(0, 0, TEX.glow).setBlendMode(Phaser.BlendModes.ADD).setTint(0x8fa8ff).setAlpha(0.18).setScale(2.2).setDepth(9);
    this.sprite = scene.add.sprite(0, 0, TEX.player, 0).setOrigin(0.5, PLAYER_SHEET.footY / PLAYER_SHEET.frameHeight).setDepth(10);
  }

  /** Interpolated feet position. */
  footX(alpha: number): number {
    const b = this.player.body;
    return lerp(b.prevX, b.x, alpha) + b.w / 2;
  }

  footY(alpha: number): number {
    const b = this.player.body;
    return lerp(b.prevY, b.y, alpha) + b.h;
  }

  update(alpha: number, dt: number): void {
    this.time += dt;
    const p = this.player;
    const x = this.footX(alpha);
    const y = this.footY(alpha);
    const s = this.sprite;
    s.setPosition(x, y);
    s.setFlipX(p.facing < 0);
    this.light.setPosition(x, y - 14);

    switch (p.state) {
      case 'idle':
      case 'run':
      case 'jump':
      case 'fall':
      case 'land':
      case 'hurt':
      case 'dead':
        s.anims.play(`player.${p.state}`, true);
        break;
      case 'dodge': {
        const d = PLAYER_MOVEMENT.dodge;
        const total = d.startupFrames + d.invulnerableFrames + d.recoveryFrames;
        s.anims.stop();
        s.setFrame(frameAt(PLAYER_FRAMES.dodge, Math.max(0, p.actionFrame) / total));
        if (p.actionFrame >= 0 && p.actionFrame % 3 === 0 && p.actionFrame !== this.lastGhostFrame && p.isDodgeInvulnerable()) {
          this.spawnGhost(x, y);
          this.lastGhostFrame = p.actionFrame;
        }
        break;
      }
      case 'attack': {
        const runner = p.attack;
        const set = runner.attack?.id === 'sword.light.2' ? PLAYER_FRAMES.attack2 : PLAYER_FRAMES.attack1;
        const phase = runner.phase === 'done' ? 'recovery' : runner.phase;
        s.anims.stop();
        s.setFrame(frameAt(set[phase], runner.phaseProgress));
        break;
      }
    }
    if (p.state !== 'dodge') this.lastGhostFrame = -1;

    // Post-hit grace flicker
    s.setAlpha(p.postHitInvulnerability > 0 && !p.isDead ? (Math.floor(this.time * 30) % 2 === 0 ? 0.35 : 1) : 1);

    for (const g of this.ghosts) {
      if (!g.visible) continue;
      g.alpha -= dt * 3;
      if (g.alpha <= 0) g.setVisible(false);
    }
  }

  private spawnGhost(x: number, y: number): void {
    const g = this.ghosts[this.ghostIndex++ % AFTERIMAGES]!;
    g.setPosition(x, y).setFrame(this.sprite.frame.name).setFlipX(this.sprite.flipX).setAlpha(0.45).setVisible(true);
  }
}
