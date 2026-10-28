import type Phaser from 'phaser';
import type { DebugFlags } from '../config/debug';
import type { InputHub } from '../input/InputHub';
import type { Viewport } from './Viewport';

/** Long-lived, scene-independent services shared through the game registry. */
export interface GameServices {
  input: InputHub;
  debug: DebugFlags;
  viewport: Viewport | null;
  /** Called by the active gameplay scene to register its debug toggle. */
  onDebugToggle: (() => void) | null;
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
