import type { TouchLayoutConfig } from '../config/controls';
import type { ActionName } from './InputActions';
import type { InputHub } from './InputHub';
import { joystickOutput, type JoystickOutput } from './joystick';

export const STICK_SOURCE = 'touch:stick';
export const BUTTON_SOURCE = 'touch:button';

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

/** A button's on-screen hit circle, in the same coordinates as touch points. */
export interface ButtonHitArea {
  action: ActionName;
  cx: number;
  cy: number;
  radius: number;
}

export interface StickBinding {
  kind: 'stick';
  baseX: number;
  baseY: number;
  x: number;
  y: number;
}

export type TouchBinding = StickBinding | { kind: 'button'; action: ActionName };

/**
 * DOM-free touch routing, so it can be unit-tested. Each finger is bound
 * when it lands (nearest button within reach, else the joystick if it lands
 * in the stick zone) and keeps that binding until it lifts. Holds map
 * directly to held actions, so press/hold/release semantics (heavy charge,
 * guard) come straight from finger contact.
 */
export class TouchRouter {
  readonly bindings = new Map<number, TouchBinding>();
  readonly stickOut: JoystickOutput = { x: 0, down: false };
  private readonly held = new Set<ActionName>();
  private stickDown = false;

  constructor(
    private readonly hub: InputHub,
    private readonly layout: TouchLayoutConfig,
  ) {}

  get heldActions(): ReadonlySet<ActionName> {
    return this.held;
  }

  get stick(): StickBinding | undefined {
    for (const b of this.bindings.values()) if (b.kind === 'stick') return b;
    return undefined;
  }

  begin(points: readonly TouchPoint[], buttons: readonly ButtonHitArea[], screenWidth: number): void {
    for (const t of points) {
      if (this.bindings.has(t.id)) continue;
      const button = nearestButton(t.x, t.y, buttons, this.layout.hitRadiusScale);
      if (button) this.bindings.set(t.id, { kind: 'button', action: button.action });
      else if (t.x < screenWidth * this.layout.joystick.zoneWidth && !this.stick) {
        this.bindings.set(t.id, { kind: 'stick', baseX: t.x, baseY: t.y, x: t.x, y: t.y });
      }
    }
  }

  move(points: readonly TouchPoint[]): void {
    const r = this.layout.joystick.radius;
    for (const t of points) {
      const b = this.bindings.get(t.id);
      if (b?.kind !== 'stick') continue;
      b.x = t.x;
      b.y = t.y;
      // Drag the base along when the finger travels past the rim.
      const dx = b.x - b.baseX;
      const dy = b.y - b.baseY;
      const dist = Math.hypot(dx, dy);
      if (dist > r) {
        b.baseX = b.x - (dx / dist) * r;
        b.baseY = b.y - (dy / dist) * r;
      }
    }
  }

  end(points: readonly TouchPoint[]): void {
    for (const t of points) this.bindings.delete(t.id);
  }

  /** Drop bindings for fingers no longer on the screen (iOS can drop touchend events). */
  reconcile(liveIds: ReadonlySet<number>): void {
    for (const id of this.bindings.keys()) if (!liveIds.has(id)) this.bindings.delete(id);
  }

  releaseAll(): void {
    this.bindings.clear();
    this.sync();
  }

  /** Push the aggregate state of all fingers to the hub, emitting only transitions. */
  sync(): void {
    const nowHeld = new Set<ActionName>();
    for (const b of this.bindings.values()) if (b.kind === 'button') nowHeld.add(b.action);
    for (const a of nowHeld) if (!this.held.has(a)) this.hub.press(a, BUTTON_SOURCE);
    for (const a of this.held) if (!nowHeld.has(a)) this.hub.release(a, BUTTON_SOURCE);
    this.held.clear();
    for (const a of nowHeld) this.held.add(a);

    const stick = this.stick;
    if (stick) joystickOutput(stick.x - stick.baseX, stick.y - stick.baseY, this.layout.joystick, this.stickOut);
    else {
      this.stickOut.x = 0;
      this.stickOut.down = false;
    }
    this.hub.setAxis(STICK_SOURCE, this.stickOut.x);
    if (this.stickOut.down && !this.stickDown) this.hub.press('down', STICK_SOURCE);
    else if (!this.stickOut.down && this.stickDown) this.hub.release('down', STICK_SOURCE);
    this.stickDown = this.stickOut.down;
  }
}

function nearestButton(x: number, y: number, buttons: readonly ButtonHitArea[], scale: number): ButtonHitArea | undefined {
  let best: ButtonHitArea | undefined;
  let bestDist = Infinity;
  for (const b of buttons) {
    const d = Math.hypot(x - b.cx, y - b.cy);
    if (d <= b.radius * scale && d < bestDist) {
      best = b;
      bestDist = d;
    }
  }
  return best;
}
