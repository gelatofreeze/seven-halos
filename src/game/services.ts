import type Phaser from 'phaser';
import type { DebugFlags } from '../config/debug';
import type { InputHub } from '../input/InputHub';
import type { SaveManager } from '../persistence/SaveGame';
import type { PlayerProfile } from '../rpg/Profile';
import type { Toasts } from '../ui/Toasts';
import type { GameWorld } from '../world/GameWorld';
import type { Viewport } from './Viewport';

/** Long-lived, scene-independent services shared through the game registry. */
export interface GameServices {
  input: InputHub;
  debug: DebugFlags;
  viewport: Viewport | null;
  /** Called by the active gameplay scene to register its debug toggle. */
  onDebugToggle: (() => void) | null;
  /** Registered by the active gameplay scene: open/close the inventory. */
  onMenuToggle: (() => void) | null;
  /** Release all held inputs (touch + keyboard), e.g. when a menu opens. */
  releaseInputs: () => void;
  /** The persistent player profile and its save manager live for the whole session. */
  profile: PlayerProfile;
  save: SaveManager;
  /** The world: current region, its simulation, and the rules for moving between regions. */
  world: GameWorld;
  /** Notifications outlive region transitions (a shrine message can show across the fade). */
  toasts: Toasts;
}

const KEY = 'services';

export function setServices(game: Phaser.Game, services: GameServices): void {
  game.registry.set(KEY, services);
}

export function getServices(scene: Phaser.Scene): GameServices {
  const services = scene.registry.get(KEY) as GameServices | undefined;
  if (!services) throw new Error('Game services not registered');
  return services;
}
