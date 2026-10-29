import type { ActiveHitbox } from '../src/combat/types';
import { getAttack } from '../src/data/weapons';
import { PlayerProfile } from '../src/rpg/Profile';
import { GameWorld } from '../src/world/GameWorld';
import type { WorldLocation } from '../src/world/regions';
import { DT, ScriptedInput } from './helpers';

/**
 * Real traversal: a bot holds a direction and jumps the way a player would
 * (at walls and at the edge of a gap). The simulation's own movement and
 * collision decide whether it gets through; nothing is teleported. Enemies
 * are removed: these tests are about the geometry.
 */
export class Bot {
  readonly input = new ScriptedInput();
  private jumpHold = 0;
  constructor(readonly world: GameWorld) {
    this.clearEnemies();
  }

  get sim() {
    return this.world.sim;
  }
  get x() {
    return this.sim.player.body.footX;
  }
  get y() {
    return this.sim.player.body.footY;
  }

  private clearEnemies(): void {
    const hit = { facing: 1, attack: getAttack('sword.light.1') } as ActiveHitbox;
    for (const e of this.sim.enemies) e.receiveHit({ damage: 99999, postureDamage: 0, knockbackX: 0, knockbackY: 0, hitstunFrames: 0 }, hit);
  }

  step(): void {
    const region = this.sim.level.id;
    if (this.jumpHold > 0) {
      this.input.frame.jumpHeld = true;
      this.jumpHold--;
    } else this.input.frame.jumpHeld = false;
    this.sim.step(DT, this.input);
    if (this.sim.pendingTravel) {
      this.world.completeTravel();
      if (this.sim.level.id !== region) this.clearEnemies();
    }
  }

  jump(): void {
    this.input.frame.jumpPressed = true;
    this.jumpHold = 22;
  }

  /** Is there ground (solid or a platform) just ahead of the feet in `dir`? */
  private groundAhead(dir: number): boolean {
    const b = this.sim.player.body;
    const ahead = dir > 0 ? b.x + b.w + 6 : b.x - 6;
    return this.sim.world.isStandableAt(ahead, b.footY + 2);
  }

  /**
   * Walk toward `targetX` until within 6 px (or the region changes when
   * `untilRegion` is set). Jumps when blocked by a wall and at gap edges
   * (unless `jumpGaps` is false, e.g. to drop into the ravine on purpose).
   */
  walkTo(targetX: number, opts: { untilRegion?: string; jumpGaps?: boolean; maxSteps?: number; onStep?: () => void } = {}): boolean {
    const jumpGaps = opts.jumpGaps ?? true;
    let stuck = 0;
    for (let i = 0; i < (opts.maxSteps ?? 1800); i++) {
      if (opts.untilRegion && this.sim.level.id === opts.untilRegion) {
        this.input.frame.moveX = 0;
        return true;
      }
      const dx = targetX - this.x;
      if (!opts.untilRegion && Math.abs(dx) < 6 && this.sim.player.body.grounded) {
        this.input.frame.moveX = 0;
        // Arrived: a jump queued on the last step must not fire while settling.
        this.input.frame.jumpPressed = false;
        this.jumpHold = 0;
        for (let k = 0; k < 10; k++) this.step();
        return true;
      }
      const dir = dx > 0 ? 1 : -1;
      this.input.frame.moveX = dir;
      const before = this.x;
      this.step();
      opts.onStep?.();
      const grounded = this.sim.player.body.grounded;
      stuck = grounded && Math.abs(this.x - before) < 0.2 ? stuck + 1 : 0;
      if (grounded && this.jumpHold === 0 && (stuck > 2 || (jumpGaps && !this.groundAhead(dir)))) this.jump();
    }
    this.input.frame.moveX = 0;
    return false;
  }

  /**
   * Jump (from standing) while steering toward `targetX`, then settle. With
   * `airJumpAfter`, press jump again that many steps after takeoff (the
   * double jump; it does nothing without equipment that grants one).
   */
  jumpTo(targetX: number, opts: { airJumpAfter?: number } = {}): void {
    this.jump();
    for (let i = 0; i < 160; i++) {
      const dx = targetX - this.x;
      this.input.frame.moveX = Math.abs(dx) < 3 ? 0 : dx > 0 ? 1 : -1;
      if (i === opts.airJumpAfter) this.jump();
      this.step();
      if (i > 5 && this.sim.player.body.grounded) break;
    }
    this.input.frame.moveX = 0;
    for (let k = 0; k < 8; k++) this.step();
  }

  interact(): void {
    this.input.frame.interactPressed = true;
    this.step();
    this.step();
  }
}

export function botAt(location?: WorldLocation, profile = new PlayerProfile()) {
  const world = new GameWorld(profile);
  world.start(location);
  return new Bot(world);
}

export const tileX = (col: number) => col * 16 + 8;

export function objectX(bot: Bot, id: string): number {
  return bot.sim.level.objects.find((o) => o.id === id)!.x;
}

