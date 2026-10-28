import { describe, expect, it } from 'vitest';
import { TOUCH_LAYOUT } from '../src/config/controls';
import { createInputFrame } from '../src/input/InputActions';
import { InputHub } from '../src/input/InputHub';
import { joystickOutput } from '../src/input/joystick';
import { TouchRouter, type ButtonHitArea } from '../src/input/TouchRouter';

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

describe('TouchRouter (touch press / hold / release)', () => {
  const buttons: ButtonHitArea[] = [
    { action: 'jump', cx: 800, cy: 340, radius: 38 },
    { action: 'heavy', cx: 640, cy: 300, radius: 29 },
    { action: 'guard', cx: 710, cy: 240, radius: 29 },
    { action: 'attack', cx: 712, cy: 330, radius: 33 },
  ];
  const setup = () => {
    const hub = new InputHub();
    const router = new TouchRouter(hub, TOUCH_LAYOUT);
    const frame = createInputFrame();
    return { hub, router, frame };
  };

  it('a held heavy button reports pressed once, then held, then released', () => {
    const { hub, router, frame } = setup();
    router.begin([{ id: 1, x: 642, y: 302 }], buttons, 844);
    router.sync();
    hub.sample(frame);
    expect(frame).toMatchObject({ heavyPressed: true, heavyHeld: true });
    hub.sample(frame);
    expect(frame).toMatchObject({ heavyPressed: false, heavyHeld: true });
    router.end([{ id: 1, x: 642, y: 302 }]);
    router.sync();
    hub.sample(frame);
    expect(frame).toMatchObject({ heavyPressed: false, heavyHeld: false });
  });

  it('a quick tap between samples still registers as one heavy press (uncharged)', () => {
    const { hub, router, frame } = setup();
    router.begin([{ id: 1, x: 640, y: 300 }], buttons, 844);
    router.sync();
    router.end([{ id: 1, x: 640, y: 300 }]);
    router.sync();
    hub.sample(frame);
    expect(frame.heavyPressed).toBe(true);
    hub.sample(frame);
    expect(frame.heavyHeld).toBe(false);
  });

  it('joystick, guard and attack can all be held at once', () => {
    const { hub, router, frame } = setup();
    router.begin([{ id: 1, x: 150, y: 260 }], buttons, 844);
    router.move([{ id: 1, x: 200, y: 260 }]);
    router.begin([{ id: 2, x: 710, y: 240 }], buttons, 844);
    router.begin([{ id: 3, x: 715, y: 335 }], buttons, 844);
    router.sync();
    hub.sample(frame);
    expect(frame.moveX).toBe(1);
    expect(frame.guardHeld).toBe(true);
    expect(frame.attackPressed).toBe(true);
  });

  it('a slightly missed tap goes to the nearest button; taps far from any button do nothing', () => {
    const { hub, router, frame } = setup();
    router.begin([{ id: 1, x: 700, y: 245 }], buttons, 844);
    router.begin([{ id: 2, x: 520, y: 60 }], buttons, 844);
    router.sync();
    hub.sample(frame);
    expect(frame.guardHeld).toBe(true);
    expect(router.bindings.size).toBe(1);
  });

  it('a finger whose touchend was lost is released on the next event', () => {
    const { hub, router, frame } = setup();
    router.begin([{ id: 1, x: 150, y: 260 }], buttons, 844);
    router.begin([{ id: 2, x: 710, y: 240 }], buttons, 844);
    router.sync();
    router.reconcile(new Set([1]));
    router.sync();
    hub.sample(frame);
    expect(frame.guardHeld).toBe(false);
    expect(router.stick).toBeDefined();
  });
});
