import Phaser from 'phaser';
import { sfx } from '../audio/Sfx';
import { DISPLAY } from '../config/display';
import { FixedTimestep } from '../core/FixedTimestep';
import { smoothingFactor } from '../core/math';
import { DebugOverlay } from '../debug/DebugOverlay';
import { getServices } from '../game/services';
import { Effects } from '../render/Effects';
import { Atmosphere } from '../render/environment/Atmosphere';
import { Backdrop } from '../render/environment/Backdrop';
import { LevelRenderer } from '../render/environment/LevelRenderer';
import { PlayerView } from '../render/views/PlayerView';
import { EnemyView } from '../render/views/EnemyView';
import { PickupViews } from '../render/views/PickupView';
import { getItem } from '../data/items';
import { PauseMenu } from '../ui/PauseMenu';
import { RpgHud } from '../ui/RpgHud';
import type { SimEvent } from '../world/SimEvents';
import type { Simulation } from '../world/Simulation';
import { InteractionPrompt } from '../ui/InteractionPrompt';
import { ShrineMenu } from '../ui/ShrineMenu';
import { cacheMessage, promptLabel } from '../ui/worldModel';
import { findCheckpoint } from '../world/regions';
import type { UIScene } from './UIScene';

const CAMERA = {
  lookAhead: 28,
  lookAheadRate: 2.5,
  followRateX: 9,
  followRateY: 5,
  /** Player sits this far below the screen centre so more of the space above is visible. */
  offsetY: -26,
};

/** Camera fade when leaving / entering a region, ms. Death fades slower. */
const FADE = { out: 220, outAfterDeath: 600, in: 260 };

/**
 * The one gameplay scene. It shows whichever region `GameWorld` has loaded:
 * the simulation advances in fixed steps and everything drawn here is derived
 * from simulation state each frame. Moving to another region (a doorway,
 * death, resting, fast travel) fades out, lets `GameWorld` build the next
 * region, and restarts this scene, so every per-region object, listener and
 * DOM panel is torn down on SHUTDOWN and nothing accumulates.
 */
export class WorldScene extends Phaser.Scene {
  private sim!: Simulation;
  private readonly timestep = new FixedTimestep(60);
  private playerView!: PlayerView;
  private enemyViews: EnemyView[] = [];
  private pickupViews!: PickupViews;
  private rpgHud!: RpgHud;
  private menu!: PauseMenu;
  private shrineMenu!: ShrineMenu;
  private prompt!: InteractionPrompt;
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
  private shrineOpen = false;
  /** Fading out to another region: nothing steps and no input is read. */
  private transitioning = false;

  constructor() {
    super('World');
  }

  create(): void {
    const services = getServices(this);
    const world = services.world;
    this.sim = world.sim;
    const level = this.sim.level;
    this.transitioning = false;
    this.menuOpen = false;
    this.shrineOpen = false;
    this.paused = false;
    this.lookAhead = 0;
    this.timestep.reset();

    this.cameras.main.setBackgroundColor(DISPLAY.backgroundColor);
    // Parallax layers rest on the lowest arrival point (the region's main floor).
    const floorY = Math.max(...Object.values(level.anchors).map((a) => a.y));
    this.backdrop = new Backdrop(this, floorY, level.environment);
    this.levelRenderer = new LevelRenderer(this, level, services.profile.world);
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
    const unsubscribeViewport = services.viewport?.onChange(() => requestAnimationFrame(placeHud));
    this.menu = new PauseMenu(app, this.sim, services.save, (open) => this.setMenuOpen(open));
    this.shrineMenu = new ShrineMenu(app, this.sim, (open) => this.setShrineOpen(open));
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.prompt = new InteractionPrompt(app, () => services.input.tap('interact', 'prompt'), touch);
    services.onMenuToggle = () => {
      if (this.transitioning) return;
      if (this.shrineMenu.isOpen) this.shrineMenu.close();
      else this.menu.toggle();
    };
    this.announceArrival();
    this.effects = new Effects(this);
    this.debug = new DebugOverlay(this, this.sim, services.debug);
    services.onDebugToggle = () => this.debug.toggle();
    // Expose the simulation for automated browser checks and console inspection.
    if (services.debug.enabled) (window as unknown as { __sevenHalos?: unknown }).__sevenHalos = { sim: this.sim, scene: this, world };

    const cam = this.cameras.main;
    cam.setBounds(0, 0, level.widthPx, level.heightPx);
    cam.setRoundPixels(true);
    this.camX = this.sim.player.body.footX;
    this.camY = this.sim.player.body.footY + CAMERA.offsetY;
    cam.centerOn(this.camX, this.camY);
    cam.fadeIn(FADE.in);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    this.game.events.on(Phaser.Core.Events.VISIBLE, this.onVisible, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.onHidden, this);
      this.game.events.off(Phaser.Core.Events.VISIBLE, this.onVisible, this);
      services.save.saveIfChanged();
      services.onMenuToggle = null;
      unsubscribeViewport?.();
      this.menu.destroy();
      this.shrineMenu.destroy();
      this.prompt.destroy();
      this.rpgHud.destroy();
    });

    // The HUD scene keeps running across regions; it just follows the new player.
    if (this.scene.isActive('UI')) (this.scene.get('UI') as UIScene).setPlayer(this.sim.player);
    else this.scene.launch('UI', { player: this.sim.player });
  }

  /** Region banner and one-off save notices. */
  private announceArrival(): void {
    const services = getServices(this);
    const toasts = services.toasts;
    const world = services.world;
    const reason = world.lastEnterReason;
    if (reason === 'load') {
      const status = services.save.status;
      if (status === 'corrupt') toasts.show('Your save could not be read; a backup was kept and a new one started.', 'info', 5);
      if (status === 'migrated')
        toasts.show(services.save.migrationBackedUp ? 'Save updated to this version. Your old save was backed up.' : 'Save could not be backed up, so it was not updated; progress this session will not be saved.', 'info', 6);
      if (status === 'unsupported-version') toasts.show('This save is from a newer version; progress will not be saved.', 'info', 5);
    }
    const shrine = findCheckpoint(world.location.anchor);
    if (reason === 'death') toasts.show(shrine ? `You awaken at the ${shrine.name}.` : 'You awaken.', 'info', 3);
    else if (reason === 'rest') toasts.show('Rested. The shrine restores you; the fallen rise again.', 'info', 3);
    else toasts.show(world.region.name, 'info', 2.4);
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

  /**
   * The menu pauses the game. Opening and closing both release held inputs and
   * drop pending or buffered presses, so nothing leaks into combat either way.
   */
  private setMenuOpen(open: boolean): void {
    this.menuOpen = open;
    this.isolateInput();
  }

  private setShrineOpen(open: boolean): void {
    this.shrineOpen = open;
    this.isolateInput();
  }

  private isolateInput(): void {
    const services = getServices(this);
    services.releaseInputs();
    services.input.discardPendingPresses();
    this.sim.discardQueuedInput();
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
    const blocked = this.paused || this.menuOpen || this.shrineOpen || this.transitioning;
    this.prompt.set(blocked ? null : promptLabel(this.sim.focus, services.profile.world));
    if (blocked) return;
    // A shrine menu choice (rest / travel) leaves the region once the menu has closed.
    if (this.sim.pendingTravel) {
      this.beginTransition();
      return;
    }
    const dt = Math.min(deltaMs / 1000, 0.1);
    const input = getServices(this).input;
    this.timestep.advance(dt, (step) => this.sim.step(step, input));
    const alpha = this.sim.inHitstop ? 1 : this.timestep.alpha;

    this.sim.events.drain(this.handleEvent);
    if (this.sim.pendingTravel && !this.shrineOpen) this.beginTransition();

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

  /** Fade out, let GameWorld load the destination, then rebuild this scene for it. */
  private beginTransition(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    const services = getServices(this);
    services.releaseInputs();
    services.input.discardPendingPresses();
    this.sim.discardQueuedInput();
    this.menu.close();
    this.prompt.set(null);
    const cam = this.cameras.main;
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      services.world.completeTravel();
      services.save.saveIfChanged();
      // Presses made during the fade are dropped too.
      services.input.discardPendingPresses();
      this.scene.restart();
    });
    cam.fadeOut(this.sim.pendingTravel?.reason === 'death' ? FADE.outAfterDeath : FADE.out, 0, 0, 0);
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
      case 'checkpointActivated':
        sfx.play('rarePickup');
        this.levelRenderer.refreshObjects();
        getServices(this).toasts.show(`Shrine lit — ${e.name}`, 'rare', 3);
        getServices(this).save.saveIfChanged();
        break;
      case 'shrine':
        this.shrineMenu.open(e.id, e.firstTime);
        break;
      case 'cacheOpened':
        sfx.play('rarePickup');
        this.levelRenderer.refreshObjects();
        getServices(this).toasts.show(cacheMessage(e.items, e.gold, (id) => getItem(id).name), 'rare', 3.2);
        getServices(this).save.saveIfChanged();
        break;
      case 'reward':
        sfx.play('reward');
        getServices(this).toasts.show(`${e.enemyName} defeated  ·  +${e.experience} XP  ·  +${e.gold} Gold`, 'reward');
        break;
      case 'lootDrop':
        if (e.rarity === 'rare' || e.rarity === 'legendary') getServices(this).toasts.show(`★ ${getItem(e.itemId).name} dropped!`, 'rare', 3.5);
        break;
      case 'pickup': {
        const item = getItem(e.itemId);
        const rare = e.rarity === 'rare' || e.rarity === 'legendary';
        sfx.play(rare ? 'rarePickup' : 'pickup');
        getServices(this).toasts.show(
          `Obtained ${item.name}${e.quantity > 1 ? ` × ${e.quantity}` : ''}${item.kind === 'weapon' ? '  —  open MENU to equip' : ''}`,
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
