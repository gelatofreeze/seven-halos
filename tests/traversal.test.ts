import { describe, expect, it } from 'vitest';
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
class Bot {
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

  private jump(): void {
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

  /** Jump (from standing) while steering toward `targetX`, then settle. */
  jumpTo(targetX: number): void {
    this.jump();
    for (let i = 0; i < 120; i++) {
      const dx = targetX - this.x;
      this.input.frame.moveX = Math.abs(dx) < 3 ? 0 : dx > 0 ? 1 : -1;
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

function botAt(location?: WorldLocation, profile = new PlayerProfile()) {
  const world = new GameWorld(profile);
  world.start(location);
  return new Bot(world);
}

const tileX = (col: number) => col * 16 + 8;

function objectX(bot: Bot, id: string): number {
  return bot.sim.level.objects.find((o) => o.id === id)!.x;
}

describe('Traversal (real movement and collision)', () => {
  it('sanctuary: start → up the steps → shrine, then out to the forest', () => {
    const bot = botAt();
    const shrineX = objectX(bot, 'sanctuary.shrine');
    expect(bot.walkTo(shrineX)).toBe(true);
    expect(bot.sim.focus?.id).toBe('sanctuary.shrine');
    bot.interact();
    expect(bot.world.profile.world.isActive('sanctuary.shrine')).toBe(true);
    bot.sim.events.items.length = 0;
    // Through the east doorway, down the steps, along the road and out.
    expect(bot.walkTo(99999, { untilRegion: 'forest-road' })).toBe(true);
    expect(bot.world.location.anchor).toBe('from-sanctuary');
  });

  it('forest: entrance → over the broken bridge → shrine, without climbing anything optional', () => {
    const bot = botAt({ region: 'forest-road', anchor: 'from-sanctuary' });
    const shrineX = objectX(bot, 'forest.shrine');
    let lowest = 0;
    let highest = Infinity;
    const ok = bot.walkTo(shrineX, {
      onStep: () => {
        lowest = Math.max(lowest, bot.y);
        highest = Math.min(highest, bot.y);
      },
    });
    expect(ok).toBe(true);
    // It stayed on the main path: never fell into the ravine, never went up the tree.
    expect(lowest).toBeLessThanOrEqual(19 * 16);
    expect(highest).toBeGreaterThan(14 * 16);
    expect(bot.world.profile.world.hasFlag('forest.cache.canopy')).toBe(false);
    bot.interact();
    expect(bot.world.profile.world.isActive('forest.shrine')).toBe(true);
  });

  it('forest: the way back, shrine → bridge → sanctuary', () => {
    const profile = new PlayerProfile();
    profile.world.activate('forest.shrine');
    const bot = botAt({ region: 'forest-road', anchor: 'forest.shrine' }, profile);
    expect(bot.walkTo(-99999, { untilRegion: 'sanctuary-outskirts' })).toBe(true);
    expect(bot.world.location.anchor).toBe('from-forest');
    // And the sanctuary road back west to the hall.
    expect(bot.walkTo(objectX(bot, 'sanctuary.shrine'))).toBe(true);
  });

  it('falling into the ravine is safe: the player climbs out on the east side', () => {
    const bot = botAt({ region: 'forest-road', anchor: 'from-sanctuary' });
    // Walk off the west bridgehead without jumping.
    bot.walkTo(tileX(38), { jumpGaps: false });
    expect(bot.y).toBeGreaterThan(21 * 16);
    const hp = bot.sim.player.health.current;
    expect(bot.walkTo(tileX(52))).toBe(true);
    expect(bot.y).toBe(19 * 16);
    expect(bot.sim.player.health.current).toBe(hp);
  });

  it('the optional canopy climb reaches the cache using the base jump only', () => {
    const bot = botAt({ region: 'forest-road', anchor: 'from-sanctuary' });
    bot.walkTo(tileX(51));
    bot.jumpTo(tileX(54));
    expect(bot.y).toBe(16 * 16);
    bot.jumpTo(tileX(58));
    expect(bot.y).toBe(13 * 16);
    bot.jumpTo(tileX(54));
    expect(bot.y).toBe(10 * 16);
    expect(bot.sim.focus?.id).toBe('forest.cache.canopy');
    bot.interact();
    expect(bot.world.profile.world.hasFlag('forest.cache.canopy')).toBe(true);
  });

  it('the road east of the shrine climbs to the sealed gate, which stays shut', () => {
    const profile = new PlayerProfile();
    profile.world.activate('forest.shrine');
    const bot = botAt({ region: 'forest-road', anchor: 'forest.shrine' }, profile);
    bot.walkTo(99999, { maxSteps: 900 });
    for (let i = 0; i < 60; i++) bot.step();
    // Stopped by the gate wall, standing on the top of the stairs.
    expect(bot.y).toBe(15 * 16);
    expect(bot.x).toBeLessThan(134 * 16);
    expect(bot.sim.level.id).toBe('forest-road');
  });
});
