import { describe, expect, it } from 'vitest';
import { calculateDamage } from '../src/combat/Damage';
import { Stamina } from '../src/combat/Resources';
import type { DamageResult } from '../src/combat/types';
import { PLAYER_MOVEMENT } from '../src/config/movement';
import { PLAYER_COMBAT } from '../src/config/player';
import { getAttack } from '../src/data/weapons';
import type { SimEvent } from '../src/world/SimEvents';
import { engagedSim, flatSim, run, ScriptedInput } from './helpers';

const SWORD = getAttack('sword.light.1');
const CLEAVE = getAttack('sentinel.cleave');

function drainEvents(events: { drain(fn: (e: SimEvent) => void): void }): SimEvent[] {
  const out: SimEvent[] = [];
  events.drain((e) => out.push(e));
  return out;
}

describe('Damage calculation', () => {
  it('applies defense and absorption and never drops below 1', () => {
    const out: DamageResult = { damage: 0, postureDamage: 0, knockbackX: 0, knockbackY: 0, hitstunFrames: 0 };
    calculateDamage(SWORD, { defense: 0, absorption: 0, attackMultiplier: 1 }, { defense: 2, absorption: 0.1, attackMultiplier: 1 }, out);
    expect(out.damage).toBe(Math.round((26 - 2) * 0.9));
    calculateDamage(SWORD, { defense: 0, absorption: 0, attackMultiplier: 0.01 }, { defense: 50, absorption: 0.9, attackMultiplier: 1 }, out);
    expect(out.damage).toBe(1);
  });
});

describe('Stamina', () => {
  it('allows an action while above zero, then regenerates after the delay', () => {
    const s = new Stamina(PLAYER_COMBAT.stamina);
    s.spend(95);
    expect(s.canSpend()).toBe(true);
    s.spend(30);
    expect(s.current).toBe(0);
    expect(s.canSpend()).toBe(false);
    // Emptying the meter applies the longer exhaustion delay.
    s.update(PLAYER_COMBAT.stamina.regenDelay + 0.1);
    expect(s.current).toBe(0);
    for (let i = 0; i < 180; i++) s.update(1 / 60);
    expect(s.current).toBeGreaterThan(40);
  });
});

describe('Stamina costs of movement', () => {
  it('jumping costs stamina but is never blocked by an empty meter', () => {
    const sim = flatSim();
    const input = new ScriptedInput();
    const p = sim.player;
    run(sim, input, 2);
    input.frame.jumpPressed = true;
    run(sim, input, 1);
    expect(p.state).toBe('jump');
    expect(p.stamina.current).toBeCloseTo(PLAYER_COMBAT.stamina.max - PLAYER_MOVEMENT.jump.staminaCost, 0);

    run(sim, input, 90);
    p.stamina.spend(1000);
    input.frame.jumpPressed = true;
    run(sim, input, 1);
    expect(p.state).toBe('jump');
  });

  it('chaining rolls from full stamina runs dry after a handful', () => {
    const sim = flatSim();
    const input = new ScriptedInput();
    const p = sim.player;
    run(sim, input, 2);
    let rolls = 0;
    let wasDodging = false;
    // Mash roll every few frames for two seconds.
    run(sim, input, 120, (i) => {
      if (i % 4 === 0) input.frame.dodgePressed = true;
      input.frame.moveX = i % 60 < 30 ? 1 : -1;
      const dodging = p.state === 'dodge';
      if (dodging && (!wasDodging || p.actionFrame === 0)) rolls++;
      wasDodging = dodging;
    });
    expect(rolls).toBeGreaterThanOrEqual(3);
    expect(rolls).toBeLessThanOrEqual(5);
    expect(p.stamina.current).toBeLessThan(PLAYER_COMBAT.stamina.max * 0.5);
  });
});

describe('Sword attack', () => {
  it('has hitboxes only on active frames and hits the enemy exactly once per swing', () => {
    // Enemy 2 tiles in front of the player, out of its own aggro logic's attack range.
    const sim = flatSim({ enemyCol: 7 });
    const input = new ScriptedInput();
    const enemy = sim.enemies[0]!;
    run(sim, input, 2);
    // Keep the enemy passive for this test.
    enemy.cooldown = 999;
    input.frame.attackPressed = true;
    const activeFrames: number[] = [];
    const total = SWORD.startupFrames + SWORD.activeFrames + SWORD.recoveryFrames;
    for (let f = 0; f < total; f++) {
      sim.step(1 / 60, input);
      let any = false;
      sim.combat.detection.forEachActive((hb) => {
        if (hb.owner === sim.player) any = true;
      });
      if (any) activeFrames.push(sim.player.actionFrame);
      while (sim.inHitstop) sim.step(1 / 60, input);
    }
    expect(activeFrames[0]).toBe(SWORD.startupFrames);
    expect(activeFrames.at(-1)).toBe(SWORD.startupFrames + SWORD.activeFrames - 1);
    expect(enemy.hitsTaken).toBe(1);
    expect(enemy.health.current).toBeLessThan(enemy.health.max);
    const events = drainEvents(sim.events);
    expect(events.filter((e) => e.type === 'hit')).toHaveLength(1);
  });

  it('spends stamina and chains into the second combo attack when buffered', () => {
    const sim = flatSim();
    const input = new ScriptedInput();
    run(sim, input, 2);
    input.frame.attackPressed = true;
    run(sim, input, 1);
    expect(sim.player.stamina.current).toBeCloseTo(PLAYER_COMBAT.stamina.max - SWORD.staminaCost, 0);
    run(sim, input, 10);
    input.frame.attackPressed = true;
    run(sim, input, 10);
    expect(sim.player.state).toBe('attack');
    expect(sim.player.attack.attack?.id).toBe('sword.light.2');
  });
});

describe('Hollow Sentinel', () => {
  it('telegraphs before striking and damages a player who stands still', () => {
    const { sim, input, enemy, player } = engagedSim();
    let telegraphTick = -1;
    let hitTick = -1;
    run(sim, input, 240, (i) => {
      for (const e of drainEvents(sim.events)) {
        if (e.type === 'telegraph' && telegraphTick < 0) telegraphTick = i;
        if (e.type === 'hit' && e.targetFaction === 'player' && hitTick < 0) hitTick = i;
      }
    });
    expect(telegraphTick).toBeGreaterThanOrEqual(0);
    expect(hitTick - telegraphTick).toBeGreaterThanOrEqual(CLEAVE.startupFrames - 1);
    expect(player.health.current).toBeLessThan(player.health.max);
    expect(enemy.fsm.current).not.toBe('dead');
  });

  it('dodging the strike leaves health untouched for that swing', () => {
    const { sim, input, enemy, player } = engagedSim();
    let state: 'waiting' | 'dodged' | 'done' = 'waiting';
    let healthAfterSwing = -1;
    let evaded = 0;
    run(sim, input, 200, () => {
      for (const e of drainEvents(sim.events)) if (e.type === 'evade') evaded++;
      if (state === 'waiting' && enemy.fsm.is('attack') && enemy.attack.frame === CLEAVE.startupFrames - 3) {
        input.frame.dodgePressed = true;
        input.frame.moveX = 1;
        state = 'dodged';
      }
      if (state === 'dodged' && enemy.fsm.is('attack') && enemy.attack.phase === 'recovery') {
        healthAfterSwing = player.health.current;
        state = 'done';
      }
    });
    expect(healthAfterSwing).toBe(player.health.max);
    expect(evaded).toBe(1);
  });

  it('hyper-armour keeps the windup going; filling posture breaks it open', () => {
    const run1 = engagedSim();
    let armoredHit = false;
    run(run1.sim, run1.input, 200, () => {
      const e = run1.enemy;
      if (!armoredHit && e.fsm.is('attack') && e.attack.phase === 'startup' && e.hitsTaken === 1) armoredHit = true;
      if (e.fsm.is('attack') && e.attack.frame === 2) run1.input.frame.attackPressed = true;
    });
    expect(armoredHit).toBe(true);

    const run2 = engagedSim();
    let broken = false;
    run(run2.sim, run2.input, 200, () => {
      const e = run2.enemy;
      if (e.fsm.is('attack') && e.attack.frame === 2) {
        // Nearly full posture: the next sword hit breaks through the hyper-armour.
        e.posture.current = e.def.posture.max - 1;
        run2.input.frame.attackPressed = true;
      }
      if (e.fsm.is('postureBroken')) broken = true;
    });
    expect(broken).toBe(true);
  });

  it('is defeated at zero health and respawns after its delay', () => {
    const { sim, input, enemy } = engagedSim();
    run(sim, input, 2);
    enemy.health.current = 1;
    enemy.cooldown = 999;
    let defeated = false;
    run(sim, input, 400, (i) => {
      if (i === 20) input.frame.attackPressed = true;
      if (enemy.isDead) defeated = true;
    });
    expect(defeated).toBe(true);
    expect(enemy.isDead).toBe(false);
    expect(enemy.health.current).toBe(enemy.health.max);
  });

  it('kills and respawns the player when health is depleted', () => {
    const { sim, input, player } = engagedSim();
    player.health.current = 1;
    let died = false;
    let respawned = false;
    run(sim, input, 400, () => {
      if (player.isDead) died = true;
      for (const e of drainEvents(sim.events)) if (e.type === 'respawn' && e.faction === 'player') respawned = true;
    });
    expect(died).toBe(true);
    expect(respawned).toBe(true);
  });
});
