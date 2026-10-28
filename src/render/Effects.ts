import Phaser from 'phaser';
import type { SimEvent } from '../world/SimEvents';
import { TEX } from './textures/registerTextures';

/** Particle and camera feedback for simulation events. Purely presentational. */
export class Effects {
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly blood: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly flash: Phaser.GameObjects.Rectangle;
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
  }

  handle(e: SimEvent): void {
    const cam = this.scene.cameras.main;
    switch (e.type) {
      case 'jump':
        this.dust.explode(4, e.x, e.y);
        break;
      case 'land':
        this.dust.explode(e.hard ? 10 : 5, e.x, e.y);
        if (e.hard) cam.shake(80, 0.004);
        break;
      case 'dodge':
        this.dust.explode(6, e.x, e.y);
        break;
      case 'hit':
        if (e.targetFaction === 'enemy') {
          this.sparks.explode(e.poiseBroken ? 16 : 10, e.x + e.facing * -4, e.y);
          cam.shake(70, e.poiseBroken ? 0.006 : 0.0035);
        } else {
          this.blood.explode(12, e.x, e.y);
          cam.shake(140, 0.009);
          this.screenFlash(0xa3263a, 0.09);
        }
        break;
      case 'evade':
        this.sparks.explode(5, e.x, e.y);
        break;
      case 'death':
        if (e.faction === 'enemy') this.sparks.explode(24, e.x, e.y - 20);
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
  }
}
