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
import { EnemyView } from '../render/views/EnemyView';
import { PickupViews } from '../render/views/PickupView';
import { DEV_TOOLS_ENABLED } from '../config/build';
import { getItem } from '../data/items';
import { InventoryPanel } from '../ui/InventoryPanel';
import { RpgHud } from '../ui/RpgHud';
import { Toasts } from '../ui/Toasts';
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
  private enemyViews: EnemyView[] = [];
  private pickupViews!: PickupViews;
  private rpgHud!: RpgHud;
  private toasts!: Toasts;
  private inventory!: InventoryPanel;
  private saveTimer = 0;
  private backdrop!: Backdrop;
  private levelRenderer!: LevelRenderer;
  private atmosphere!: Atmosphere;
  private effects!: Effects;
  private debug!: DebugOverlay;
  private camX = 0;
  private camY = 0;
  private lookAhead = 0;
  private paused = false;
  private menuOpen = false;

  constructor() {
    super('TestChamber');
  }

  create(): void {
    const services = getServices(this);
    const level = parseLevel(TEST_CHAMBER);
    // The profile persists across sessions; development builds also stock the armoury altar.
    this.sim = new Simulation(level, { profile: services.profile, devPickups: DEV_TOOLS_ENABLED });

    this.cameras.main.setBackgroundColor(DISPLAY.backgroundColor);
    this.backdrop = new Backdrop(this, level.playerSpawn.y);
    this.levelRenderer = new LevelRenderer(this, level);
    this.atmosphere = new Atmosphere(this, level);
    this.playerView = new PlayerView(this, this.sim.player);
    this.enemyViews = this.sim.enemies.map((e) => new EnemyView(this, e));
    this.pickupViews = new PickupViews(this);
    const app = document.getElementById('app')!;
    this.rpgHud = new RpgHud(app, services.profile);
    const placeHud = () => {
      const canvas = this.game.canvas.getBoundingClientRect();
      const vp = services.viewport;
      const scale = canvas.height / this.scale.height;
      this.rpgHud.place(scale, vp?.safeArea.left ?? 0, vp?.safeArea.top ?? 0, canvas.left, canvas.top);
    };
    placeHud();
    services.viewport?.onChange(() => requestAnimationFrame(placeHud));
    this.toasts = new Toasts(app);
    this.inventory = new InventoryPanel(app, this.sim, services.save, (open) => this.setMenuOpen(open));
    services.onMenuToggle = () => this.inventory.toggle();
    if (services.save.status === 'corrupt') this.toasts.show('Your save could not be read; a backup was kept and a new one started.', 'info', 5);
    if (services.save.status === 'unsupported-version') this.toasts.show('This save is from a newer version; progress will not be saved.', 'info', 5);
    this.effects = new Effects(this);
    this.debug = new DebugOverlay(this, this.sim, services.debug);
    services.onDebugToggle = () => this.debug.toggle();
    // Expose the simulation for automated browser checks and console inspection.
    if (services.debug.enabled) (window as unknown as { __sevenHalos?: unknown }).__sevenHalos = { sim: this.sim, scene: this };

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
      services.save.saveIfChanged();
      services.onMenuToggle = null;
      this.inventory.destroy();
      this.rpgHud.destroy();
      this.toasts.destroy();
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

  /** The inventory pauses the game and drops any held inputs so nothing leaks into combat. */
  private setMenuOpen(open: boolean): void {
    this.menuOpen = open;
    getServices(this).releaseInputs();
    this.timestep.reset();
    this.rpgHud.invalidate();
  }

  override update(_time: number, deltaMs: number): void {
    const services = getServices(this);
    // Autosave at most once a second, only when the profile changed.
    this.saveTimer += deltaMs / 1000;
    if (this.saveTimer >= 1) {
      this.saveTimer = 0;
      services.save.saveIfChanged();
    }
    this.rpgHud.update();
    if (this.paused || this.menuOpen) return;
    const dt = Math.min(deltaMs / 1000, 0.1);
    const input = getServices(this).input;
    this.timestep.advance(dt, (step) => this.sim.step(step, input));
    const alpha = this.sim.inHitstop ? 1 : this.timestep.alpha;

    this.sim.events.drain(this.handleEvent);

    this.playerView.update(alpha, dt);
    const riposteTarget = this.sim.player.findRiposteTarget();
    this.enemyViews.forEach((v, i) => v.update(alpha, dt, riposteTarget === this.sim.enemies[i]));
    this.pickupViews.update(this.sim.pickups, dt);
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
      case 'attack': {
        const scythe = e.attackId.startsWith('scythe.');
        if (e.faction === 'enemy') sfx.play(e.attackId.startsWith('reaper.') ? 'scytheSwing' : 'enemySwing');
        else if (e.kind === 'heavy') sfx.play(scythe ? 'scytheHeavySwing' : 'heavySwing');
        else sfx.play(scythe ? 'scytheSwing' : 'swing');
        break;
      }
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
        sfx.play(e.attackId.startsWith('reaper.') ? 'reaperTelegraph' : 'telegraph');
        break;
      case 'reward':
        sfx.play('reward');
        this.toasts.show(`${e.enemyName} defeated  ·  +${e.experience} XP  ·  +${e.gold} Gold  ·  +${e.forgePoints} Forge`, 'reward');
        break;
      case 'lootDrop':
        if (e.rarity === 'rare' || e.rarity === 'legendary') this.toasts.show(`★ ${getItem(e.itemId).name} dropped!`, 'rare', 3.5);
        break;
      case 'pickup': {
        const item = getItem(e.itemId);
        const rare = e.rarity === 'rare' || e.rarity === 'legendary';
        sfx.play(rare ? 'rarePickup' : 'pickup');
        this.toasts.show(
          `Obtained ${item.name}${e.quantity > 1 ? ` × ${e.quantity}` : ''}${item.kind === 'weapon' ? '  —  open BAG to equip' : ''}`,
          rare ? 'rare' : 'loot',
          item.kind === 'weapon' ? 4 : 2.4,
        );
        break;
      }
      case 'equip':
        sfx.play('equip');
        this.rpgHud.invalidate();
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
