import { describe, expect, it } from 'vitest';
import { PLAYER_MOVEMENT } from '../src/config/movement';
import { ITEMS } from '../src/data/items';
import { PlayerProfile } from '../src/rpg/Profile';
import { equippedEffects } from '../src/rpg/PassiveEffects';
import { parseLevel } from '../src/world/Level';
import { Simulation } from '../src/world/Simulation';
import type { SimEvent } from '../src/world/SimEvents';
import { DT, flatSim, ScriptedInput } from './helpers';

/**
 * The equipment-granted air jump, driven through the real simulation: input
 * frames in, fixed steps, real gravity and collision. The ring is equipped the
 * way the menu does it (`requestEquip`), never by poking the player.
 */

function setup(options: { ring?: boolean; sim?: Simulation } = {}) {
  const sim = options.sim ?? flatSim();
  const input = new ScriptedInput();
  const events: SimEvent[] = [];
  const ring = sim.profile.inventory.add('updraft-ring');
  if (options.ring) expect(sim.requestEquip(ring.uid, 'ring1')).toBe('equipped');
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      sim.step(DT, input);
      sim.events.drain((e) => events.push(e));
    }
  };
  step(5);
  const press = () => {
    input.frame.jumpPressed = true;
    input.frame.jumpHeld = true;
  };
  const p = sim.player;
  return { sim, input, events, ring, step, press, p, floorY: p.body.footY };
}

type S = ReturnType<typeof setup>;

/** Step until the player stands again, tracking the highest point the feet reached. */
function untilLanded(s: S, max = 240): number {
  let peak = s.p.body.footY;
  for (let i = 0; i < max; i++) {
    s.step();
    peak = Math.min(peak, s.p.body.footY);
    if (s.p.body.grounded && i > 2) break;
  }
  s.input.frame.jumpHeld = false;
  return peak;
}

/** Step until the rise stops (vy ≥ 0), holding jump. */
function untilApex(s: S): void {
  for (let i = 0; i < 120 && !(s.p.body.vy >= 0 && !s.p.body.grounded); i++) s.step();
}

const airJumps = (s: S) => s.events.filter((e) => e.type === 'airJump').length;

describe('Air jump: without the ring, nothing changes', () => {
  it('a press in midair does not jump again; the base jump still reaches its height', () => {
    const s = setup();
    s.press();
    s.step(2);
    untilApex(s);
    const vy = s.p.body.vy;
    s.press();
    s.step();
    expect(s.p.body.vy).toBeGreaterThanOrEqual(vy);
    const peak = untilLanded(s);
    expect(airJumps(s)).toBe(0);
    expect(s.floorY - peak).toBeGreaterThan(PLAYER_MOVEMENT.jump.height - 2);
    expect(s.floorY - peak).toBeLessThan(PLAYER_MOVEMENT.jump.height + 3);
  });

  it('the ring in the backpack (not worn) grants nothing', () => {
    const s = setup();
    expect(s.sim.profile.inventory.count('updraft-ring')).toBe(1);
    expect(s.sim.effects.extraAirJumps).toBe(0);
    expect(s.p.extraAirJumps).toBe(0);
  });
});

describe('Air jump: with the ring', () => {
  it('a single press is exactly the normal jump: the ring never raises the base jump', () => {
    const plain = setup();
    plain.press();
    const plainPeak = untilLanded(plain);
    const ringed = setup({ ring: true });
    ringed.press();
    const ringPeak = untilLanded(ringed);
    expect(ringed.floorY - ringPeak).toBeCloseTo(plain.floorY - plainPeak, 5);
    expect(airJumps(ringed)).toBe(0);
  });

  it('exactly one air jump per airborne spell: a clear rise, then further presses do nothing', () => {
    const s = setup({ ring: true });
    s.press();
    s.step(2);
    untilApex(s);
    const apex = s.p.body.footY;
    s.press();
    s.step();
    expect(airJumps(s)).toBe(1);
    expect(s.p.body.vy).toBeLessThan(-200);
    expect(s.p.state).toBe('jump');
    // Holding through the second rise.
    let peak = s.p.body.footY;
    for (let i = 0; i < 60 && s.p.body.vy < 0; i++) {
      s.step();
      peak = Math.min(peak, s.p.body.footY);
    }
    expect(apex - peak).toBeGreaterThan(PLAYER_MOVEMENT.airJump.height - 3);
    expect(apex - peak).toBeLessThan(PLAYER_MOVEMENT.airJump.height + 3);
    // A third press: nothing.
    s.press();
    s.step();
    expect(airJumps(s)).toBe(1);
    expect(s.p.body.vy).toBeGreaterThan(-50);
    untilLanded(s);
    expect(s.p.airJumpsLeft).toBe(1);
  });

  it('it resets on landing, every time', () => {
    const s = setup({ ring: true });
    for (let round = 1; round <= 3; round++) {
      s.press();
      s.step(2);
      untilApex(s);
      s.press();
      s.step();
      expect(s.p.airJumpsLeft).toBe(0);
      untilLanded(s);
      s.step(10);
      expect(airJumps(s)).toBe(round);
      expect(s.p.airJumpsLeft).toBe(1);
    }
  });

  it('horizontal control is the same air control before and after it', () => {
    const s = setup({ ring: true });
    s.input.frame.moveX = 1;
    s.press();
    s.step(12);
    const vxBefore = s.p.body.vx;
    s.press();
    s.step();
    expect(s.p.body.vx).toBeCloseTo(vxBefore, 5);
    s.input.frame.moveX = -1;
    s.step(10);
    // Steering back is ordinary air turn acceleration.
    expect(s.p.body.vx).toBeLessThan(0);
  });

  it('costs stamina like a jump and is never blocked by an empty meter', () => {
    const s = setup({ ring: true });
    s.press();
    s.step(2);
    untilApex(s);
    s.p.stamina.current = 0;
    s.press();
    s.step();
    expect(airJumps(s)).toBe(1);
    expect(s.p.stamina.current).toBe(0);
    const t = setup({ ring: true });
    t.press();
    t.step(2);
    untilApex(t);
    const before = t.p.stamina.current;
    t.press();
    t.step();
    expect(before - t.p.stamina.current).toBeCloseTo(PLAYER_MOVEMENT.airJump.staminaCost, 0);
  });

  it('with no air jump left, a press just before landing is still buffered into a ground jump', () => {
    const s = setup({ ring: true });
    s.press();
    s.step(2);
    untilApex(s);
    s.press();
    s.step();
    s.input.frame.jumpHeld = false;
    // Fall until just above the floor, press, and see it fire on landing.
    for (let i = 0; i < 200 && s.floorY - s.p.body.footY > 6; i++) s.step();
    expect(s.p.body.vy).toBeGreaterThan(0);
    s.press();
    s.step(12);
    expect(s.events.filter((e) => e.type === 'jump')).toHaveLength(2);
    expect(airJumps(s)).toBe(1);
  });
});

describe('Air jump: walking off a ledge (documented behaviour)', () => {
  // A raised floor (columns 0-10, top at row 8) with the main floor four tiles below (row 12).
  const open = '#' + '.'.repeat(28) + '#';
  const ledge = '#'.repeat(11) + '.'.repeat(18) + '#';
  const rows = ['#'.repeat(30), ...Array<string>(6).fill(open), '#....P' + '.'.repeat(23) + '#', ledge, ledge, ledge, ledge, '#'.repeat(30), '#'.repeat(30)];
  const level = () => parseLevel({ id: 'ledge', name: 'ledge', tileSize: 16, rows });

  function offTheLedge(ring: boolean) {
    const s = setup({ ring, sim: new Simulation(level()) });
    s.input.frame.moveX = 1;
    for (let i = 0; i < 200 && s.p.body.grounded; i++) s.step();
    return s;
  }

  it('a jump within coyote time is the ordinary ground jump, and the air jump is still there after it', () => {
    const s = offTheLedge(true);
    expect(s.p.coyoteTimer).toBeGreaterThan(0);
    s.press();
    s.step();
    expect(s.events.filter((e) => e.type === 'jump')).toHaveLength(1);
    expect(airJumps(s)).toBe(0);
    expect(s.p.airJumpsLeft).toBe(1);
    untilApex(s);
    s.press();
    s.step();
    expect(airJumps(s)).toBe(1);
  });

  it('after coyote time, falling off a ledge keeps the air jump: the press uses it', () => {
    const s = offTheLedge(true);
    s.step(Math.ceil(PLAYER_MOVEMENT.jump.coyoteTime / DT) + 2);
    expect(s.p.coyoteTimer).toBe(0);
    s.press();
    s.step();
    expect(airJumps(s)).toBe(1);
    expect(s.events.filter((e) => e.type === 'jump')).toHaveLength(0);
    expect(s.p.body.vy).toBeLessThan(-200);
  });

  it('without the ring, a late press off a ledge does nothing', () => {
    const s = offTheLedge(false);
    s.step(Math.ceil(PLAYER_MOVEMENT.jump.coyoteTime / DT) + 2);
    s.press();
    s.step();
    expect(airJumps(s)).toBe(0);
    expect(s.p.body.vy).toBeGreaterThan(0);
  });
});

describe('Air jump: changing rings in midair', () => {
  function airborne(ring: boolean) {
    const s = setup({ ring });
    s.press();
    s.step(4);
    expect(s.p.body.grounded).toBe(false);
    return s;
  }

  it('equipping it in midair grants nothing until the next landing', () => {
    const s = airborne(false);
    expect(s.sim.requestEquip(s.ring.uid, 'ring2')).toBe('equipped');
    expect(s.p.extraAirJumps).toBe(1);
    expect(s.p.airJumpsLeft).toBe(0);
    untilApex(s);
    s.press();
    s.step();
    expect(airJumps(s)).toBe(0);
    untilLanded(s);
    s.step(5);
    expect(s.p.airJumpsLeft).toBe(1);
    s.press();
    s.step(2);
    untilApex(s);
    s.press();
    s.step();
    expect(airJumps(s)).toBe(1);
  });

  it('removing it in midair takes the unused air jump away at once', () => {
    const s = airborne(true);
    expect(s.p.airJumpsLeft).toBe(1);
    expect(s.sim.requestUnequip('ring1')).toBe('unequipped');
    expect(s.p.airJumpsLeft).toBe(0);
    untilApex(s);
    s.press();
    s.step();
    expect(airJumps(s)).toBe(0);
  });

  it('taking it off and putting it back on in midair never refills a jump, used or removed', () => {
    // Used, then swapped.
    const s = airborne(true);
    untilApex(s);
    s.press();
    s.step();
    expect(airJumps(s)).toBe(1);
    s.sim.requestUnequip('ring1');
    s.sim.requestEquip(s.ring.uid, 'ring1');
    s.sim.requestEquip(s.ring.uid, 'ring2');
    expect(s.p.airJumpsLeft).toBe(0);
    s.press();
    s.step();
    expect(airJumps(s)).toBe(1);
    // Removed unused, then put back.
    const t = airborne(true);
    t.sim.requestUnequip('ring1');
    t.sim.requestEquip(t.ring.uid, 'ring2');
    expect(t.p.airJumpsLeft).toBe(0);
    untilApex(t);
    t.press();
    t.step();
    expect(airJumps(t)).toBe(0);
    // Moving it between ring slots midair keeps an unused jump (no loss, no gain).
    const u = airborne(true);
    u.sim.requestEquip(u.ring.uid, 'ring2');
    expect(u.sim.profile.loadout.get('ring1')).toBe(0);
    expect(u.p.airJumpsLeft).toBe(1);
    // And nothing is corrupted: the player lands normally and recovers the jump.
    untilLanded(u);
    u.step(5);
    expect(u.p.state === 'idle' || u.p.state === 'run' || u.p.state === 'land').toBe(true);
    expect(u.p.airJumpsLeft).toBe(1);
  });

  it("rings can't be changed mid-action, like weapons", () => {
    const s = setup();
    s.input.frame.attackPressed = true;
    s.step(2);
    expect(s.p.state).toBe('attack');
    expect(s.sim.requestEquip(s.ring.uid, 'ring1')).toBe('busy');
    expect(s.p.extraAirJumps).toBe(0);
    s.step(60);
    expect(s.sim.requestEquip(s.ring.uid, 'ring1')).toBe('equipped');
    s.input.frame.attackPressed = true;
    s.step(2);
    expect(s.sim.requestUnequip('ring1')).toBe('busy');
    expect(s.p.extraAirJumps).toBe(1);
  });
});

describe('The ring as equipment', () => {
  it('is a real ring: fits either ring slot and nothing else, never the main hand', () => {
    const p = new PlayerProfile();
    const ring = p.inventory.add('updraft-ring');
    const sim = new Simulation(flatSim().level, { profile: p });
    expect(sim.requestEquip(ring.uid, 'mainHand')).toBe('incompatible');
    expect(sim.requestEquip(ring.uid, 'boots')).toBe('incompatible');
    expect(sim.requestEquip(ring.uid, 'ring2')).toBe('equipped');
    expect(sim.player.extraAirJumps).toBe(1);
    expect(p.equippedWeaponId()).toBe('pilgrim-sword');
    expect(sim.player.equipment.weapon.id).toBe('pilgrim-sword');
  });

  it('one instance can never sit in both ring slots', () => {
    const p = new PlayerProfile();
    const ring = p.inventory.add('updraft-ring');
    const sim = new Simulation(flatSim().level, { profile: p });
    sim.requestEquip(ring.uid, 'ring1');
    sim.requestEquip(ring.uid, 'ring2');
    expect(p.loadout.get('ring1')).toBe(0);
    expect(p.loadout.get('ring2')).toBe(ring.uid);
    expect(p.loadout.entries().filter(([, uid]) => uid === ring.uid)).toHaveLength(1);
  });

  it('effects come from what is validly equipped, by definition, and two rings of one effect do not stack', () => {
    const p = new PlayerProfile();
    const a = p.inventory.add('updraft-ring');
    const b = p.inventory.add('updraft-ring');
    expect(equippedEffects(p).extraAirJumps).toBe(0);
    p.loadout.set('ring1', a.uid);
    expect(equippedEffects(p).extraAirJumps).toBe(1);
    p.loadout.set('ring2', b.uid);
    expect(equippedEffects(p).extraAirJumps).toBe(1);
    // A ring written into a slot it doesn't fit (a corrupted save) gives nothing.
    p.loadout.clear();
    p.loadout.set('head', a.uid);
    expect(equippedEffects(p).extraAirJumps).toBe(0);
    expect(ITEMS['updraft-ring']!.effects).toEqual({ extraAirJumps: 1 });
  });

  it('unequipping the main hand is refused; an empty slot reports empty', () => {
    const sim = flatSim();
    expect(sim.requestUnequip('mainHand')).toBe('required');
    expect(sim.requestUnequip('ring1')).toBe('empty');
  });
});
