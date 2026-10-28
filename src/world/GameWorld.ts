import type { PlayerProfile } from '../rpg/Profile';
import { getRegion, getRegionDef, hasRegion, isValidLocation, WORLD_START, type RegionDefinition, type WorldLocation } from './regions';
import type { TravelReason } from './SimEvents';
import { Simulation } from './Simulation';
import { WorldSession } from './WorldProgress';

export type EnterReason = TravelReason | 'load';

export interface GameWorldOptions {
  seed?: number;
  /** Development builds: stock the test chamber's armoury altar. */
  devPickups?: boolean;
}

/**
 * Runs the world one region at a time. Only the current region is simulated
 * (bounded cost, nothing else loaded); moving between regions builds a fresh
 * `Simulation` for the destination. Phaser-free, so whole journeys
 * (doorways, shrines, death, reloads) are tested headlessly.
 *
 * World rules applied on entry:
 * - doorway: health carries over; defeated ordinary enemies stay down.
 * - rest, fast travel, death, load: the player is restored and ordinary
 *   enemies return. Permanent progress (profile) is never touched.
 * - the profile's resume location follows every entry (except dev regions).
 */
export class GameWorld {
  sim!: Simulation;
  region!: RegionDefinition;
  location!: WorldLocation;
  readonly session = new WorldSession();
  /** Increases on every region load, so presentation knows to rebuild. */
  generation = 0;
  lastEnterReason: EnterReason = 'load';

  constructor(
    readonly profile: PlayerProfile,
    private readonly options: GameWorldOptions = {},
  ) {}

  /** Where a loaded profile resumes: its saved location, else the world start. */
  static resumeLocation(profile: PlayerProfile): WorldLocation {
    return isValidLocation(profile.world.location) ? profile.world.location : WORLD_START;
  }

  /** Where death takes the player: the last shrine, else the world start. */
  deathDestination(): WorldLocation {
    const r = this.profile.world.respawn;
    return isValidLocation(r) ? r : WORLD_START;
  }

  start(location: WorldLocation = GameWorld.resumeLocation(this.profile)): void {
    this.enter(location, 'load');
  }

  /** Load `location`'s region and put the player at its arrival point. */
  enter(location: WorldLocation, reason: EnterReason): void {
    const loc = hasRegion(location.region) ? location : WORLD_START;
    const def = getRegionDef(loc.region);
    const level = getRegion(loc.region);
    const anchor = level.anchors[loc.anchor];
    if (reason === 'exit') {
      this.session.carriedHealth = this.sim?.player.health.current ?? null;
    } else {
      this.session.resetForRest();
    }
    this.generation++;
    this.sim = new Simulation(level, {
      profile: this.profile,
      seed: ((this.options.seed ?? 7) + this.generation * 7919) >>> 0,
      devPickups: !!this.options.devPickups && !!def.dev,
      ...(anchor ? { arrival: { x: anchor.x, y: anchor.y, facing: anchor.facing } } : {}),
      arrivalHealth: this.session.carriedHealth,
      session: this.session,
      respawnMode: def.dev ? 'local' : 'checkpoint',
    });
    this.region = def;
    this.location = { region: loc.region, anchor: anchor ? loc.anchor : Object.keys(level.anchors)[0]! };
    this.lastEnterReason = reason;
    if (!def.dev) {
      this.profile.world.location = { ...this.location };
      this.profile.world.visited.add(loc.region);
      this.profile.touch();
      // Quests that wait for the player to reach this region (announced in the new region).
      this.sim.questEvent({ type: 'enterRegion', region: loc.region });
    }
  }

  /** Carry out the current simulation's travel request, if any. True when a new region was loaded. */
  completeTravel(): boolean {
    const request = this.sim.pendingTravel;
    if (!request) return false;
    const to = request.reason === 'death' ? this.deathDestination() : request.to!;
    this.enter(to, request.reason);
    return true;
  }
}
