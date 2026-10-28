import Phaser from 'phaser';
import { PARRY } from '../../config/combat';
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
  /** Charge glow gathering around the raised blade. */
  private readonly chargeGlow: Phaser.GameObjects.Image;
  /** Thin arc in front of the player while the guard is raised. */
  private readonly guardArc: Phaser.GameObjects.Graphics;
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
    this.chargeGlow = scene.add.image(0, 0, TEX.glow).setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(11);
    this.guardArc = scene.add.graphics().setDepth(11);
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
        const phase = runner.phase === 'done' ? 'recovery' : runner.phase;
        s.anims.stop();
        if (runner.attack?.kind === 'heavy') {
          const H = PLAYER_FRAMES.heavy;
          if (runner.charging) s.setFrame(H.charge[Math.floor(this.time * 10) % 2]!);
          else s.setFrame(frameAt(H[phase], runner.phaseProgress));
        } else {
          const set = runner.attack?.id === 'sword.light.2' ? PLAYER_FRAMES.attack2 : PLAYER_FRAMES.attack1;
          s.setFrame(frameAt(set[phase], runner.phaseProgress));
        }
        break;
      }
      case 'riposte': {
        const runner = p.attack;
        const phase = runner.phase === 'done' ? 'recovery' : runner.phase;
        s.anims.stop();
        s.setFrame(frameAt(PLAYER_FRAMES.riposte[phase], runner.phaseProgress));
        break;
      }
      case 'guard':
        s.anims.stop();
        s.setFrame(p.blockStunFrames > 0 ? PLAYER_FRAMES.guardImpact[0] : PLAYER_FRAMES.guard[0]);
        break;
      case 'parry': {
        const f = p.actionFrame;
        const P = PLAYER_FRAMES.parry;
        s.anims.stop();
        s.setFrame(f < PARRY.startupFrames ? P.startup[0] : f < PARRY.startupFrames + PARRY.windowFrames ? P.window[0] : P.recovery[0]);
        break;
      }
      case 'guardBroken':
        s.anims.play('player.guardBroken', true);
        break;
    }
    this.updateChargeGlow(x, y);
    this.updateGuardArc(x, y);
    if (p.state !== 'dodge') this.lastGhostFrame = -1;

    // Post-hit grace flicker
    s.setAlpha(p.postHitInvulnerability > 0 && !p.isDead ? (Math.floor(this.time * 30) % 2 === 0 ? 0.35 : 1) : 1);

    for (const g of this.ghosts) {
      if (!g.visible) continue;
      g.alpha -= dt * 3;
      if (g.alpha <= 0) g.setVisible(false);
    }
  }

  private updateChargeGlow(x: number, y: number): void {
    const p = this.player;
    const r = p.attack;
    if (!p.fsm.is('attack') || !r.charging) {
      this.chargeGlow.setVisible(false);
      return;
    }
    const level = r.chargeLevel;
    const full = level >= 1;
    const pulse = full ? 0.15 * Math.sin(this.time * 40) : 0;
    this.chargeGlow
      .setVisible(true)
      .setPosition(x - p.facing * 9, y - 36)
      .setTint(full ? 0xffffff : 0xffc46b)
      .setScale(0.25 + level * 0.75 + pulse)
      .setAlpha(0.35 + level * 0.55);
  }

  private updateGuardArc(x: number, y: number): void {
    const p = this.player;
    const g = this.guardArc;
    g.clear();
    if (!p.isGuardRaised()) return;
    const impact = p.blockStunFrames > 0;
    const cx = x + p.facing * 2;
    const cy = y - 14;
    const a = p.facing > 0 ? 0 : Math.PI;
    g.lineStyle(1, impact ? 0xfff3c4 : 0x9fc8ff, impact ? 0.95 : 0.55);
    g.beginPath();
    g.arc(cx, cy, 15, a - 1.0, a + 1.0, false);
    g.strokePath();
  }

  private spawnGhost(x: number, y: number): void {
    const g = this.ghosts[this.ghostIndex++ % AFTERIMAGES]!;
    g.setPosition(x, y).setFrame(this.sprite.frame.name).setFlipX(this.sprite.flipX).setAlpha(0.45).setVisible(true);
  }
}
