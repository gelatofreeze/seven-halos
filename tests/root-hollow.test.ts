import { describe, expect, it } from 'vitest';
import { applySave, serializeProfile } from '../src/persistence/SaveGame';
import { PlayerProfile } from '../src/rpg/Profile';
import { journalLore, journalQuests } from '../src/ui/journalModel';
import { promptLabel } from '../src/ui/worldModel';
import { startQuest } from '../src/rpg/Quests';
import { getRegion } from '../src/world/regions';
import { botAt, objectX, tileX, type Bot } from './bot';

/**
 * The Root Hollow and the Updraft Ring, end to end, with real movement: the
 * bot holds directions and presses jump like a player; the simulation's
 * physics decide where it gets. Nothing is teleported except where a test says
 * so (to set up a starting point).
 */

const cave = getRegion('root-hollow');
const CHAMBER_FLOOR = 13 * 16;
const LEDGE_TOP = 8 * 16;

function enterHollow(bot: Bot): void {
  expect(bot.walkTo(objectX(bot, 'forest.to-hollow') + 8)).toBe(true);
  expect(bot.sim.focus?.id).toBe('forest.to-hollow');
  expect(promptLabel(bot.sim.focus, bot.world.profile.world)).toBe('Enter the hollow');
  bot.interact();
  if (bot.sim.pendingTravel) bot.world.completeTravel();
  expect(bot.sim.level.id).toBe('root-hollow');
}

/** From the arrival point down to the ring, over the broken span. */
function toTheRing(bot: Bot): void {
  expect(bot.walkTo(objectX(bot, 'hollow.relic.ring'))).toBe(true);
  expect(bot.y).toBe(CHAMBER_FLOOR);
  // Focused until taken; a taken relic offers nothing.
  expect(bot.sim.focus?.id ?? null).toBe(bot.world.profile.world.hasFlag('hollow.relic.ring') ? null : 'hollow.relic.ring');
}

function equipRing(bot: Bot): void {
  const ring = bot.world.profile.inventory.all.find((i) => i.itemId === 'updraft-ring')!;
  expect(bot.sim.requestEquip(ring.uid, 'ring1')).toBe('equipped');
}

/** Every way a base jump can be tried at the cliff: from several run-ups, pressing at every moment. */
function triesTheCliff(bot: Bot, airJumpAfter?: number): boolean {
  const start = { x: bot.x, y: bot.y };
  for (const from of [40, 42, 44, 45]) {
    bot.sim.player.body.teleport(tileX(from), start.y);
    for (let k = 0; k < 10; k++) bot.step();
    bot.jumpTo(tileX(48), airJumpAfter === undefined ? {} : { airJumpAfter });
    if (bot.y <= LEDGE_TOP) return true;
  }
  return false;
}

describe('Root Hollow: getting there and back', () => {
  it('the hollow under the ancient tree leads down into the cave, and the passage west leads back up to it', () => {
    const bot = botAt({ region: 'forest-road', anchor: 'from-sanctuary' });
    enterHollow(bot);
    expect(bot.world.location).toEqual({ region: 'root-hollow', anchor: 'from-forest' });
    // Back out: walk west up the passage. No ring, no special movement.
    expect(bot.walkTo(-9999, { untilRegion: 'forest-road' })).toBe(true);
    expect(bot.world.location).toEqual({ region: 'forest-road', anchor: 'from-hollow' });
    // The return lands somewhere safe: standing, in the dip at the tree's foot, not falling.
    for (let i = 0; i < 20; i++) bot.step();
    expect(bot.sim.player.body.grounded).toBe(true);
    expect(bot.y).toBe(20 * 16);
    // And on along the road to the shrine, as before.
    expect(bot.walkTo(objectX(bot, 'forest.shrine'))).toBe(true);
    // In and out again (backtracking works repeatedly).
    expect(bot.walkTo(-9999, { maxSteps: 3000, untilRegion: 'sanctuary-outskirts' }) || bot.sim.level.id === 'forest-road').toBe(true);
  });

  it('no one falls in by accident: walking the road over the hollow does not enter it', () => {
    const bot = botAt({ region: 'forest-road', anchor: 'from-sanctuary' });
    expect(bot.walkTo(objectX(bot, 'forest.shrine'))).toBe(true);
    expect(bot.sim.level.id).toBe('forest-road');
  });

  it('the broken span is crossed with an ordinary jump; falling into the basin is safe and climbs out east', () => {
    const bot = botAt({ region: 'root-hollow', anchor: 'from-forest' });
    // Step off the lip into the gap on purpose.
    bot.walkTo(tileX(22) + 14, { jumpGaps: false });
    bot.walkTo(tileX(24), { jumpGaps: false });
    expect(bot.y).toBe(19 * 16);
    const hp = bot.sim.player.health.current;
    toTheRing(bot);
    expect(bot.sim.player.health.current).toBe(hp);
    // The basin's cache is there for whoever drops in.
    const basin = botAt({ region: 'root-hollow', anchor: 'from-forest' });
    basin.walkTo(tileX(22) + 14, { jumpGaps: false });
    basin.walkTo(tileX(24), { jumpGaps: false });
    expect(basin.y).toBe(19 * 16);
    expect(basin.walkTo(objectX(basin, 'hollow.cache.basin'))).toBe(true);
    expect(basin.sim.focus?.id).toBe('hollow.cache.basin');
  });

  it('the ring is never needed to leave: from the chamber and from the basin, the way out is base jumps', () => {
    for (const x of [objectX(botAt({ region: 'root-hollow', anchor: 'from-forest' }), 'hollow.relic.ring'), tileX(20)]) {
      const bot = botAt({ region: 'root-hollow', anchor: 'from-forest' });
      bot.sim.player.body.teleport(x, 4 * 16);
      for (let i = 0; i < 90; i++) bot.step();
      expect(bot.sim.player.extraAirJumps).toBe(0);
      expect(bot.walkTo(-9999, { untilRegion: 'forest-road', maxSteps: 4000 })).toBe(true);
    }
  });
});

describe('Root Hollow: the ring and the ledge it opens', () => {
  it('the ledge is out of reach of the base jump, whatever the run-up or timing', () => {
    const bot = botAt({ region: 'root-hollow', anchor: 'from-forest' });
    toTheRing(bot);
    expect(triesTheCliff(bot)).toBe(false);
    // Even pressing jump again at every moment of the rise (it does nothing without the ring).
    for (let t = 4; t < 40; t += 3) expect(triesTheCliff(bot, t)).toBe(false);
    expect(bot.world.profile.world.hasFlag('hollow.cache.ledge')).toBe(false);
    // Worn in the other ring slot or unequipped again: same story.
    const ringBot = botAt({ region: 'root-hollow', anchor: 'from-forest' });
    toTheRing(ringBot);
    ringBot.interact();
    equipRing(ringBot);
    expect(ringBot.sim.requestUnequip('ring1')).toBe('unequipped');
    expect(triesTheCliff(ringBot, 20)).toBe(false);
  });

  it('notice → find the ring → equip → double jump to the ledge → secret → leave', () => {
    const bot = botAt({ region: 'forest-road', anchor: 'from-sanctuary' });
    enterHollow(bot);
    toTheRing(bot);
    expect(promptLabel(bot.sim.focus, bot.world.profile.world)).toBe('Take · Updraft Ring');
    bot.interact();
    expect(bot.world.profile.inventory.count('updraft-ring')).toBe(1);
    expect(bot.world.profile.world.hasFlag('hollow.relic.ring')).toBe(true);
    // Taken: the stone is bare, nothing more to take.
    expect(bot.sim.focus).toBeNull();
    bot.interact();
    expect(bot.world.profile.inventory.count('updraft-ring')).toBe(1);
    equipRing(bot);
    expect(bot.sim.player.extraAirJumps).toBe(1);
    // The extra jump reaches the ledge reliably, across a wide band of timing.
    let reached = 0;
    for (const t of [14, 18, 22, 26, 30]) {
      const b = botAt({ region: 'root-hollow', anchor: 'from-forest' }, bot.world.profile);
      toTheRing(b);
      if (triesTheCliff(b, t)) reached++;
    }
    expect(reached).toBe(5);
    // Up, the secret: the inscription and the cache.
    expect(triesTheCliff(bot, 20)).toBe(true);
    expect(bot.walkTo(objectX(bot, 'lore.hollow-ledge'))).toBe(true);
    expect(bot.sim.focus?.id).toBe('lore.hollow-ledge');
    bot.interact();
    expect(bot.world.profile.lore.has('lore.hollow-ledge')).toBe(true);
    expect(bot.walkTo(objectX(bot, 'hollow.cache.ledge'))).toBe(true);
    const gold = bot.world.profile.wallet.gold;
    bot.interact();
    expect(bot.world.profile.wallet.gold).toBe(gold + 120);
    // Down and out.
    expect(bot.walkTo(-9999, { untilRegion: 'forest-road', maxSteps: 4000 })).toBe(true);
    expect(bot.world.location.anchor).toBe('from-hollow');
    // The ring keeps working outside the cave.
    expect(bot.sim.player.extraAirJumps).toBe(1);
  });

  it('the validator agrees: the ledge objects need the air jump and nothing else does', () => {
    expect(cave.objects.map((o) => o.id).sort()).toEqual(['hollow.cache.basin', 'hollow.cache.ledge', 'hollow.relic.ring', 'hollow.to-forest', 'lore.hollow-ledge']);
    expect(cave.enemySpawns.map((e) => e.enemyId)).toEqual(['hollow-sentinel']);
  });
});

describe('Narrative continuity', () => {
  it('the cave is no quest step: visiting it leaves the Oracle’s quest as it was; its inscription joins the journal', () => {
    const profile = new PlayerProfile();
    startQuest(profile, 'first-omen');
    const before = JSON.stringify(journalQuests(profile));
    const bot = botAt({ region: 'forest-road', anchor: 'from-sanctuary' }, profile);
    const afterForest = JSON.stringify(journalQuests(profile));
    enterHollow(bot);
    expect(JSON.stringify(journalQuests(profile))).toBe(afterForest);
    expect(afterForest).not.toBe(before); // the forest itself still advances it, as in 2C.2a
    profile.lore.add('lore.hollow-ledge');
    expect(journalLore(profile).map((l) => l.id)).toContain('lore.hollow-ledge');
  });
});

describe('The ring persists', () => {
  function reload(bot: Bot, profile: PlayerProfile): { bot: Bot; profile: PlayerProfile } {
    const raw = JSON.stringify(serializeProfile(profile));
    const fresh = new PlayerProfile();
    expect(applySave(raw, fresh)).toBe('loaded');
    return { bot: botAt(bot.world.location, fresh), profile: fresh };
  }

  it('obtain, equip, travel, rest, die and reload: still owned once, still worn, still working', () => {
    const profile = new PlayerProfile();
    let bot = botAt({ region: 'root-hollow', anchor: 'from-forest' }, profile);
    toTheRing(bot);
    bot.interact();
    equipRing(bot);
    // Travel: up to the forest and on to its shrine; light it and rest.
    expect(bot.walkTo(-9999, { untilRegion: 'forest-road', maxSteps: 4000 })).toBe(true);
    expect(bot.walkTo(objectX(bot, 'forest.shrine'))).toBe(true);
    bot.interact();
    expect(bot.sim.requestRest()).toBe('ok');
    bot.step();
    expect(bot.sim.player.extraAirJumps).toBe(1);
    // Death.
    bot.sim.player.health.current = 0;
    bot.sim.player.fsm.transition('dead');
    for (let i = 0; i < 200 && bot.world.lastEnterReason !== 'death'; i++) bot.step();
    expect(bot.world.lastEnterReason).toBe('death');
    expect(bot.sim.player.extraAirJumps).toBe(1);
    // Reload the page.
    const r = reload(bot, bot.world.profile);
    bot = r.bot;
    expect(r.profile.inventory.count('updraft-ring')).toBe(1);
    expect(r.profile.loadout.get('ring1')).toBe(r.profile.inventory.all.find((i) => i.itemId === 'updraft-ring')!.uid);
    expect(bot.sim.player.extraAirJumps).toBe(1);
    expect(r.profile.world.hasFlag('hollow.relic.ring')).toBe(true);
    // Back at the relic: nothing to take twice.
    const again = botAt({ region: 'root-hollow', anchor: 'from-forest' }, r.profile);
    toTheRing(again);
    expect(again.sim.focus).toBeNull();
    again.interact();
    expect(r.profile.inventory.count('updraft-ring')).toBe(1);
  });

  it('an older save (before the cave existed) loads unchanged: the forest cache, shrines and gear intact', () => {
    const old = new PlayerProfile();
    old.world.activate('forest.shrine');
    old.world.setFlag('forest.cache.canopy');
    old.inventory.add('grave-dust', 3);
    old.lore.add('lore.sealed-gate');
    const raw = JSON.stringify(serializeProfile(old));
    const p = new PlayerProfile();
    expect(applySave(raw, p)).toBe('loaded');
    expect(p.world.hasFlag('forest.cache.canopy')).toBe(true);
    expect(p.world.isActive('forest.shrine')).toBe(true);
    expect(p.inventory.count('grave-dust')).toBe(3);
    expect(p.lore.has('lore.sealed-gate')).toBe(true);
    expect(p.inventory.count('updraft-ring')).toBe(0);
    expect(p.world.hasFlag('hollow.relic.ring')).toBe(false);
  });
});
