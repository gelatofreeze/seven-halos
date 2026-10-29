import { CombatSystem } from '../combat/CombatSystem';
import type { Combatant } from '../combat/types';
import type { Facing } from '../core/math';
import { rectsOverlap } from '../core/Rect';
import { seeded } from '../core/random';
import { getEnemy } from '../data/enemies';
import { getSlot, type SlotId } from '../data/equipmentSlots';
import { getItem } from '../data/items';
import { Enemy } from '../entities/enemy/Enemy';
import { Player } from '../entities/player/Player';
import { createInputFrame, type InputProvider } from '../input/InputActions';
import { CollisionWorld } from '../physics/CollisionWorld';
import { checkEquip, equipInto, unequipSlot } from '../rpg/Loadout';
import { equippedEffects, NO_EFFECTS, type ResolvedEffects } from '../rpg/PassiveEffects';
import { PlayerProfile } from '../rpg/Profile';
import { upgradeWeapon, type UpgradeResult } from '../rpg/WeaponUpgrades';
import { Conversation } from '../rpg/Dialogue';
import { questEvent, startQuest, type QuestChange, type QuestEvent } from '../rpg/Quests';
import type { Outcome } from '../data/dialogue';
import { npcsIn } from '../data/npcs';
import { QUESTS } from '../data/quests';
import { FOCUS_PRIORITY, type CheckpointObject, type LevelData, type NpcObject, type WorldObject } from './Level';
import { rollLoot } from './Loot';
import { createPickup, PICKUP_ARM_TIME, stepPickup, type Pickup } from './Pickups';
import { SimEventQueue, type TravelReason } from './SimEvents';
import { findCheckpoint, type WorldLocation } from './regions';
import type { WorldSession } from './WorldProgress';

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
  /** Where the player appears; defaults to the level's spawn. */
  arrival?: { x: number; y: number; facing?: Facing };
  /** Health to arrive with (carried through a doorway); defaults to full. */
  arrivalHealth?: number | null;
  /**
   * Unsaved world state shared across regions (enemies defeated since the
   * last rest). Only used when the level's `enemyRespawn` is 'rest'.
   */
  session?: WorldSession;
  /**
   * `local`: after death the player gets up at the level spawn (tests, the
   * test chamber). `checkpoint`: death asks to travel to the last shrine
   * (`pendingTravel`), which `GameWorld` carries out.
   */
  respawnMode?: 'local' | 'checkpoint';
}

/** The simulation wants to leave this region. `to` is omitted for death (GameWorld picks the shrine). */
export interface TravelRequest {
  reason: TravelReason;
  to?: WorldLocation;
}

export type ShrineResult = 'ok' | 'not-at-shrine' | 'locked' | 'unknown' | 'busy';

/** 'invalid': not an owned item. Other failures come from the loadout rules (rpg/Loadout.ts). */
export type EquipResult = 'equipped' | 'busy' | 'invalid' | 'incompatible' | 'blocked-by-two-handed' | 'required';
export type UnequipResult = 'unequipped' | 'busy' | 'empty' | 'required';

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
  /** Passive effects of the current loadout (derived, never saved). */
  readonly effects: ResolvedEffects = { ...NO_EFFECTS };
  /** Set when the player walks out, dies (checkpoint mode), rests or travels. The simulation stops stepping. */
  pendingTravel: TravelRequest | null = null;
  /** The interactable the player is standing at (shrine, cache, door), or null. */
  focus: WorldObject | null = null;
  /** This region's interactables: the level's objects plus the NPCs placed here (data/npcs.ts). */
  readonly objects: WorldObject[];
  /** Doorways only work once the player has stepped out of every exit zone (no instant ping-pong). */
  private exitsArmed = false;
  private readonly session: WorldSession | null;

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
    this.objects = [...level.objects];
    for (const npc of npcsIn(level.id)) {
      const a = level.anchors[npc.anchor];
      if (!a) continue;
      const reach = npc.reach ?? { w: 36, h: 44 };
      this.objects.push({ kind: 'npc', id: npc.id, name: npc.name, dialogue: npc.dialogue, visual: npc.visual, facing: npc.facing ?? a.facing, x: a.x, y: a.y, zone: { x: a.x - reach.w / 2, y: a.y - reach.h, w: reach.w, h: reach.h } });
    }
    const arrival = options.arrival ?? level.playerSpawn;
    this.player = new Player(this.world, this.events, arrival.x, arrival.y);
    this.player.facing = options.arrival?.facing ?? 1;
    if (options.arrivalHealth != null) this.player.health.current = Math.max(1, Math.min(this.player.health.max, options.arrivalHealth));
    this.session = level.enemyRespawn === 'rest' ? (options.session ?? null) : null;
    if (options.respawnMode === 'checkpoint') {
      this.player.respawnOverride = () => {
        if (!this.pendingTravel) this.requestTravelOut({ reason: 'death' });
      };
    }
    this.applyEquipment();
    this.combatants.push(this.player);
    for (const spawn of level.enemySpawns) {
      // World rule: an ordinary enemy defeated since the last rest stays down, even across rooms.
      if (this.session?.defeated.has(spawn.id)) continue;
      const enemy = new Enemy(getEnemy(spawn.enemyId), this.world, this.events, this.player, spawn.x, spawn.y, this.random);
      enemy.spawnId = spawn.id;
      if (level.enemyRespawn === 'rest') enemy.respawnDelay = null;
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
    // Leaving the region: nothing more happens here (GameWorld builds the next one).
    if (this.pendingTravel) return;
    this.tick++;
    if (this.combat.hitstop > 0) {
      // Freeze everything. Input is not sampled, so presses stay latched for after the freeze.
      this.combat.hitstop--;
      return;
    }
    if (this.equipmentSyncPending && this.player.canChangeEquipment()) {
      this.equipmentSyncPending = false;
      this.applyEquipment();
    }
    inputs.sample(this.input);
    this.player.step(this.input, dt);
    for (const enemy of this.enemies) enemy.step(dt);
    this.separateBodies();
    this.combat.step(this.combatants);
    this.processDeaths();
    this.stepPickups(dt);
    this.updateFocus();
    if (this.input.interactPressed) this.interact();
    this.checkExits();
  }

  // ---- World interaction ------------------------------------------------------------------

  /** The nearest usable object whose zone the player stands in. One object at most, so one press does one thing. */
  private updateFocus(): void {
    this.focus = null;
    const p = this.player;
    if (p.isDead) return;
    let best = Infinity;
    const b = p.body;
    let bestPriority = -1;
    for (const o of this.objects) {
      if (o.kind === 'exit' && !o.interact) continue;
      if (o.kind === 'cache' && this.profile.world.hasFlag(o.id)) continue;
      if (!rectsOverlap(b, o.zone)) continue;
      const priority = FOCUS_PRIORITY[o.kind];
      const d = Math.abs(b.footX - o.x);
      if (priority > bestPriority || (priority === bestPriority && d < best)) {
        bestPriority = priority;
        best = d;
        this.focus = o;
      }
    }
  }

  /** Use the focused object. Only from a neutral state (not mid-attack, roll, stagger...). */
  private interact(): void {
    const o = this.focus;
    if (!o || !this.player.canChangeEquipment() || !this.player.body.grounded) return;
    const world = this.profile.world;
    if (o.kind === 'checkpoint') {
      const firstTime = world.activate(o.id);
      if (firstTime) {
        world.respawn = { region: this.level.id, anchor: o.id };
        this.profile.touch();
        this.events.push({ type: 'checkpointActivated', id: o.id, name: o.name, x: o.x, y: o.y });
        this.questEvent({ type: 'activateCheckpoint', checkpoint: o.id });
      }
      this.events.push({ type: 'shrine', id: o.id, name: o.name, firstTime });
    } else if (o.kind === 'cache') {
      // The flag is the record: set it first, and grant only if it wasn't already set.
      if (!world.setFlag(o.id)) return;
      const r = o.reward;
      for (const it of r.items ?? []) this.profile.inventory.add(it.item, it.quantity);
      this.profile.wallet.add({ experience: 0, gold: r.gold ?? 0, weaponXp: r.weaponXp ?? 0 });
      this.profile.touch();
      this.events.push({ type: 'cacheOpened', id: o.id, x: o.x, y: o.y, items: r.items ?? [], gold: r.gold ?? 0, weaponXp: r.weaponXp ?? 0 });
      this.focus = null;
    } else if (o.kind === 'npc') {
      this.events.push({ type: 'talk', npc: o.id, dialogue: o.dialogue, name: o.name });
    } else if (o.kind === 'lore') {
      const firstTime = !this.profile.lore.has(o.id);
      if (firstTime) {
        this.profile.lore.add(o.id);
        this.profile.touch();
      }
      this.events.push({ type: 'lore', id: o.id, firstTime });
    } else {
      this.requestTravelOut({ reason: 'exit', to: o.to });
    }
  }

  // ---- Quests and dialogue ----------------------------------------------------------------

  /** Feed a world event to the quest engine and announce what changed. */
  questEvent(event: QuestEvent): void {
    this.announce(questEvent(this.profile, event));
  }

  announce(changes: readonly QuestChange[]): void {
    for (const c of changes) this.events.push({ type: 'quest', change: c });
  }

  /**
   * Begin a conversation with an NPC standing here. Dialogue outcomes are
   * validated and applied by the simulation (never by the panel); finishing
   * the conversation counts as having talked to them.
   */
  startConversation(npcId: string): Conversation | null {
    const npc = this.objects.find((o): o is NpcObject => o.kind === 'npc' && o.id === npcId);
    if (!npc) return null;
    return new Conversation(npc.dialogue, this.profile, (o) => this.applyOutcome(o));
  }

  /** Called when a conversation reached its end (not when dismissed). */
  finishConversation(npcId: string): void {
    this.questEvent({ type: 'talk', npc: npcId });
  }

  private applyOutcome(o: Outcome): void {
    if ('startQuest' in o && QUESTS[o.startQuest]) this.announce(startQuest(this.profile, o.startQuest));
  }

  private checkExits(): void {
    if (this.pendingTravel || this.player.isDead) return;
    const b = this.player.body;
    let inside: WorldObject | null = null;
    for (const o of this.objects) {
      if (o.kind !== 'exit' || o.interact) continue;
      if (rectsOverlap(b, o.zone)) inside = o;
    }
    if (!inside) {
      this.exitsArmed = true;
      return;
    }
    if (this.exitsArmed && inside.kind === 'exit') this.requestTravelOut({ reason: 'exit', to: inside.to });
  }

  /** Leave the region (also used by development tools to jump between regions). */
  requestTravelOut(request: TravelRequest): void {
    if (this.pendingTravel) return;
    this.pendingTravel = request;
    this.events.push({ type: 'travel', reason: request.reason });
  }

  /** The activated shrine the player is standing at, if any. */
  currentShrine(): CheckpointObject | null {
    const o = this.focus;
    return o && o.kind === 'checkpoint' && this.profile.world.isActive(o.id) ? o : null;
  }

  /** Rest at the shrine the player stands at: restores the player and brings ordinary enemies back. */
  requestRest(): ShrineResult {
    const shrine = this.currentShrine();
    if (!shrine) return 'not-at-shrine';
    if (this.pendingTravel) return 'busy';
    this.profile.world.respawn = { region: this.level.id, anchor: shrine.id };
    this.profile.touch();
    this.requestTravelOut({ reason: 'rest', to: { region: this.level.id, anchor: shrine.id } });
    return 'ok';
  }

  /** Travel from the shrine the player stands at to another activated shrine. */
  requestFastTravel(destination: string): ShrineResult {
    if (!this.currentShrine()) return 'not-at-shrine';
    const info = findCheckpoint(destination);
    if (!info) return 'unknown';
    if (!this.profile.world.isActive(destination)) return 'locked';
    if (this.pendingTravel) return 'busy';
    const to = { region: info.region, anchor: destination };
    this.profile.world.respawn = to;
    this.profile.touch();
    this.requestTravelOut({ reason: 'travel', to });
    return 'ok';
  }

  // ---- Equipment ---------------------------------------------------------------------------

  /**
   * Equip an owned instance into `slot` (validated by the loadout rules).
   * Changing a functional slot is refused while the player is mid-action
   * (attacking, rolling, guarding, staggered...) so a swap can never alter an
   * active attack, hitbox, riposte or its stamina cost.
   */
  requestEquip(uid: number, slot: SlotId = 'mainHand'): EquipResult {
    const profile = this.profile;
    if (!profile.inventory.find(uid)) return 'invalid';
    const check = checkEquip(profile.inventory, profile.loadout, uid, slot);
    if (check === 'not-owned') return 'invalid';
    if (check !== 'ok') return check;
    const affectsPlayer = getSlot(slot).functional || getSlot(profile.loadout.slotOf(uid) ?? slot).functional;
    if (affectsPlayer && !this.player.canChangeEquipment()) return 'busy';
    if (profile.loadout.get(slot) !== uid) {
      equipInto(profile.inventory, profile.loadout, uid, slot);
      profile.touch();
    }
    if (affectsPlayer) {
      this.applyEquipment();
      this.events.push({ type: 'equip', weaponId: this.player.equipment.weapon.id });
    }
    return 'equipped';
  }

  /**
   * Empty a slot (back to the backpack). Same timing rule as equipping:
   * refused mid-action when the slot affects the player. The main hand can't
   * be emptied.
   */
  requestUnequip(slot: SlotId): UnequipResult {
    const loadout = this.profile.loadout;
    if (loadout.get(slot) === 0) return 'empty';
    if (getSlot(slot).required) return 'required';
    if (getSlot(slot).functional && !this.player.canChangeEquipment()) return 'busy';
    unequipSlot(loadout, slot);
    this.profile.touch();
    if (getSlot(slot).functional) {
      this.applyEquipment();
      this.events.push({ type: 'equip', weaponId: this.player.equipment.weapon.id });
    }
    return 'unequipped';
  }

  /**
   * Upgrade a weapon instance with Weapon XP (see rpg/WeaponUpgrades.ts for
   * the transaction). The equipped weapon's stats follow at the next neutral
   * moment, so an attack already in progress keeps its numbers.
   */
  upgradeWeapon(uid: number, expectedLevel: number): UpgradeResult {
    const result = upgradeWeapon(this.profile, uid, expectedLevel);
    if (result.ok) {
      if (uid === this.profile.equippedWeaponUid) this.syncEquipmentFromProfile();
      this.events.push({ type: 'upgrade', uid, itemId: this.profile.inventory.find(uid)!.itemId, level: result.level, cost: result.cost });
    }
    return result;
  }

  /** A menu opened or closed: buffered player actions are dropped rather than fired later. */
  discardQueuedInput(): void {
    this.player.clearBufferedActions();
  }

  /** Re-read the profile's equipped weapon at the next neutral moment. */
  syncEquipmentFromProfile(): void {
    if (this.player.canChangeEquipment()) this.applyEquipment();
    else this.equipmentSyncPending = true;
  }

  /** Apply the loadout to the player: the main-hand weapon, then passive effects (rings). */
  private applyEquipment(): void {
    const instance = this.profile.equippedWeapon();
    this.player.equipment.equipWeapon(this.profile.equippedWeaponId(), instance?.upgradeLevel ?? 0);
    this.player.refreshStats();
    equippedEffects(this.profile, this.effects);
    this.player.setExtraAirJumps(this.effects.extraAirJumps);
  }

  // ---- Rewards, loot and pickups ----------------------------------------------------------

  /** Grant rewards and roll loot exactly once per enemy death. */
  private processDeaths(): void {
    for (const e of this.enemies) {
      if (!e.consumeDeath()) continue;
      if (e.respawnDelay === null) this.session?.defeated.add(e.spawnId);
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
