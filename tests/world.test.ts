import { describe, expect, it } from 'vitest';
import { PLAYER_COMBAT } from '../src/config/player';
import { getAttack } from '../src/data/weapons';
import type { ActiveHitbox } from '../src/combat/types';
import { TEST_CHAMBER } from '../src/data/levels/testChamber';
import { applySave, serializeProfile } from '../src/persistence/SaveGame';
import { PlayerProfile } from '../src/rpg/Profile';
import { GameWorld } from '../src/world/GameWorld';
import type { WorldObject } from '../src/world/Level';
import { allCheckpoints, getRegion, REGIONS, WORLD_START, type RegionDefinition } from '../src/world/regions';
import type { SimEvent } from '../src/world/SimEvents';
import { validateWorld } from '../src/world/validateWorld';
import { promptLabel, travelDestinations } from '../src/ui/worldModel';
import { DT, ScriptedInput } from './helpers';

const KILL = { damage: 99999, postureDamage: 0, knockbackX: 0, knockbackY: 0, hitstunFrames: 0 };
const HIT = { facing: 1, attack: getAttack('sword.light.1') } as ActiveHitbox;

function newWorld(profile = new PlayerProfile()) {
  const world = new GameWorld(profile);
  world.start();
  return { world, profile, input: new ScriptedInput(), events: [] as SimEvent[] };
}

type W = ReturnType<typeof newWorld>;

/** Step the world, carrying out travel requests as the scene does (minus the fade). */
function step(w: W, n = 1, each?: (i: number) => void): void {
  for (let i = 0; i < n; i++) {
    each?.(i);
    w.world.sim.step(DT, w.input);
    w.world.sim.events.drain((e) => w.events.push(e));
    if (w.world.sim.pendingTravel) w.world.completeTravel();
  }
}

function object(w: W, kind: WorldObject['kind'], id?: string): WorldObject {
  const o = w.world.sim.level.objects.find((x) => x.kind === kind && (!id || x.id === id));
  if (!o) throw new Error(`no ${kind} ${id ?? ''} in ${w.world.sim.level.id}`);
  return o;
}

/** Stand at an object (settle onto the ground first). */
function standAt(w: W, o: WorldObject): void {
  w.world.sim.player.body.teleport(o.x, o.y);
  w.world.sim.player.body.vx = 0;
  step(w, 3);
}

function interact(w: W): void {
  w.input.frame.interactPressed = true;
  step(w, 2);
}

/** Walk out of the region through an exit, by standing just inside its zone. */
function walkThrough(w: W, exitId: string): void {
  const exit = object(w, 'exit', exitId);
  const region = w.world.sim.level.id;
  step(w, 1); // a real player walks in from outside the zone, which arms the exits
  w.world.sim.player.body.teleport(exit.zone.x + exit.zone.w / 2, exit.y);
  step(w, 2);
  expect(w.world.sim.level.id).not.toBe(region);
}

function lightShrine(w: W, id: string): void {
  standAt(w, object(w, 'checkpoint', id));
  interact(w);
  expect(w.profile.world.isActive(id)).toBe(true);
}

function goToForest(w: W): void {
  if (w.world.sim.level.id !== 'forest-road') walkThrough(w, 'sanctuary.to-forest');
}

function killPlayer(w: W): void {
  const p = w.world.sim.player;
  p.health.current = 0;
  p.fsm.transition('dead');
  step(w, Math.ceil(PLAYER_COMBAT.respawnDelay / DT) + 3);
}

/** Save to JSON and load into a fresh profile and world (a page reload). */
function reload(w: W): W {
  const raw = JSON.stringify(serializeProfile(w.profile));
  const profile = new PlayerProfile();
  expect(applySave(raw, profile)).toBe('loaded');
  return newWorld(profile);
}

describe('World content', () => {
  it('the shipping world and the test chamber are valid', () => {
    expect(validateWorld()).toEqual([]);
    expect(validateWorld([...REGIONS, TEST_CHAMBER])).toEqual([]);
  });

  it('catches duplicate regions, broken exits, bad anchors, duplicate and invalid ids, unreachable objects', () => {
    const [a, b] = structuredClone(REGIONS) as RegionDefinition[];
    const exitA = a!.markers!.X as Extract<NonNullable<RegionDefinition['markers']>[string], { type: 'exit' }>;
    exitA.to = { region: 'forest-road', anchor: 'nowhere' };
    const brokenB = { ...b!, markers: { ...b!.markers, C: { type: 'checkpoint' as const, id: 'sanctuary.shrine', name: 'Copy' } } };
    let errors = validateWorld([a!, brokenB, a!]).join('\n');
    expect(errors).toMatch(/duplicate region id "sanctuary-outskirts"/);
    expect(errors).toMatch(/missing anchor "nowhere"/);
    expect(errors).toMatch(/persistent id "sanctuary.shrine" is also used/);

    const lost = { ...structuredClone(REGIONS[0]!), markers: { ...REGIONS[0]!.markers, X: { type: 'exit' as const, id: 'Bad Id', to: { region: 'atlantis', anchor: 'start' } } } };
    errors = validateWorld([lost, REGIONS[1]!]).join('\n');
    expect(errors).toMatch(/unknown region "atlantis"/);
    expect(errors).toMatch(/"Bad Id" is not a valid stable id/);

    // An anchor in mid-air, a cache on an unreachable pillar, an unknown marker.
    const rows = ['#..........#', '#..........#', '#......#T..#', '#......#...#', '#......#...#', '#......#...#', '#.P....#.Q.#', '############'];
    const isolated: RegionDefinition = { id: 'island', name: 'Island', tileSize: 16, rows, markers: { T: { type: 'cache', id: 'island.cache', reward: { gold: 1 } } } };
    errors = validateWorld([isolated], { region: 'island', anchor: 'start' }).join('\n');
    expect(errors).toMatch(/unknown marker "Q"/);
    expect(errors).toMatch(/"island.cache" can't be reached/);
  });

  it('every checkpoint is listed once for fast travel', () => {
    expect(allCheckpoints().map((c) => c.id)).toEqual(['sanctuary.shrine', 'forest.shrine']);
  });
});

describe('Regions and transitions', () => {
  it('a new game starts at the sanctuary approach', () => {
    const w = newWorld();
    expect(w.world.location).toEqual(WORLD_START);
    const start = getRegion('sanctuary-outskirts').anchors.start!;
    expect(w.world.sim.player.body.footX).toBe(start.x);
    expect(w.world.sim.enemies).toHaveLength(0);
  });

  it('doorways put the player at the destination anchor, and backtracking works repeatedly', () => {
    const w = newWorld();
    for (let lap = 0; lap < 3; lap++) {
      walkThrough(w, 'sanctuary.to-forest');
      const a = getRegion('forest-road').anchors['from-sanctuary']!;
      expect(w.world.sim.level.id).toBe('forest-road');
      expect([w.world.sim.player.body.footX, w.world.sim.player.body.footY]).toEqual([a.x, a.y]);
      // Standing still at the arrival point never bounces back.
      step(w, 90);
      expect(w.world.sim.level.id).toBe('forest-road');
      walkThrough(w, 'forest.to-sanctuary');
      const b = getRegion('sanctuary-outskirts').anchors['from-forest']!;
      expect(w.world.sim.level.id).toBe('sanctuary-outskirts');
      expect(w.world.sim.player.body.footX).toBe(b.x);
      expect(w.world.sim.player.facing).toBe(-1);
      step(w, 90);
      expect(w.world.sim.level.id).toBe('sanctuary-outskirts');
    }
    expect(w.profile.world.location).toEqual({ region: 'sanctuary-outskirts', anchor: 'from-forest' });
  });

  it('walking into an exit with real input leaves the region', () => {
    const w = newWorld();
    const exit = object(w, 'exit');
    w.world.sim.player.body.teleport(exit.x - 40, exit.y);
    w.input.frame.moveX = 1;
    step(w, 60);
    w.input.frame.moveX = 0;
    expect(w.world.sim.level.id).toBe('forest-road');
  });

  it('health carries through a doorway; only the current region is simulated', () => {
    const w = newWorld();
    w.world.sim.player.health.current = 37;
    walkThrough(w, 'sanctuary.to-forest');
    expect(w.world.sim.player.health.current).toBe(37);
    expect(w.world.sim.enemies.length).toBe(getRegion('forest-road').enemySpawns.length);
  });

  it('a pending transition stops the simulation and drops buffered input', () => {
    const w = newWorld();
    const sim = w.world.sim;
    sim.requestTravelOut({ reason: 'exit', to: { region: 'forest-road', anchor: 'from-sanctuary' } });
    const tick = sim.tick;
    sim.step(DT, w.input);
    expect(sim.tick).toBe(tick);
    w.input.frame.attackPressed = true;
    step(w, 1);
    // The new region's player starts neutral: nothing buffered carried over.
    expect(w.world.sim.player.attackBuffer).toBe(0);
    expect(w.world.sim.player.state).not.toBe('attack');
  });
});

describe('Shrines', () => {
  it('start unlit, activate once when used, and become the respawn point', () => {
    const w = newWorld();
    expect(w.profile.world.isActive('sanctuary.shrine')).toBe(false);
    lightShrine(w, 'sanctuary.shrine');
    interact(w);
    expect(w.events.filter((e) => e.type === 'checkpointActivated')).toHaveLength(1);
    expect(w.events.filter((e) => e.type === 'shrine').map((e) => (e as { firstTime: boolean }).firstTime)).toEqual([true, false]);
    expect([...w.profile.world.checkpoints]).toEqual(['sanctuary.shrine']);
    expect(w.profile.world.respawn).toEqual({ region: 'sanctuary-outskirts', anchor: 'sanctuary.shrine' });
  });

  it('the prompt names the action; only one object is used per press', () => {
    const w = newWorld();
    const shrine = object(w, 'checkpoint');
    standAt(w, shrine);
    expect(promptLabel(w.world.sim.focus, w.profile.world)).toBe('Light the shrine');
    interact(w);
    expect(promptLabel(w.world.sim.focus, w.profile.world)).toBe('Rest · Sanctuary Shrine');
    w.world.sim.player.body.teleport(shrine.x + 200, shrine.y);
    step(w, 3);
    expect(w.world.sim.focus).toBeNull();
  });

  it("interacting mid-attack does nothing", () => {
    const w = newWorld();
    standAt(w, object(w, 'checkpoint'));
    w.input.frame.attackPressed = true;
    step(w, 3);
    expect(w.world.sim.player.state).toBe('attack');
    interact(w);
    expect(w.profile.world.isActive('sanctuary.shrine')).toBe(false);
  });

  it('fast travel rejects undiscovered, unknown and away-from-shrine destinations', () => {
    const w = newWorld();
    expect(w.world.sim.requestFastTravel('sanctuary.shrine')).toBe('not-at-shrine');
    lightShrine(w, 'sanctuary.shrine');
    expect(w.world.sim.requestFastTravel('forest.shrine')).toBe('locked');
    expect(w.world.sim.requestFastTravel('atlantis.shrine')).toBe('unknown');
    expect(w.world.sim.pendingTravel).toBeNull();
    expect(travelDestinations(w.profile.world, 'sanctuary.shrine').map((d) => d.id)).toEqual(['sanctuary.shrine']);
  });

  it('fast travel moves between discovered shrines and keeps all progress', () => {
    const w = newWorld();
    lightShrine(w, 'sanctuary.shrine');
    goToForest(w);
    lightShrine(w, 'forest.shrine');
    w.profile.wallet.add({ experience: 11, gold: 22, weaponXp: 33 });
    const scythe = w.profile.inventory.add('mourning-crescent');
    expect(w.world.sim.requestEquip(scythe.uid)).toBe('equipped');
    const before = JSON.stringify(serializeProfile(w.profile, new Date(0)).inventory);
    expect(w.world.sim.requestFastTravel('sanctuary.shrine')).toBe('ok');
    step(w, 1);
    const shrine = getRegion('sanctuary-outskirts').anchors['sanctuary.shrine']!;
    expect(w.world.sim.level.id).toBe('sanctuary-outskirts');
    expect(w.world.sim.player.body.footX).toBe(shrine.x);
    expect(w.profile.world.respawn).toEqual({ region: 'sanctuary-outskirts', anchor: 'sanctuary.shrine' });
    expect([w.profile.wallet.experience, w.profile.wallet.gold, w.profile.wallet.weaponXp]).toEqual([11, 22, 33]);
    expect(JSON.stringify(serializeProfile(w.profile, new Date(0)).inventory)).toBe(before);
    expect(w.world.sim.player.equipment.weapon.id).toBe('mourning-crescent');
    // And back again.
    standAt(w, object(w, 'checkpoint'));
    expect(w.world.sim.requestFastTravel('forest.shrine')).toBe('ok');
    step(w, 1);
    expect(w.world.location).toEqual({ region: 'forest-road', anchor: 'forest.shrine' });
  });
});

describe('Enemies, resting and death', () => {
  function killFirstEnemy(w: W) {
    const e = w.world.sim.enemies[0]!;
    e.receiveHit(KILL, HIT);
    step(w, 2);
    return e.spawnId;
  }

  it('defeated ordinary enemies stay down across doorways, and return after resting', () => {
    const w = newWorld();
    lightShrine(w, 'sanctuary.shrine');
    goToForest(w);
    const total = w.world.sim.enemies.length;
    const id = killFirstEnemy(w);
    // No timer respawn in the world.
    step(w, 60 * 8);
    expect(w.world.sim.enemies.find((e) => e.spawnId === id)!.isDead).toBe(true);
    walkThrough(w, 'forest.to-sanctuary');
    walkThrough(w, 'sanctuary.to-forest');
    expect(w.world.sim.enemies.map((e) => e.spawnId)).not.toContain(id);
    expect(w.world.sim.enemies).toHaveLength(total - 1);
    lightShrine(w, 'forest.shrine');
    expect(w.world.sim.requestRest()).toBe('ok');
    step(w, 1);
    expect(w.world.sim.enemies).toHaveLength(total);
    expect(w.world.lastEnterReason).toBe('rest');
  });

  it('resting restores health and stamina but keeps currencies and items', () => {
    const w = newWorld();
    lightShrine(w, 'sanctuary.shrine');
    w.profile.wallet.add({ experience: 5, gold: 6, weaponXp: 7 });
    w.world.sim.player.health.current = 10;
    w.world.sim.player.stamina.current = 3;
    expect(w.world.sim.requestRest()).toBe('ok');
    step(w, 1);
    expect(w.world.sim.player.health.current).toBe(w.world.sim.player.health.max);
    expect(w.world.sim.player.stamina.ratio).toBe(1);
    expect([w.profile.wallet.experience, w.profile.wallet.gold, w.profile.wallet.weaponXp]).toEqual([5, 6, 7]);
  });

  it('death returns the player to the last activated shrine, in whichever region it is', () => {
    const w = newWorld();
    lightShrine(w, 'sanctuary.shrine');
    goToForest(w);
    w.profile.wallet.add({ experience: 1, gold: 2, weaponXp: 3 });
    killPlayer(w);
    expect(w.world.location).toEqual({ region: 'sanctuary-outskirts', anchor: 'sanctuary.shrine' });
    expect(w.world.sim.player.isDead).toBe(false);
    expect(w.world.sim.player.health.current).toBe(w.world.sim.player.health.max);
    expect(w.profile.wallet.gold).toBe(2);
    expect(w.world.lastEnterReason).toBe('death');
    // After lighting the forest shrine, death there brings the player back to it.
    goToForest(w);
    lightShrine(w, 'forest.shrine');
    killPlayer(w);
    expect(w.world.location).toEqual({ region: 'forest-road', anchor: 'forest.shrine' });
  });

  it('death before any shrine returns to the world start; death travel happens once', () => {
    const w = newWorld();
    goToForest(w);
    let travels = 0;
    killPlayer(w);
    travels = w.events.filter((e) => e.type === 'travel' && e.reason === 'death').length;
    expect(travels).toBe(1);
    expect(w.world.location).toEqual(WORLD_START);
  });

  it('the test chamber keeps its local respawns and timer enemies', async () => {
    const { registerDevRegion } = await import('../src/world/regions');
    registerDevRegion(TEST_CHAMBER);
    const profile = new PlayerProfile();
    const world = new GameWorld(profile);
    world.start({ region: 'test-chamber', anchor: 'start' });
    expect(world.sim.enemies.every((e) => e.respawnDelay !== null)).toBe(true);
    // Never saved as the player's location.
    expect(profile.world.location).toBeNull();
    const p = world.sim.player;
    p.health.current = 0;
    p.fsm.transition('dead');
    for (let i = 0; i < 200; i++) world.sim.step(DT, new ScriptedInput());
    expect(world.sim.pendingTravel).toBeNull();
    expect(world.sim.player.isDead).toBe(false);
  });
});

describe('One-time treasure', () => {
  function openCache(w: W) {
    goToForest(w);
    standAt(w, object(w, 'cache'));
    interact(w);
  }

  it('grants its reward exactly once and survives rest, travel, death and reload', () => {
    let w = newWorld();
    lightShrine(w, 'sanctuary.shrine');
    openCache(w);
    const dust = w.profile.inventory.count('grave-dust');
    const gold = w.profile.wallet.gold;
    expect(dust).toBe(3);
    expect(gold).toBe(60);
    expect(w.profile.world.hasFlag('forest.cache.canopy')).toBe(true);
    expect(w.events.filter((e) => e.type === 'cacheOpened')).toHaveLength(1);
    interact(w);
    // Death, the forest again, try again.
    killPlayer(w);
    openCache(w);
    // Rest and fast travel.
    lightShrine(w, 'forest.shrine');
    w.world.sim.requestRest();
    step(w, 1);
    openCache(w);
    // Reload the page.
    w = reload(w);
    expect(w.profile.world.hasFlag('forest.cache.canopy')).toBe(true);
    openCache(w);
    expect(w.profile.inventory.count('grave-dust')).toBe(dust);
    expect(w.profile.wallet.gold).toBe(gold);
    expect(promptLabel(w.world.sim.focus, w.profile.world)).toBeNull();
  });
});

describe('World progress across reloads', () => {
  it('reload resumes at the last location with shrines, flags and respawn intact', () => {
    let w = newWorld();
    lightShrine(w, 'sanctuary.shrine');
    goToForest(w);
    lightShrine(w, 'forest.shrine');
    w = reload(w);
    expect(w.world.location).toEqual({ region: 'forest-road', anchor: 'from-sanctuary' });
    expect([...w.profile.world.checkpoints].sort()).toEqual(['forest.shrine', 'sanctuary.shrine']);
    expect(w.profile.world.respawn).toEqual({ region: 'forest-road', anchor: 'forest.shrine' });
    // Fast travel still works after the reload.
    standAt(w, object(w, 'checkpoint'));
    expect(w.world.sim.requestFastTravel('sanctuary.shrine')).toBe('ok');
  });

  it('unknown or malformed world data is dropped, never trusted', () => {
    const profile = new PlayerProfile();
    const raw = JSON.stringify({
      ...serializeProfile(profile),
      world: {
        location: { region: 'atlantis', anchor: 'start' },
        respawn: { region: 'forest-road', anchor: 'forest.shrine' }, // not activated
        checkpoints: ['sanctuary.shrine', 'bogus.shrine', 42],
        flags: ['forest.cache.canopy', 'made.up', null],
      },
    });
    expect(applySave(raw, profile)).toBe('loaded');
    expect(profile.world.location).toBeNull();
    expect(profile.world.respawn).toBeNull();
    expect([...profile.world.checkpoints]).toEqual(['sanctuary.shrine']);
    expect([...profile.world.flags]).toEqual(['forest.cache.canopy']);
    expect(GameWorld.resumeLocation(profile)).toEqual(WORLD_START);
    // A dev-only region is never a resume location.
    const p2 = new PlayerProfile();
    applySave(JSON.stringify({ ...serializeProfile(p2), world: { location: { region: 'test-chamber', anchor: 'start' }, respawn: null, checkpoints: [], flags: [] } }), p2);
    expect(p2.world.location).toBeNull();
  });
});
