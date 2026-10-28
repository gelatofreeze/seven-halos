import { describe, expect, it } from 'vitest';
import { CombatSystem } from '../src/combat/CombatSystem';
import type { ActiveHitbox, AttackDefinition, Combatant, Faction, HitboxSink } from '../src/combat/types';
import { setRect, type Rect } from '../src/core/Rect';
import { getAttack } from '../src/data/weapons';
import { animFrame, REAPER_ANIMS, SENTINEL_ANIMS, findAnim } from '../src/render/animation/specs';
import { deathPose, ENEMY_VISUALS } from '../src/render/views/enemyProfiles';
import { SimEventQueue, type SimEvent } from '../src/world/SimEvents';
import type { Simulation } from '../src/world/Simulation';
import { DT, engagedSim, flatSim, run, runUntil, ScriptedInput } from './helpers';

function drain(sim: Simulation): SimEvent[] {
  const out: SimEvent[] = [];
  sim.events.drain((e) => out.push(e));
  return out;
}

describe('Animation frame selection', () => {
  it('one-shot animations hold their last frame instead of replaying', () => {
    const dead = findAnim(SENTINEL_ANIMS, 'dead');
    const frames: number[] = [];
    for (let t = 0; t < 5; t += DT) frames.push(animFrame(dead, t));
    // Monotonic: never goes back to an earlier frame.
    for (let i = 1; i < frames.length; i++) expect(dead.frames.indexOf(frames[i]!)).toBeGreaterThanOrEqual(dead.frames.indexOf(frames[i - 1]!));
    expect(frames[0]).toBe(dead.frames[0]);
    expect(frames.at(-1)).toBe(dead.frames.at(-1));
  });

  it('looping animations wrap', () => {
    const idle = findAnim(SENTINEL_ANIMS, 'idle');
    expect(idle.loop).toBe(true);
    const period = idle.frames.length / idle.fps;
    expect(animFrame(idle, 0.01)).toBe(animFrame(idle, period + 0.01));
  });

  it('finds animations by bare or prefixed name and rejects unknown ones', () => {
    expect(findAnim(REAPER_ANIMS, 'dead').key).toBe('reaper.dead');
    expect(() => findAnim(REAPER_ANIMS, 'moonwalk')).toThrow();
  });

  it('every enemy profile has the animations its states need', () => {
    for (const profile of Object.values(ENEMY_VISUALS)) {
      for (const name of ['idle', 'walk', 'stagger', 'parried', 'broken', 'riposted', 'dead']) expect(() => findAnim(profile.anims, name)).not.toThrow();
    }
  });
});

describe('Death presentation', () => {
  const dead = findAnim(SENTINEL_ANIMS, 'dead');
  const death = ENEMY_VISUALS['hollow-sentinel']!.death;

  it('is opaque while collapsing, then fades out completely', () => {
    expect(deathPose(dead, death, 0).alpha).toBe(1);
    expect(deathPose(dead, death, death.fadeDelay).alpha).toBe(1);
    const mid = deathPose(dead, death, death.fadeDelay + death.fadeDuration / 2).alpha;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(deathPose(dead, death, death.fadeDelay + death.fadeDuration + 1).alpha).toBe(0);
    // The collapse finishes before the fade starts.
    expect(dead.frames.length / dead.fps).toBeLessThanOrEqual(death.fadeDelay);
  });

  it('can leave remains instead of vanishing', () => {
    const remains = { ...death, remains: true, remainsAlpha: 0.4 };
    expect(deathPose(dead, remains, 99).alpha).toBeCloseTo(0.4);
    expect(deathPose(dead, remains, 99).frame).toBe(dead.frames.at(-1));
  });

  it('never loops the death frames even if the spec says loop', () => {
    expect(deathPose({ ...dead, loop: true }, death, 10).frame).toBe(dead.frames.at(-1));
  });

  it('fades out before the enemy respawns', () => {
    for (const [id, profile] of Object.entries(ENEMY_VISUALS)) {
      const respawn = id === 'hollow-sentinel' ? 4 : 6;
      expect(profile.death.fadeDelay + profile.death.fadeDuration).toBeLessThan(respawn);
    }
  });
});

/** Kill the first enemy with a sword combo, returning events. */
function kill(sim: Simulation, input: ScriptedInput): SimEvent[] {
  const e = sim.enemies[0]!;
  const events: SimEvent[] = [];
  e.health.current = 1;
  runUntil(sim, input, () => e.isDead, 300, (i) => {
    e.cooldown = 999;
    if (sim.player.state !== 'attack') {
      sim.player.body.teleport(e.body.footX - 20, sim.player.body.footY);
      sim.player.facing = 1;
    }
    if (i % 10 === 0) input.frame.attackPressed = true;
    events.push(...drain(sim));
  });
  return events;
}

describe('Enemy death', () => {
  it('enters the dead state exactly once, even when struck again', () => {
    const sim = flatSim({ enemyCol: 9 });
    const input = new ScriptedInput();
    const e = sim.enemies[0]!;
    const events = kill(sim, input);
    // Keep swinging at the corpse.
    run(sim, input, 90, (i) => {
      if (i % 12 === 0) input.frame.attackPressed = true;
      events.push(...drain(sim));
    });
    expect(events.filter((ev) => ev.type === 'death' && ev.faction === 'enemy')).toHaveLength(1);
    expect(events.filter((ev) => ev.type === 'hit' && ev.targetFaction === 'enemy')).toHaveLength(1);
    expect(e.deaths).toBe(1);
    expect(e.fsm.current).toBe('dead');
  });

  it('stops attacking and emits no hitboxes once dead, even mid-swing', () => {
    const { sim, input, enemy, player } = engagedSim();
    runUntil(sim, input, () => enemy.fsm.is('attack') && enemy.attack.phase === 'startup');
    enemy.health.current = 1;
    enemy.receiveHit({ damage: 5, postureDamage: 0, knockbackX: 0, knockbackY: 0, hitstunFrames: 0 }, { facing: 1, attack: getAttack('sword.light.1') } as ActiveHitbox);
    expect(enemy.isDead).toBe(true);
    const health = player.health.current;
    let hitboxes = 0;
    run(sim, input, 120, () => {
      const sink: HitboxSink = { add: () => hitboxes++ };
      enemy.writeHitboxes(sink);
    });
    expect(hitboxes).toBe(0);
    expect(player.health.current).toBe(health);
  });

  it('does not slide away on lunge momentum', () => {
    const { sim, input, enemy } = engagedSim();
    run(sim, input, 2);
    enemy.body.vx = -300; // as if mid-lunge
    enemy.receiveHit({ damage: 999, postureDamage: 0, knockbackX: 0, knockbackY: 0, hitstunFrames: 0 }, { facing: 1, attack: getAttack('sword.light.1') } as ActiveHitbox);
    const x0 = enemy.body.footX;
    run(sim, input, 60);
    // Only the small shove in the killing blow's direction.
    expect(enemy.body.footX - x0).toBeGreaterThanOrEqual(0);
    expect(enemy.body.footX - x0).toBeLessThan(4);
    expect(enemy.body.vx).toBe(0);
  });

  it('respawns cleanly at its spawn point with full health and posture', () => {
    const sim = flatSim({ enemyCol: 9 });
    const input = new ScriptedInput();
    const e = sim.enemies[0]!;
    const spawnX = e.body.footX;
    kill(sim, input);
    sim.player.body.teleport(30, sim.player.body.footY); // walk away so it stays idle
    const events: SimEvent[] = [];
    const steps = runUntil(sim, input, () => !e.isDead, 600, () => events.push(...drain(sim)));
    events.push(...drain(sim));
    // Respawns on schedule (hit-stop frames aside).
    expect(steps * DT).toBeGreaterThan(e.def.respawnDelay! - 0.5);
    expect(events.filter((ev) => ev.type === 'respawn' && ev.faction === 'enemy')).toHaveLength(1);
    expect(e.isDead).toBe(false);
    expect(e.health.current).toBe(e.health.max);
    expect(e.posture.current).toBe(0);
    expect(Math.abs(e.body.footX - spawnX)).toBeLessThan(1);
    expect(e.consumeDeath()).toBe(false);
    // It can die again, and that counts as a new death.
    kill(sim, input);
    expect(e.deaths).toBe(2);
  });
});

/** Minimal combatant for exercising the CombatSystem directly. */
class Dummy implements Combatant {
  static nextId = 1;
  readonly combatId = Dummy.nextId++;
  readonly stats = { defense: 0, absorption: 0, attackMultiplier: 1 };
  dead = false;
  hitsTaken = 0;
  constructor(readonly faction: Faction, private readonly x: number, private readonly attack: AttackDefinition) {}
  get centerX() { return this.x + 8; }
  get isDead() { return this.dead; }
  getHurtbox(out: Rect) {
    if (this.dead) return false;
    setRect(out, this.x, 0, 16, 32);
    return true;
  }
  isInvulnerable() { return false; }
  writeHitboxes(sink: HitboxSink) { sink.add(this, this.attack, this.combatId, 1, 0, this.x - 40, 0, 96, 32); }
  receiveHit() {
    this.hitsTaken++;
    this.dead = true; // every hit is lethal
  }
}

describe('Combat resolution with deaths in the same step', () => {
  it('an attacker killed earlier in the step deals no damage', () => {
    const combat = new CombatSystem(new SimEventQueue());
    const player = new Dummy('player', 0, getAttack('sword.light.1'));
    const enemy = new Dummy('enemy', 10, getAttack('sentinel.cleave'));
    // Player hitboxes resolve first; the enemy dies, so its own swing this step does nothing.
    combat.step([player, enemy]);
    expect(enemy.hitsTaken).toBe(1);
    expect(player.hitsTaken).toBe(0);
  });
});
