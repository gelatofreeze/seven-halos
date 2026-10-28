import type { WorldLocation } from './regions';

/**
 * Permanent world progress, saved with the profile: where to resume, where to
 * respawn, which shrines are active and which one-time objects are used up.
 * Only stable ids are stored. Temporary state (enemies defeated since the
 * last rest, pickups lying around) lives in `WorldSession` and is not saved.
 */
export class WorldProgress {
  /** Where the game resumes on load: the last region entry or shrine. null = the world start. */
  location: WorldLocation | null = null;
  /** The shrine the player last activated or rested at. null = the world start. */
  respawn: WorldLocation | null = null;
  readonly checkpoints = new Set<string>();
  /** Permanent object flags, e.g. an opened treasure cache's id. */
  readonly flags = new Set<string>();

  /** Activate a checkpoint; true only the first time. */
  activate(id: string): boolean {
    if (this.checkpoints.has(id)) return false;
    this.checkpoints.add(id);
    return true;
  }

  isActive(id: string): boolean {
    return this.checkpoints.has(id);
  }

  /** Set a permanent flag; true only the first time. */
  setFlag(id: string): boolean {
    if (this.flags.has(id)) return false;
    this.flags.add(id);
    return true;
  }

  hasFlag(id: string): boolean {
    return this.flags.has(id);
  }

  clear(): void {
    this.location = null;
    this.respawn = null;
    this.checkpoints.clear();
    this.flags.clear();
  }
}

/**
 * Per-session world state that is deliberately *not* saved: ordinary enemies
 * defeated since the last rest (they stay down across room transitions until
 * the player rests or dies) and the player's health between rooms.
 */
export class WorldSession {
  readonly defeated = new Set<string>();
  /** Health carried through a doorway; null = arrive at full health. */
  carriedHealth: number | null = null;

  /** Rest or death: the world's ordinary enemies return and the player is restored. */
  resetForRest(): void {
    this.defeated.clear();
    this.carriedHealth = null;
  }
}
