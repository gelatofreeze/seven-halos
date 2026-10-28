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
  private shownHealth = 1;

  constructor(
    scene: Phaser.Scene,
    private readonly enemy: Sentinel,
  ) {
    this.sprite = scene.add.sprite(0, 0, TEX.sentinel, 0).setOrigin(0.5, SENTINEL_SHEET.footY / SENTINEL_SHEET.frameHeight).setDepth(8);
    this.eyeGlow = scene.add.image(0, 0, TEX.glow).setBlendMode(Phaser.BlendModes.ADD).setTint(0x7ff0ff).setScale(0.35).setDepth(8.5);
    this.glint = scene.add.image(0, 0, TEX.glow).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffffff).setVisible(false).setDepth(11);
    this.bar = scene.add.graphics().setDepth(12);
  }

  update(alpha: number, dt: number): void {
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
      case 'dead':
        s.anims.play('sentinel.dead', true);
        eyeIntensity = 0;
        break;
    }

    if (e.hitFlash > 0) s.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
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
    }
  }
}
