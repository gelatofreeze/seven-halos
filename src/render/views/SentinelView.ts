import Phaser from 'phaser';
import { lerp } from '../../core/math';
import type { Sentinel } from '../../entities/enemy/Sentinel';
import { frameAt, SENTINEL_FRAMES, SENTINEL_SHEET } from '../animation/specs';
import { TEX } from '../textures/registerTextures';

/** Renders a Hollow Sentinel, including its attack telegraph and health bar. */
export class SentinelView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly eyeGlow: Phaser.GameObjects.Image;
  private readonly glint: Phaser.GameObjects.Image;
  private readonly bar: Phaser.GameObjects.Graphics;
  /** Pulsing marker over the head while a riposte opening exists. */
  private readonly opening: Phaser.GameObjects.Graphics;
  private shownHealth = 1;
  private time = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly enemy: Sentinel,
  ) {
    this.sprite = scene.add.sprite(0, 0, TEX.sentinel, 0).setOrigin(0.5, SENTINEL_SHEET.footY / SENTINEL_SHEET.frameHeight).setDepth(8);
    this.eyeGlow = scene.add.image(0, 0, TEX.glow).setBlendMode(Phaser.BlendModes.ADD).setTint(0x7ff0ff).setScale(0.35).setDepth(8.5);
    this.glint = scene.add.image(0, 0, TEX.glow).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffffff).setVisible(false).setDepth(11);
    this.bar = scene.add.graphics().setDepth(12);
    this.opening = scene.add.graphics().setDepth(12);
  }

  /** `playerInRange`: whether the player could riposte right now (brightens the marker). */
  update(alpha: number, dt: number, playerInRange = false): void {
    this.time += dt;
    const e = this.enemy;
    const b = e.body;
    const x = lerp(b.prevX, b.x, alpha) + b.w / 2;
    const y = lerp(b.prevY, b.y, alpha) + b.h;
    const s = this.sprite;
    s.setPosition(x, y).setFlipX(e.facing < 0);

    let eyeIntensity = 0.5;
    this.glint.setVisible(false);
    switch (e.fsm.current) {
      case 'idle':
        s.anims.play('sentinel.idle', true);
        break;
      case 'approach':
        s.anims.play(Math.abs(b.vx) > 4 ? 'sentinel.walk' : 'sentinel.idle', true);
        break;
      case 'attack': {
        const r = e.attack;
        s.anims.stop();
        if (r.phase === 'startup') {
          s.setFrame(frameAt(SENTINEL_FRAMES.windup, r.phaseProgress));
          eyeIntensity = 0.6 + r.phaseProgress * 1.4;
          // Glint: a bright star flash in the last third of the windup.
          if (r.phaseProgress > 0.62 && r.phaseProgress < 0.9) {
            const t = (r.phaseProgress - 0.62) / 0.28;
            this.glint
              .setVisible(true)
              .setPosition(x - e.facing * 28, y - 62)
              .setScale(0.3 + Math.sin(t * Math.PI) * 0.9)
              .setAlpha(Math.sin(t * Math.PI));
          }
        } else if (r.phase === 'active') {
          s.setFrame(frameAt(SENTINEL_FRAMES.strike, r.phaseProgress));
          eyeIntensity = 2;
        } else {
          s.setFrame(frameAt(SENTINEL_FRAMES.recover, r.phaseProgress));
          eyeIntensity = 0.3;
        }
        break;
      }
      case 'stagger':
        s.anims.play('sentinel.stagger', true);
        eyeIntensity = 0.2;
        break;
      case 'parried':
        s.anims.play(e.fsm.ticks < 10 ? 'sentinel.parried' : 'sentinel.broken', true);
        eyeIntensity = 0.15;
        break;
      case 'postureBroken':
        s.anims.play('sentinel.broken', true);
        eyeIntensity = 0.1;
        break;
      case 'riposted':
        s.anims.play('sentinel.riposted', true);
        eyeIntensity = 0;
        break;
      case 'dead':
        s.anims.play('sentinel.dead', true);
        eyeIntensity = 0;
        break;
    }

    if (e.hitFlash > 0) s.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else if (e.fsm.is('postureBroken') && e.fsm.ticks < 8) s.setTint(0xffd27a).setTintMode(Phaser.TintModes.FILL);
    else s.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    s.setAlpha(e.isDead ? Math.max(0, 1 - e.fsm.time / 2.5) : 1);

    this.eyeGlow.setPosition(x + e.facing * 3, y - 34).setAlpha(Math.min(1, eyeIntensity * 0.6)).setScale(0.25 + eyeIntensity * 0.2);

    // Health bar with a trailing "recent damage" segment.
    const ratio = e.health.ratio;
    this.shownHealth = ratio > this.shownHealth ? ratio : Math.max(ratio, this.shownHealth - dt * 0.6);
    this.bar.clear();
    if (!e.isDead && (ratio < 1 || e.fsm.current !== 'idle')) {
      const w = 30;
      const bx = Math.round(x - w / 2);
      const by = Math.round(y - 46);
      this.bar.fillStyle(0x07060d, 0.85).fillRect(bx - 1, by - 1, w + 2, 4);
      this.bar.fillStyle(0xd9c7a0, 1).fillRect(bx, by, Math.round(w * this.shownHealth), 2);
      this.bar.fillStyle(0xa3263a, 1).fillRect(bx, by, Math.round(w * ratio), 2);
      // Posture: fills from the centre outward; only shown when under pressure.
      const posture = e.posture.ratio;
      if (posture > 0.01) {
        const pw = Math.max(1, Math.round(w * posture));
        this.bar.fillStyle(0x07060d, 0.85).fillRect(bx - 1, by + 3, w + 2, 3);
        this.bar.fillStyle(posture > 0.75 ? 0xffe08a : 0xc9a45c, 1).fillRect(Math.round(x - pw / 2), by + 4, pw, 1);
      }
    }

    // Riposte opening: a pulsing diamond above the head, brighter when the player is close enough.
    this.opening.clear();
    if (e.canBeRiposted()) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 12);
      const ox = Math.round(x);
      const oy = Math.round(y - 52 - pulse * 2);
      const size = playerInRange ? 4 : 3;
      this.opening.fillStyle(playerInRange ? 0xfff3c4 : 0xc9a45c, playerInRange ? 0.95 : 0.6 + pulse * 0.3);
      this.opening.fillTriangle(ox, oy - size, ox + size, oy, ox, oy + size);
      this.opening.fillTriangle(ox, oy - size, ox - size, oy, ox, oy + size);
    }
  }
}
