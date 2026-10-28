import { describe, expect, it } from 'vitest';
import { PLAYER_MOVEMENT } from '../src/config/movement';
import { parseLevel } from '../src/world/Level';
import { Simulation } from '../src/world/Simulation';
import { flatSim, run, ScriptedInput } from './helpers';

describe('Player movement', () => {
  it('accelerates to max run speed quickly and stops without long slides', () => {
    const sim = flatSim();
    const input = new ScriptedInput();
    const p = sim.player;
    input.frame.moveX = 1;
    let framesToMax = -1;
    run(sim, input, 30, (i) => {
      if (framesToMax < 0 && p.body.vx >= PLAYER_MOVEMENT.ground.maxSpeed) framesToMax = i;
    });
    expect(framesToMax).toBeGreaterThan(0);
    expect(framesToMax).toBeLessThanOrEqual(8);
    expect(p.state).toBe('run');
    expect(p.facing).toBe(1);

    input.frame.moveX = 0;
    const startX = p.body.x;
    run(sim, input, 20);
    expect(p.body.vx).toBe(0);
    expect(p.body.x - startX).toBeLessThan(8);
    expect(p.state).toBe('idle');
  });

  it('a held jump reaches the tuned height; a tap jumps much lower', () => {
    const height = (holdFrames: number) => {
      const sim = flatSim();
      const input = new ScriptedInput();
      const p = sim.player;
      run(sim, input, 2);
      const groundY = p.body.footY;
      let apex = groundY;
      input.frame.jumpPressed = true;
      run(sim, input, 90, (i) => {
        input.frame.jumpHeld = i < holdFrames;
        apex = Math.min(apex, p.body.footY);
      });
      expect(p.body.grounded).toBe(true);
      return groundY - apex;
    };
    const full = height(60);
    const tap = height(1);
    expect(full).toBeGreaterThanOrEqual(PLAYER_MOVEMENT.jump.height);
    expect(full).toBeLessThan(PLAYER_MOVEMENT.jump.height + 10);
    expect(tap).toBeLessThan(full * 0.5);
    expect(tap).toBeGreaterThan(6);
  });

  it('allows a jump within coyote time after running off a ledge, but not after', () => {
    // Floor ends at column 12; open pit to the right.
    const attempt = (lateFrames: number) => {
      const rows = ['#..........................#'];
      for (let i = 0; i < 9; i++) rows.push(rows[0]!);
      rows.push('#....P.....................#', '#############...............', '#############...............');
      const sim = new Simulation(parseLevel({ id: 't', name: 't', tileSize: 16, rows }));
      const input = new ScriptedInput();
      input.frame.moveX = 1;
      let airborne = -1;
      let jumped = false;
      run(sim, input, 120, (i) => {
        if (airborne < 0 && !sim.player.body.grounded && sim.player.state === 'fall') airborne = i;
        if (airborne >= 0 && i === airborne + lateFrames) {
          input.frame.jumpPressed = true;
          input.frame.jumpHeld = true;
        }
        if (sim.player.state === 'jump') jumped = true;
      });
      return jumped;
    };
    expect(attempt(3)).toBe(true);
    expect(attempt(Math.ceil(PLAYER_MOVEMENT.jump.coyoteTime * 60) + 3)).toBe(false);
  });

  it('buffers a jump pressed shortly before landing', () => {
    const sim = flatSim();
    const input = new ScriptedInput();
    const p = sim.player;
    run(sim, input, 2);
    input.frame.jumpPressed = true;
    input.frame.jumpHeld = true;
    run(sim, input, 1);
    input.frame.jumpHeld = false;
    // Fall until just above the floor, then press again.
    let pressedAt = -1;
    let jumpedAgain = false;
    run(sim, input, 120, (i) => {
      if (pressedAt < 0 && p.state === 'fall' && p.body.vy > 0 && sim.level.heightPx - 32 - p.body.footY < 10) {
        input.frame.jumpPressed = true;
        pressedAt = i;
      }
      if (pressedAt >= 0 && p.state === 'jump') jumpedAgain = true;
    });
    expect(pressedAt).toBeGreaterThan(0);
    expect(jumpedAgain).toBe(true);
  });

  it('air control is limited compared to ground control', () => {
    const sim = flatSim();
    const input = new ScriptedInput();
    const p = sim.player;
    run(sim, input, 2);
    input.frame.jumpPressed = true;
    input.frame.jumpHeld = true;
    run(sim, input, 4);
    input.frame.moveX = 1;
    run(sim, input, 4);
    const airSpeed = p.body.vx;
    expect(airSpeed).toBeLessThan(PLAYER_MOVEMENT.air.acceleration * (4 / 60) + 1);
    expect(airSpeed).toBeLessThan(PLAYER_MOVEMENT.ground.acceleration * (4 / 60));
  });

  it('dodge has startup, invincibility and recovery windows and costs stamina', () => {
    const sim = flatSim();
    const input = new ScriptedInput();
    const p = sim.player;
    const d = PLAYER_MOVEMENT.dodge;
    run(sim, input, 2);
    const stamina = p.stamina.current;
    const startX = p.body.x;
    input.frame.dodgePressed = true;
    const invuln: boolean[] = [];
    for (let i = 0; i < d.startupFrames + d.invulnerableFrames + d.recoveryFrames; i++) {
      sim.step(1 / 60, input);
      invuln.push(p.isDodgeInvulnerable());
    }
    expect(p.stamina.current).toBeCloseTo(stamina - d.staminaCost, 0);
    expect(invuln.slice(0, d.startupFrames).every((v) => !v)).toBe(true);
    expect(invuln.slice(d.startupFrames, d.startupFrames + d.invulnerableFrames).every(Boolean)).toBe(true);
    expect(invuln.slice(d.startupFrames + d.invulnerableFrames).every((v) => !v)).toBe(true);
    const distance = p.body.x - startX;
    expect(distance).toBeGreaterThan(60);
    expect(distance).toBeLessThan(100);
    sim.step(1 / 60, input);
    expect(p.state).toBe('idle');
  });

  it('dodges in the held direction and faces it', () => {
    const sim = flatSim();
    const input = new ScriptedInput();
    run(sim, input, 2);
    input.frame.moveX = -1;
    input.frame.dodgePressed = true;
    run(sim, input, 1);
    expect(sim.player.state).toBe('dodge');
    expect(sim.player.facing).toBe(-1);
    expect(sim.player.body.vx).toBeLessThan(0);
  });

  it('cannot dodge or attack with zero stamina', () => {
    const sim = flatSim();
    const input = new ScriptedInput();
    run(sim, input, 2);
    sim.player.stamina.spend(1000);
    input.frame.dodgePressed = true;
    run(sim, input, 1);
    expect(sim.player.state).not.toBe('dodge');
    input.frame.attackPressed = true;
    run(sim, input, 1);
    expect(sim.player.state).not.toBe('attack');
  });

  it('falling into the abyss costs health and returns the player to solid ground away from the edge', () => {
    const rows = ['#..........................#'];
    for (let i = 0; i < 9; i++) rows.push(rows[0]!);
    rows.push('#....P.....................#', '#############.........######', '#############.........######');
    const sim = new Simulation(parseLevel({ id: 't', name: 't', tileSize: 16, rows }));
    const input = new ScriptedInput();
    const p = sim.player;
    input.frame.moveX = 1;
    let fell = false;
    run(sim, input, 200, () => {
      if (p.health.current < p.health.max && !fell) {
        fell = true;
        input.frame.moveX = 0;
      }
    });
    expect(fell).toBe(true);
    expect(p.health.current).toBe(p.health.max - 25);
    expect(p.body.grounded).toBe(true);
    // Ledge is at x = 13 * 16 = 208; the body must be fully on the floor.
    expect(p.body.x + p.body.w).toBeLessThanOrEqual(208 - 6);
  });

  it('is deterministic for identical input', () => {
    const trace = () => {
      const sim = flatSim();
      const input = new ScriptedInput();
      const out: number[] = [];
      run(sim, input, 200, (i) => {
        input.frame.moveX = i % 50 < 30 ? 1 : -1;
        input.frame.jumpPressed = i % 37 === 0;
        input.frame.jumpHeld = i % 37 < 12;
        input.frame.dodgePressed = i % 71 === 0;
        out.push(sim.player.body.x, sim.player.body.y);
      });
      return out;
    };
    expect(trace()).toEqual(trace());
  });
});
