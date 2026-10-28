import Phaser from 'phaser';
import { sfx } from '../audio/Sfx';
import { DISPLAY } from '../config/display';
import { FixedTimestep } from '../core/FixedTimestep';
import { smoothingFactor } from '../core/math';
import { TEST_CHAMBER } from '../data/levels/testChamber';
import { DebugOverlay } from '../debug/DebugOverlay';
import { getServices } from '../game/services';
import { Effects } from '../render/Effects';
import { Atmosphere } from '../render/environment/Atmosphere';
import { Backdrop } from '../render/environment/Backdrop';
import { LevelRenderer } from '../render/environment/LevelRenderer';
import { PlayerView } from '../render/views/PlayerView';
import { SentinelView } from '../render/views/SentinelView';
import { parseLevel } from '../world/Level';
import type { SimEvent } from '../world/SimEvents';
import { Simulation } from '../world/Simulation';

const CAMERA = {
  lookAhead: 28,
  lookAheadRate: 2.5,
  followRateX: 9,
  followRateY: 5,
  /** Player sits this far below the screen centre so more of the space above is visible. */
  offsetY: -26,
};

/**
 * Movement and combat test scene. The simulation advances in fixed steps;
 * everything drawn here is derived from simulation state each frame.
 */
export class TestChamberScene extends Phaser.Scene {
  private sim!: Simulation;
  private readonly timestep = new FixedTimestep(60);
  private playerView!: PlayerView;
  private enemyViews: SentinelView[] = [];
  private backdrop!: Backdrop;
  private levelRenderer!: LevelRenderer;
  private atmosphere!: Atmosphere;
  private effects!: Effects;
  private debug!: DebugOverlay;
  private camX = 0;
  private camY = 0;
  private lookAhead = 0;
  private paused = false;

  constructor() {
    super('TestChamber');
  }

  create(): void {
    const services = getServices(this);
    const level = parseLevel(TEST_CHAMBER);
    this.sim = new Simulation(level);

    this.cameras.main.setBackgroundColor(DISPLAY.backgroundColor);
    this.backdrop = new Backdrop(this, level.playerSpawn.y);
    this.levelRenderer = new LevelRenderer(this, level);
    this.atmosphere = new Atmosphere(this, level);
    this.playerView = new PlayerView(this, this.sim.player);
    this.enemyViews = this.sim.enemies.map((e) => new SentinelView(this, e));
    this.effects = new Effects(this);
    this.debug = new DebugOverlay(this, this.sim, services.debug);
    services.onDebugToggle = () => this.debug.toggle();
    // Expose the simulation for automated browser checks and console inspection.
    if (services.debug.enabled) (window as unknown as { __sevenHalos?: unknown }).__sevenHalos = { sim: this.sim };

    const cam = this.cameras.main;
    cam.setBounds(0, 0, level.widthPx, level.heightPx);
    cam.setRoundPixels(true);
    this.camX = this.sim.player.body.footX;
    this.camY = this.sim.player.body.footY + CAMERA.offsetY;
    cam.centerOn(this.camX, this.camY);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    this.game.events.on(Phaser.Core.Events.VISIBLE, this.onVisible, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.onHidden, this);
      this.game.events.off(Phaser.Core.Events.VISIBLE, this.onVisible, this);
    });

    this.scene.launch('UI', { player: this.sim.player });
  }

  private onResize(size: Phaser.Structs.Size): void {
    this.cameras.main.setSize(size.width, size.height);
    this.backdrop.resize();
    this.atmosphere.resize();
  }

  private onHidden(): void {
    this.paused = true;
    getServices(this).input.releaseAll();
  }

  private onVisible(): void {
    this.paused = false;
    this.timestep.reset();
  }

  override update(_time: number, deltaMs: number): void {
    if (this.paused) return;
    const dt = Math.min(deltaMs / 1000, 0.1);
    const input = getServices(this).input;
    this.timestep.advance(dt, (step) => this.sim.step(step, input));
    const alpha = this.sim.inHitstop ? 1 : this.timestep.alpha;

    this.sim.events.drain(this.handleEvent);

    this.playerView.update(alpha, dt);
    const riposteTarget = this.sim.player.findRiposteTarget();
    this.enemyViews.forEach((v, i) => v.update(alpha, dt, riposteTarget === this.sim.enemies[i]));
    this.updateCamera(alpha, dt);
    this.backdrop.update(this.cameras.main, dt);
    this.levelRenderer.update(dt);
    this.effects.update(dt);
    this.debug.update(dt);
  }

  private updateCamera(alpha: number, dt: number): void {
    const p = this.sim.player;
    const targetLook = p.isDead ? 0 : p.facing * CAMERA.lookAhead;
    this.lookAhead += (targetLook - this.lookAhead) * smoothingFactor(CAMERA.lookAheadRate, dt);
    const tx = this.playerView.footX(alpha) + this.lookAhead;
    const ty = this.playerView.footY(alpha) + CAMERA.offsetY;
    this.camX += (tx - this.camX) * smoothingFactor(CAMERA.followRateX, dt);
    this.camY += (ty - this.camY) * smoothingFactor(CAMERA.followRateY, dt);
    this.cameras.main.centerOn(this.camX, this.camY);
  }

  private readonly handleEvent = (e: SimEvent): void => {
    this.effects.handle(e);
    switch (e.type) {
      case 'jump':
        sfx.play('jump');
        break;
      case 'land':
        sfx.play('land');
        break;
      case 'dodge':
        sfx.play('dodge');
        break;
      case 'attack':
        sfx.play(e.faction === 'enemy' ? 'enemySwing' : e.kind === 'heavy' ? 'heavySwing' : 'swing');
        break;
      case 'chargeStart': {
        const charge = this.sim.player.attack.attack?.charge;
        if (charge) sfx.startCharge(charge.maxFrames / 60);
        break;
      }
      case 'chargeFull':
        sfx.play('chargeFull');
        break;
      case 'chargeEnd':
        sfx.stopCharge();
        break;
      case 'block':
        sfx.play(e.guardBroken ? 'guardBreak' : 'block');
        break;
      case 'parryAttempt':
        sfx.play('parryAttempt');
        break;
      case 'parry':
        sfx.play('parry');
        break;
      case 'postureBreak':
        sfx.play('postureBreak');
        break;
      case 'riposte':
        break;
      case 'telegraph':
        sfx.play('telegraph');
        break;
      case 'hit':
        sfx.play(e.targetFaction === 'player' ? 'hurt' : e.kind === 'riposte' ? 'riposte' : e.kind === 'heavy' ? 'heavyHit' : 'hit');
        break;
      case 'evade':
        sfx.play('evade');
        break;
      case 'death':
        sfx.play('death');
        break;
      case 'respawn':
        if (e.faction === 'player') {
          this.camX = e.x;
          this.camY = e.y + CAMERA.offsetY;
        }
        break;
    }
  };
}
