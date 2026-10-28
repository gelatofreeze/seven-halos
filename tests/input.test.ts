import { describe, expect, it } from 'vitest';
import { TOUCH_LAYOUT } from '../src/config/controls';
import { createInputFrame } from '../src/input/InputActions';
import { InputHub } from '../src/input/InputHub';
import { joystickOutput } from '../src/input/joystick';

const J = TOUCH_LAYOUT.joystick;
const out = { x: 0, down: false };

describe('Joystick', () => {
  it('ignores the deadzone and reaches full speed before the rim', () => {
    expect(joystickOutput(J.radius * J.deadzone * 0.9, 0, J, out).x).toBe(0);
    expect(joystickOutput(J.radius * J.fullTiltAt, 0, J, out).x).toBe(1);
    expect(joystickOutput(-J.radius, 0, J, out).x).toBe(-1);
    const mid = joystickOutput(J.radius * ((J.deadzone + J.fullTiltAt) / 2), 0, J, out).x;
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
  });

  it('holds down only for a mostly-downward push', () => {
    expect(joystickOutput(0, J.radius * 0.9, J, out).down).toBe(true);
    expect(joystickOutput(J.radius, J.radius * 0.7, J, out).down).toBe(false);
    expect(joystickOutput(0, -J.radius, J, out).down).toBe(false);
  });
});

describe('InputHub analog axis', () => {
  it('feeds the joystick axis into moveX while buttons work at the same time', () => {
    const hub = new InputHub();
    const frame = createInputFrame();
    hub.setAxis('touch:stick', 0.5);
    hub.press('jump', 'touch:button');
    hub.press('attack', 'touch:button');
    hub.sample(frame);
    expect(frame).toMatchObject({ moveX: 0.5, jumpPressed: true, attackPressed: true });
    hub.setAxis('touch:stick', 0);
    hub.sample(frame);
    expect(frame.moveX).toBe(0);
  });

  it('keys override the analog axis; releaseAll clears it', () => {
    const hub = new InputHub();
    const frame = createInputFrame();
    hub.setAxis('touch:stick', 0.4);
    hub.press('left', 'key:KeyA');
    hub.sample(frame);
    expect(frame.moveX).toBe(-1);
    hub.releaseAll();
    hub.sample(frame);
    expect(frame.moveX).toBe(0);
  });
});
