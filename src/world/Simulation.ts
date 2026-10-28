import { CombatSystem } from '../combat/CombatSystem';
import type { Combatant } from '../combat/types';
import { seeded } from '../core/random';
import { getEnemy } from '../data/enemies';
import { getItem } from '../data/items';
import { Enemy } from '../entities/enemy/Enemy';
import { Player } from '../entities/player/Player';
import { createInputFrame, type InputProvider } from '../input/InputActions';
import { CollisionWorld } from '../physics/CollisionWorld';
import { PlayerProfile } from '../rpg/Profile';
import type { LevelData } from './Level';
import { rollLoot } from './Loot';
import { createPickup, PICKUP_ARM_TIME, stepPickup, type Pickup } from './Pickups';
import { SimEventQueue } from './SimEvents';

export interface SimulationOptions {
  /** Seed for AI decisions. Loot uses a separate stream derived from it. */
  seed?: number;
  /** Persistent player profile (currencies, inventory, equipment). */
  profile?: PlayerProfile;
  /**
   * Development builds only: place test equipment on altar props (`A`) so new
   * weapons can be tried without farming. Never enabled in commercial builds.
   */
  devPickups?: boolean;
}

export type EquipResult = 'equipped' | 'busy' | 'invalid';

/** Extra reach around the player's body for collecting pickups, px. */
const PICKUP_REACH = 6;

/**
 * The complete gameplay simulation for one level, independent of Phaser.
 * Scenes call `step` at a fixed rate and render whatever state results.
 */
export class Simulation {
  readonly world: CollisionWorld;
  readonly events = new SimEventQueue();
  readonly combat: CombatSystem;
  readonly player: Player;
  readonly enemies: Enemy[] = [];
  readonly combatants: Combatant[] = [];
  readonly pickups: Pickup[] = [];
  readonly profile: PlayerProfile;
  /** Total fixed steps advanced, including hit-stop steps. */
  tick = 0;
  private readonly input = createInputFrame();
  /** Deterministic randomness for AI decisions; same seed, same fight. */
  readonly random: () => number;
  /** Separate deterministic stream for loot, so drops never alter combat outcomes. */
  readonly lootRandom: () => number;
  /** The profile's equipped weapon changed outside `requestEquip` (e.g. a save reset); apply when neutral. */
  private equipmentSyncPending = false;

  constructor(
    readonly level: LevelData,
    options: SimulationOptions = {},
  ) {
    const seed = options.seed ?? 7;
    this.random = seeded(seed);
    this.lootRandom = seeded((seed ^ 0x5eed1007) >>> 0);
    this.profile = options.profile ?? new PlayerProfile();
    this.world = new CollisionWorld(level.solids, { x: 0, y: 0, w: level.widthPx, h: level.heightPx });
    this.combat = new CombatSystem(this.events);
    this.player = new Player(this.world, this.events, level.playerSpawn.x, level.playerSpawn.y);
    this.applyEquippedWeapon();
    this.combatants.push(this.player);
    for (const spawn of level.enemySpawns) {
      const enemy = new Enemy(getEnemy(spawn.enemyId), this.world, this.events, this.player, spawn.x, spawn.y, this.random);
      this.enemies.push(enemy);
      this.combatants.push(enemy);
    }
    this.player.riposteTargets = this.enemies;
    if (options.devPickups) {
      for (const prop of level.props) {
        if (prop.kind === 'altar' && !this.profile.inventory.owns('mourning-crescent')) {
          this.spawnPickup('mourning-crescent', 1, prop.x, prop.y - 4, 0);
        }
      }
    }
  }

  /** True while the simulation is frozen by hit-stop. */
  get inHitstop(): boolean {
    return this.combat.hitstop > 0;
  }

  step(dt: number, inputs: InputProvider): void {
    this.tick++;
    if (this.combat.hitstop > 0) {
      // Freeze everything. Input is not sampled, so presses stay latched for after the freeze.
      this.combat.hitstop--;
      return;
    }
    if (this.equipmentSyncPending && this.player.canChangeEquipment()) {
      this.equipmentSyncPending = false;
      this.applyEquippedWeapon();
    }
    inputs.sample(this.input);
    this.player.step(this.input, dt);
    for (const enemy of this.enemies) enemy.step(dt);
    this.separateBodies();
    this.combat.step(this.combatants);
    this.processDeaths();
    this.stepPickups(dt);
  }

  // ---- Equipment ---------------------------------------------------------------------------

  /**
   * Equip an owned weapon instance. Refused while the player is mid-action
   * (attacking, rolling, guarding, staggered...) so a swap can never alter an
   * active attack, hitbox, riposte or its stamina cost.
   */
  requestEquip(uid: number): EquipResult {
    const instance = this.profile.inventory.find(uid);
    if (!instance || getItem(instance.itemId).kind !== 'weapon') return 'invalid';
    if (!this.player.canChangeEquipment()) return 'busy';
    if (this.profile.equippedWeaponUid !== uid) {
      this.profile.equippedWeaponUid = uid;
      this.profile.touch();
    }
    this.applyEquippedWeapon();
    this.events.push({ type: 'equip', weaponId: this.player.equipment.weapon.id });
    return 'equipped';
  }

  /** Re-read the profile's equipped weapon at the next neutral moment. */
  syncEquipmentFromProfile(): void {
    if (this.player.canChangeEquipment()) this.applyEquippedWeapon();
    else this.equipmentSyncPending = true;
  }

  private applyEquippedWeapon(): void {
    const instance = this.profile.equippedWeapon();
    this.player.equipment.equipWeapon(this.profile.equippedWeaponId(), instance?.upgradeLevel ?? 0);
    this.player.refreshStats();
  }

  // ---- Rewards, loot and pickups ----------------------------------------------------------

  /** Grant rewards and roll loot exactly once per enemy death. */
  private processDeaths(): void {
    for (const e of this.enemies) {
      if (!e.consumeDeath()) continue;
      const r = e.def.rewards;
      this.profile.wallet.add(r);
      this.profile.touch();
      this.events.push({ type: 'reward', enemyName: e.def.name, x: e.body.footX, y: e.body.y, ...r });
      const drops = rollLoot(e.def.loot, this.lootRandom, this.profile.inventory);
      drops.forEach((d, i) => {
        this.spawnPickup(d.itemId, d.quantity, e.body.footX, e.body.footY - 8, (i % 2 === 0 ? 1 : -1) * (30 + i * 15));
        this.events.push({ type: 'lootDrop', itemId: d.itemId, rarity: d.rarity, x: e.body.footX, y: e.body.y });
      });
    }
  }

  /** Place a collectible in the world (loot drops, level placements, dev tooling). */
  spawnPickup(itemId: string, quantity: number, footX: number, footY: number, popVx: number): Pickup {
    const p = createPickup(itemId, quantity, getItem(itemId).rarity, footX, footY, popVx);
    this.pickups.push(p);
    return p;
  }

  private stepPickups(dt: number): void {
    const pb = this.player.body;
    const bounds = this.world.bounds;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i]!;
      stepPickup(p, this.world, dt);
      // Never lose an item to a pit: bring it back next to the player.
      if (p.body.y > bounds.y + bounds.h + 32) p.body.teleport(pb.footX, pb.footY - 12);
      if (p.collected || this.player.isDead || p.age < PICKUP_ARM_TIME) continue;
      const b = p.body;
      const overlaps =
        b.x < pb.x + pb.w + PICKUP_REACH && b.x + b.w > pb.x - PICKUP_REACH && b.y < pb.y + pb.h + PICKUP_REACH && b.y + b.h > pb.y - PICKUP_REACH;
      if (!overlaps) continue;
      p.collected = true;
      this.profile.inventory.add(p.itemId, p.quantity);
      this.profile.touch();
      this.events.push({ type: 'pickup', itemId: p.itemId, quantity: p.quantity, rarity: p.rarity, x: b.footX, y: b.y });
      this.pickups.splice(i, 1);
    }
  }

  /** Soft push so the player cannot stand inside living enemies; rolling passes through. */
  private separateBodies(): void {
    const p = this.player;
    if (p.isDead || p.state === 'dodge') return;
    for (const e of this.enemies) {
      if (e.isDead) continue;
      const a = p.body;
      const b = e.body;
      if (a.x >= b.x + b.w || a.x + a.w <= b.x || a.y >= b.y + b.h || a.y + a.h <= b.y) continue;
      const push = a.footX < b.footX ? -1 : 1;
      const overlap = push < 0 ? a.x + a.w - b.x : b.x + b.w - a.x;
      a.moveX(this.world, push * Math.min(overlap, 2.5));
    }
  }
}
