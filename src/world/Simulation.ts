import { CombatSystem } from '../combat/CombatSystem';
import type { Combatant } from '../combat/types';
import { ENEMIES } from '../data/enemies';
import { Sentinel } from '../entities/enemy/Sentinel';
import { Player } from '../entities/player/Player';
import { createInputFrame, type InputProvider } from '../input/InputActions';
import { CollisionWorld } from '../physics/CollisionWorld';
import { seeded } from '../core/random';
import type { LevelData } from './Level';
import { SimEventQueue } from './SimEvents';

/**
 * The complete gameplay simulation for one level, independent of Phaser.
 * Scenes call `step` at a fixed rate and render whatever state results.
 */
export class Simulation {
  readonly world: CollisionWorld;
  readonly events = new SimEventQueue();
  readonly combat: CombatSystem;
  readonly player: Player;
  readonly enemies: Sentinel[] = [];
  readonly combatants: Combatant[] = [];
  /** Total fixed steps advanced, including hit-stop steps. */
  tick = 0;
  private readonly input = createInputFrame();
  /** Deterministic randomness for AI decisions; same seed, same fight. */
  readonly random: () => number;

  constructor(
    readonly level: LevelData,
    seed = 7,
  ) {
    this.random = seeded(seed);
    this.world = new CollisionWorld(level.solids, { x: 0, y: 0, w: level.widthPx, h: level.heightPx });
    this.combat = new CombatSystem(this.events);
    this.player = new Player(this.world, this.events, level.playerSpawn.x, level.playerSpawn.y);
    this.combatants.push(this.player);
    for (const spawn of level.enemySpawns) {
      const def = ENEMIES[spawn.enemyId];
      if (!def) throw new Error(`Unknown enemy: ${spawn.enemyId}`);
      const enemy = new Sentinel(def, this.world, this.events, this.player, spawn.x, spawn.y, this.random);
      this.enemies.push(enemy);
      this.combatants.push(enemy);
    }
    this.player.riposteTargets = this.enemies;
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
    inputs.sample(this.input);
    this.player.step(this.input, dt);
    for (const enemy of this.enemies) enemy.step(dt);
    this.separateBodies();
    this.combat.step(this.combatants);
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
