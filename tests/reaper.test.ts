import { describe, expect, it } from 'vitest';
import { PARRY } from '../src/config/combat';
import { getEnemy } from '../src/data/enemies';
import { getAttack } from '../src/data/weapons';
import type { SimEvent } from '../src/world/SimEvents';
import type { Simulation } from '../src/world/Simulation';
import { flatSim, run, runUntil, ScriptedInput } from './helpers';

const REAPER = getEnemy('barrow-reaper');
const SWEEP = getAttack('reaper.sweep');
const HARVEST = getAttack('reaper.harvest');

function drain(sim: Simulation): SimEvent[] {
  const out: SimEvent[] = [];
  sim.events.drain((e) => out.push(e));
  return out;
}

/** Player at column 5, Reaper at `col` on a wide arena. */
function reaperSim(col = 10, forced: string | null = null) {
  const sim = flatSim({ enemyCol: col, enemy: 'R', width: 50 });
  const input = new ScriptedInput();
  const reaper = sim.enemies[0]!;
  reaper.forcedAttack = forced;
  return { sim, input, reaper, player: sim.player };
}

describe('Barrow Reaper', () => {
  it('notices the player from further away than the Sentinel and closes in faster', () => {
    expect(REAPER.aggroRange).toBeGreaterThan(getEnemy('hollow-sentinel').aggroRange);
    expect(REAPER.walkSpeed).toBeGreaterThan(getEnemy('hollow-sentinel').walkSpeed * 1.5);
    const { sim, input, reaper } = reaperSim(15);
    run(sim, input, 2);
    expect(reaper.fsm.current).toBe('approach');
  });

  it('chooses attacks by distance: sweep up close, lunge from mid range', () => {
    const { reaper } = reaperSim();
    for (let i = 0; i < 50; i++) expect(reaper.chooseAttack(30)?.id).toBe('reaper.sweep');
    for (let i = 0; i < 50; i++) expect(reaper.chooseAttack(90)?.id).toBe('reaper.harvest');
    expect(reaper.chooseAttack(200)).toBeNull();
    const mixed = new Set<string>();
    for (let i = 0; i < 200; i++) mixed.add(reaper.chooseAttack(52)!.id);
    expect(mixed.size).toBe(2);
  });

  it('telegraphs every attack well before it lands, and recovers for a punishable window', () => {
    for (const attack of [SWEEP, HARVEST]) {
      const { sim, input, reaper } = reaperSim(attack === SWEEP ? 8 : 11, attack.id);
      let telegraphAt = -1;
      let activeAt = -1;
      let recoveredAt = -1;
      run(sim, input, 300, (i) => {
        for (const e of drain(sim)) {
          if (e.type === 'telegraph' && telegraphAt < 0) telegraphAt = i;
          if (e.type === 'attack' && e.faction === 'enemy' && activeAt < 0) activeAt = i;
        }
        if (activeAt >= 0 && recoveredAt < 0 && !reaper.fsm.is('attack')) recoveredAt = i;
      });
      expect(activeAt - telegraphAt).toBeGreaterThanOrEqual(attack.startupFrames - 1);
      // Nothing faster than 0.4 s: every attack is reactable.
      expect(attack.startupFrames).toBeGreaterThanOrEqual(24);
      expect(recoveredAt - activeAt).toBeGreaterThanOrEqual(attack.activeFrames + attack.recoveryFrames - 2);
    }
    expect(HARVEST.recoveryFrames).toBeGreaterThan(SWEEP.recoveryFrames * 2);
  });

  it('the low sweep can be jumped over', () => {
    const { sim, input, reaper, player } = reaperSim(8, SWEEP.id);
    let jumped = false;
    let healthAfterSweep = -1;
    run(sim, input, 200, () => {
      if (healthAfterSweep >= 0) return;
      if (jumped && !reaper.fsm.is('attack')) {
        healthAfterSweep = player.health.current;
        return;
      }
      if (!jumped && reaper.fsm.is('attack') && reaper.attack.frame === SWEEP.startupFrames - 6) {
        input.frame.jumpPressed = true;
        jumped = true;
      }
      input.frame.jumpHeld = jumped;
      if (reaper.attack.phase === 'recovery') input.frame.jumpHeld = false;
    });
    expect(jumped).toBe(true);
    expect(healthAfterSweep).toBe(player.health.max);
  });

  it('a standing player is hit by the sweep; a timed roll avoids it', () => {
    const hitRun = reaperSim(8, SWEEP.id);
    run(hitRun.sim, hitRun.input, 60);
    expect(hitRun.player.health.current).toBeLessThan(hitRun.player.health.max);

    const { sim, input, reaper, player } = reaperSim(8, SWEEP.id);
    let rolled = false;
    run(sim, input, 60, () => {
      if (!rolled && reaper.fsm.is('attack') && reaper.attack.frame === SWEEP.startupFrames - 3) {
        input.frame.dodgePressed = true;
        input.frame.moveX = 1;
        rolled = true;
      } else input.frame.moveX = 0;
    });
    expect(player.health.current).toBe(player.health.max);
  });

  it('can be parried into a riposte opening, and blocked with a guard', () => {
    const parry = reaperSim(8, SWEEP.id);
    run(parry.sim, parry.input, 120, () => {
      if (parry.reaper.fsm.is('attack') && parry.reaper.attack.frame === SWEEP.startupFrames - (PARRY.startupFrames + 3)) parry.input.frame.parryPressed = true;
    });
    expect(parry.player.health.current).toBe(parry.player.health.max);
    expect(parry.reaper.deaths === 0 && (parry.reaper.wasParried || parry.reaper.fsm.is('parried'))).toBe(true);

    const guard = reaperSim(8, SWEEP.id);
    guard.input.frame.guardHeld = true;
    const events: SimEvent[] = [];
    run(guard.sim, guard.input, 120, () => events.push(...drain(guard.sim)));
    expect(events.some((e) => e.type === 'block')).toBe(true);
  });

  it('the committed lunge has hyper-armour; the sweep does not', () => {
    expect(HARVEST.hyperArmor).toBe(true);
    expect(SWEEP.hyperArmor).toBeFalsy();
    const { sim, input, reaper, player } = reaperSim(8, SWEEP.id);
    runUntil(sim, input, () => reaper.fsm.is('attack') && reaper.attack.frame === 2);
    player.body.teleport(reaper.body.footX - 26, player.body.footY);
    player.facing = 1;
    input.frame.attackPressed = true;
    const flinched = runUntil(sim, input, () => reaper.fsm.is('stagger'), 30);
    expect(flinched).toBeGreaterThanOrEqual(0);
  });

  it('breaks posture more easily than the Sentinel and can be riposted', () => {
    expect(REAPER.posture.max).toBeLessThan(getEnemy('hollow-sentinel').posture.max);
    const { sim, input, reaper, player } = reaperSim(7);
    reaper.cooldown = 999;
    reaper.posture.current = REAPER.posture.max - 5;
    run(sim, input, 2);
    player.facing = 1;
    input.frame.attackPressed = true;
    const broke = runUntil(sim, input, () => reaper.fsm.is('postureBroken'), 40, () => (reaper.cooldown = 999));
    expect(broke).toBeGreaterThanOrEqual(0);
    expect(reaper.canBeRiposted()).toBe(true);
  });

  it('dies and respawns after its delay', () => {
    const { sim, input, reaper } = reaperSim(7);
    reaper.health.current = 1;
    reaper.cooldown = 999;
    run(sim, input, 2);
    input.frame.attackPressed = true;
    expect(runUntil(sim, input, () => reaper.isDead, 60)).toBeGreaterThanOrEqual(0);
    expect(runUntil(sim, input, () => !reaper.isDead, 60 * (REAPER.respawnDelay! + 1))).toBeGreaterThanOrEqual(0);
    expect(reaper.health.current).toBe(reaper.health.max);
  });
});

describe('Multiple enemies', () => {
  it('enemies never hit each other and each death is tracked separately', () => {
    // Sentinel and Reaper side by side, player in front of both.
    const sim = flatSim({ enemyCol: 9, enemy: 'R', extraEnemies: [[11, 'E']], width: 50 });
    const input = new ScriptedInput();
    const [reaper, sentinel] = sim.enemies as [(typeof sim.enemies)[0], (typeof sim.enemies)[0]];
    const events: SimEvent[] = [];
    run(sim, input, 600, () => events.push(...drain(sim)));
    expect(events.filter((e) => e.type === 'hit' && e.targetFaction === 'enemy')).toHaveLength(0);
    expect(reaper.health.current).toBe(reaper.health.max);
    expect(sentinel.health.current).toBe(sentinel.health.max);
    // Kill only the reaper: only its reward is granted.
    reaper.health.current = 1;
    sim.player.health.reset();
    const hold = () => {
      reaper.cooldown = 999;
      sentinel.cooldown = 999;
    };
    // Stay point-blank behind it (it keeps backing off) and swing until it falls.
    const killed = runUntil(sim, input, () => reaper.isDead, 300, (i) => {
      hold();
      if (sim.player.state !== 'attack') {
        sim.player.body.teleport(reaper.body.footX - 20, sim.player.body.footY);
        sim.player.facing = 1;
      }
      if (i % 10 === 0) input.frame.attackPressed = true;
    });
    expect(killed).toBeGreaterThanOrEqual(0);
    run(sim, input, 2);
    expect(sim.profile.wallet.experience).toBe(REAPER.rewards.experience);
    expect(sentinel.deaths).toBe(0);
  });
});
