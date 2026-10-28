import { describe, expect, it } from 'vitest';
import { FixedTimestep } from '../src/core/FixedTimestep';
import { StateMachine } from '../src/core/StateMachine';
import { InputHub } from '../src/input/InputHub';
import { createInputFrame } from '../src/input/InputActions';
import { buildSolids, TILE } from '../src/world/Level';
import { CollisionWorld } from '../src/physics/CollisionWorld';
import { KinematicBody } from '../src/physics/KinematicBody';

describe('FixedTimestep', () => {
  it('produces the same number of steps regardless of frame rate', () => {
    const count = (fps: number) => {
      const ts = new FixedTimestep(60);
      let steps = 0;
      for (let i = 0; i < fps * 2; i++) ts.advance(1 / fps, () => steps++);
      return steps;
    };
    expect(count(60)).toBe(120);
    expect(count(120)).toBeGreaterThanOrEqual(119);
    expect(count(120)).toBeLessThanOrEqual(120);
    expect(count(30)).toBe(120);
  });

  it('clamps huge frame gaps (tab switches) instead of spiralling', () => {
    const ts = new FixedTimestep(60, 5);
    let steps = 0;
    ts.advance(10, () => steps++);
    expect(steps).toBe(5);
  });
});

describe('StateMachine', () => {
  it('runs the new state in the same tick and counts frames from zero', () => {
    const log: string[] = [];
    const ctx = {};
    const fsm = new StateMachine<typeof ctx, 'a' | 'b'>(
      ctx,
      {
        a: { update: () => 'b' },
        b: { update: () => void log.push(`b${fsm.ticks}`) },
      },
      'a',
    );
    fsm.update(1 / 60);
    fsm.update(1 / 60);
    expect(log).toEqual(['b0', 'b1']);
  });
});

describe('InputHub', () => {
  it('delivers a tap that begins and ends between two samples', () => {
    const hub = new InputHub();
    const frame = createInputFrame();
    hub.press('attack', 'touch');
    hub.release('attack', 'touch');
    hub.sample(frame);
    expect(frame.attackPressed).toBe(true);
    hub.sample(frame);
    expect(frame.attackPressed).toBe(false);
  });

  it('supports simultaneous actions from several sources', () => {
    const hub = new InputHub();
    const frame = createInputFrame();
    hub.press('right', 'touch');
    hub.press('jump', 'key:Space');
    hub.press('attack', 'key:KeyJ');
    hub.sample(frame);
    expect(frame).toMatchObject({ moveX: 1, jumpPressed: true, jumpHeld: true, attackPressed: true });
  });

  it('resolves left+right to the most recent press', () => {
    const hub = new InputHub();
    const frame = createInputFrame();
    hub.press('right', 'a');
    hub.press('left', 'b');
    hub.sample(frame);
    expect(frame.moveX).toBe(-1);
  });

  it('releaseAll clears held state (focus loss)', () => {
    const hub = new InputHub();
    const frame = createInputFrame();
    hub.press('right', 'a');
    hub.releaseAll();
    hub.sample(frame);
    expect(frame.moveX).toBe(0);
  });
});

describe('Collision', () => {
  it('merges tiles into rectangles', () => {
    const S = TILE.solid;
    const E = TILE.empty;
    const solids = buildSolids(
      [
        [S, S, E],
        [S, S, E],
        [S, S, S],
      ],
      16,
    );
    expect(solids).toHaveLength(2);
  });

  it('does not tunnel through a thin floor at extreme speed', () => {
    const world = new CollisionWorld([{ x: 0, y: 100, w: 200, h: 2, oneWay: false }], { x: 0, y: 0, w: 200, h: 200 });
    const body = new KinematicBody(50, 20, 10, 10);
    body.vy = 20000;
    body.step(world, 1 / 60);
    expect(body.footY).toBeCloseTo(100);
    expect(body.grounded).toBe(true);
  });

  it('one-way platforms block from above only', () => {
    const world = new CollisionWorld([{ x: 0, y: 100, w: 200, h: 6, oneWay: true }], { x: 0, y: 0, w: 200, h: 200 });
    const body = new KinematicBody(50, 130, 10, 10);
    body.vy = -600;
    for (let i = 0; i < 5; i++) body.step(world, 1 / 60);
    expect(body.footY).toBeLessThan(100);
    body.teleport(50, 90);
    body.vy = 300;
    for (let i = 0; i < 3; i++) body.step(world, 1 / 60);
    expect(body.footY).toBeCloseTo(100);
    expect(body.grounded).toBe(true);
  });
});
