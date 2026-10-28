import Phaser from 'phaser';
import { FEEDBACK } from '../config/feedback';
import type { SimEvent } from '../world/SimEvents';
import { TEX } from './textures/registerTextures';

const RINGS = 4;

/** Particle, flash and camera feedback for simulation events. Purely presentational. */
export class Effects {
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly goldSparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly blood: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly flash: Phaser.GameObjects.Rectangle;
  /** Expanding rings for parries, posture breaks and full charge. */
  private readonly rings: { g: Phaser.GameObjects.Graphics; t: number; dur: number; x: number; y: number; r: number; color: number }[] = [];
  private ringIndex = 0;
  private flashTime = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.sparks = scene.add
      .particles(0, 0, TEX.spark, {
        emitting: false,
        lifespan: { min: 160, max: 320 },
        speed: { min: 70, max: 190 },
        gravityY: 380,
        scale: { start: 1, end: 0 },
        tint: [0xffffff, 0xcfeaff, 0xffe1a0],
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(20);
    this.goldSparks = scene.add
      .particles(0, 0, TEX.spark, {
        emitting: false,
        lifespan: { min: 220, max: 420 },
        speed: { min: 50, max: 160 },
        gravityY: 120,
        scale: { start: 1.2, end: 0 },
        tint: [0xfff3c4, 0xffd27a, 0xffffff],
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(20);
    this.blood = scene.add
      .particles(0, 0, TEX.spark, {
        emitting: false,
        lifespan: { min: 250, max: 450 },
        speed: { min: 40, max: 120 },
        gravityY: 500,
        tint: 0xa3263a,
      })
      .setDepth(20);
    this.dust = scene.add
      .particles(0, 0, TEX.dust, {
        emitting: false,
        lifespan: { min: 200, max: 420 },
        speedX: { min: -50, max: 50 },
        speedY: { min: -24, max: -4 },
        alpha: { start: 0.8, end: 0 },
        scale: { start: 1, end: 0.5 },
      })
      .setDepth(11);
    this.flash = scene.add.rectangle(0, 0, 8, 8, 0xffffff, 1).setOrigin(0, 0).setScrollFactor(0).setDepth(60).setVisible(false);
    for (let i = 0; i < RINGS; i++) {
      const g = scene.add.graphics().setDepth(21).setBlendMode(Phaser.BlendModes.ADD);
      this.rings.push({ g, t: 1, dur: 1, x: 0, y: 0, r: 0, color: 0xffffff });
    }
  }

  private shake(kind: keyof typeof FEEDBACK.shake): void {
    const [duration, intensity] = FEEDBACK.shake[kind];
    this.scene.cameras.main.shake(duration, intensity);
  }

  private ring(x: number, y: number, radius: number, color: number, duration: number): void {
    const r = this.rings[this.ringIndex++ % RINGS]!;
    Object.assign(r, { t: 0, dur: duration, x, y, r: radius, color });
  }

  handle(e: SimEvent): void {
    const S = FEEDBACK.sparks;
    switch (e.type) {
      case 'jump':
        this.dust.explode(4, e.x, e.y);
        break;
      case 'land':
        this.dust.explode(e.hard ? 10 : 5, e.x, e.y);
        if (e.hard) this.shake('hardLanding');
        break;
      case 'dodge':
        this.dust.explode(6, e.x, e.y);
        break;
      case 'attack':
        if (e.kind === 'heavy') this.dust.explode(6, e.x + e.facing * 18, e.y);
        break;
      case 'chargeFull':
        this.ring(e.x, e.y - 34, 14, 0xffffff, 0.25);
        break;
      case 'hit':
        if (e.targetFaction === 'enemy') {
          const big = e.kind === 'heavy' || e.kind === 'riposte';
          if (e.kind === 'riposte') {
            this.sparks.explode(S.riposte, e.x, e.y);
            this.blood.explode(10, e.x, e.y);
            this.shake('riposte');
            this.screenFlash(0xffffff, 0.06);
          } else {
            this.sparks.explode(big ? S.heavyHit : S.lightHit, e.x + e.facing * -4, e.y);
            this.shake(big ? 'heavyHit' : 'lightHit');
          }
        } else {
          this.blood.explode(12, e.x, e.y);
          this.shake('playerHit');
          this.screenFlash(0xa3263a, 0.09);
        }
        break;
      case 'block':
        if (e.guardBroken) {
          this.sparks.explode(S.guardBreak, e.x, e.y);
          this.shake('guardBreak');
          this.screenFlash(0x6b8cff, 0.08);
        } else {
          this.sparks.explode(S.block, e.x, e.y);
          this.shake('block');
        }
        break;
      case 'parry':
        this.goldSparks.explode(S.parry, e.x, e.y);
        this.ring(e.x, e.y, 22, 0xfff3c4, 0.3);
        this.shake('parry');
        break;
      case 'postureBreak':
        this.goldSparks.explode(S.parry, e.x, e.y);
        this.ring(e.x, e.y + 10, 28, 0xffd27a, 0.45);
        this.shake('postureBreak');
        break;
      case 'reward':
        this.goldSparks.explode(10, e.x, e.y + 8);
        break;
      case 'lootDrop':
        if (e.rarity === 'rare' || e.rarity === 'legendary') {
          this.ring(e.x, e.y + 16, 30, 0xffd27a, 0.6);
          this.goldSparks.explode(18, e.x, e.y + 12);
          this.shake('parry');
        }
        break;
      case 'pickup':
        this.goldSparks.explode(e.rarity === 'common' ? 5 : 14, e.x, e.y);
        break;
      case 'evade':
        this.sparks.explode(S.evade, e.x, e.y);
        break;
      case 'death':
        if (e.faction === 'enemy') this.sparks.explode(S.enemyDeath, e.x, e.y - 20);
        else this.screenFlash(0x000000, 0.4);
        break;
      default:
        break;
    }
  }

  private screenFlash(color: number, duration: number): void {
    const { width, height } = this.scene.scale;
    this.flash.setSize(width, height).setFillStyle(color, 0.35).setVisible(true);
    this.flashTime = duration;
  }

  update(dt: number): void {
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      if (this.flashTime <= 0) this.flash.setVisible(false);
    }
    for (const r of this.rings) {
      r.g.clear();
      if (r.t >= 1) continue;
      r.t = Math.min(1, r.t + dt / r.dur);
      r.g.lineStyle(r.t < 0.5 ? 2 : 1, r.color, 1 - r.t);
      r.g.strokeCircle(r.x, r.y, 3 + r.r * Math.sqrt(r.t));
    }
  }
}
