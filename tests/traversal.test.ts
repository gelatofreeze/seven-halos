import { describe, expect, it } from 'vitest';
import { PlayerProfile } from '../src/rpg/Profile';
import { botAt, objectX, tileX } from './bot';

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
    let highestStand = Infinity;
    const ok = bot.walkTo(shrineX, {
      onStep: () => {
        lowest = Math.max(lowest, bot.y);
        if (bot.sim.player.body.grounded) highestStand = Math.min(highestStand, bot.y);
      },
    });
    expect(ok).toBe(true);
    // It stayed on the main path: never fell into the ravine (the dip under the tree is 1 tile),
    // never stood on the tree's limbs (the low one is at y 224), never went down into the hollow.
    expect(lowest).toBeLessThanOrEqual(20 * 16);
    expect(highestStand).toBeGreaterThan(14 * 16);
    expect(bot.sim.level.id).toBe('forest-road');
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

  it('falling into the ravine is safe: the rubble climbs back out, from either gap', () => {
    for (const gap of [36, 42]) {
      const bot = botAt({ region: 'forest-road', anchor: 'from-sanctuary' });
      if (gap === 42) {
        // Cross to the pier first, then step off its east side.
        bot.walkTo(tileX(40));
        expect(bot.y).toBe(19 * 16);
      }
      // Just past the edge, so the body is clear of it, without jumping.
      bot.walkTo(gap * 16 + 12, { jumpGaps: false });
      expect(bot.y).toBeGreaterThan(21 * 16);
      const hp = bot.sim.player.health.current;
      expect(bot.walkTo(tileX(52))).toBe(true);
      expect(bot.y).toBe(19 * 16);
      expect(bot.sim.player.health.current).toBe(hp);
    }
  });

  it('the optional tree climb reaches the cache using the base jump only: roots, low limb, high limb', () => {
    const bot = botAt({ region: 'forest-road', anchor: 'from-sanctuary' });
    bot.walkTo(tileX(54));
    expect(bot.y).toBe(17 * 16);
    bot.jumpTo(tileX(52));
    expect(bot.y).toBe(14 * 16);
    // Along the low limb to the trunk, then up to the high one.
    bot.walkTo(tileX(54));
    bot.jumpTo(tileX(58));
    expect(bot.y).toBe(11 * 16);
    bot.walkTo(objectX(bot, 'forest.cache.canopy'));
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
