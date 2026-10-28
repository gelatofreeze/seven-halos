import { TOUCH_LAYOUT, type TouchButtonConfig, type TouchLayoutConfig } from '../config/controls';
import type { ActionName } from './InputActions';
import type { InputHub } from './InputHub';
import { joystickOutput, type JoystickOutput } from './joystick';

const STICK_SOURCE = 'touch:stick';
const BUTTON_SOURCE = 'touch:button';

type Binding = { kind: 'stick'; baseX: number; baseY: number; x: number; y: number } | { kind: 'button'; button: ButtonState };

interface ButtonState {
  config: TouchButtonConfig;
  el: HTMLElement;
}

/**
 * Multi-touch controls as a DOM overlay above the canvas: a floating
 * joystick on the left and action buttons on the right.
 *
 * Every touch is bound when it starts (stick or nearest button) and keeps that
 * binding until it ends, so any combination of fingers works at once. On each
 * event the bindings are reconciled with `TouchEvent.touches`, which recovers
 * from touchend events iOS sometimes drops (system gestures, >5 fingers).
 * Button geometry is read at touch time, so rotation or resizing can never
 * leave stale hit areas.
 */
export class TouchControls {
  readonly root: HTMLElement;
  private readonly buttons: ButtonState[] = [];
  private readonly bindings = new Map<number, Binding>();
  private readonly heldButtons = new Set<ActionName>();
  private stickDown = false;
  private readonly stickBase: HTMLElement;
  private readonly stickKnob: HTMLElement;
  private readonly stickOut: JoystickOutput = { x: 0, down: false };
  private readonly debugDots = new Map<number, HTMLElement>();

  constructor(
    private readonly hub: InputHub,
    parent: HTMLElement,
    extraButtons: readonly { label: string; onPress: () => void }[] = [],
    private readonly showTouches: () => boolean = () => false,
    private readonly layout: TouchLayoutConfig = TOUCH_LAYOUT,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'touch-layer';
    parent.appendChild(this.root);

    const j = layout.joystick;
    this.stickBase = document.createElement('div');
    this.stickBase.className = 'touch-stick';
    this.stickBase.style.width = this.stickBase.style.height = `${j.radius * 2}px`;
    this.stickKnob = document.createElement('div');
    this.stickKnob.className = 'touch-stick-knob';
    this.stickBase.appendChild(this.stickKnob);
    this.root.appendChild(this.stickBase);
    this.placeStickAtRest();

    for (const config of layout.buttons) {
      const el = document.createElement('div');
      el.className = `touch-button touch-${config.action}`;
      el.textContent = config.label;
      el.style.width = el.style.height = `${config.size}px`;
      el.style.right = `calc(env(safe-area-inset-right, 0px) + ${layout.edgeMargin + config.x - config.size / 2}px)`;
      el.style.bottom = `calc(env(safe-area-inset-bottom, 0px) + ${layout.edgeMargin + config.y - config.size / 2}px)`;
      el.style.opacity = String(layout.idleOpacity);
      this.root.appendChild(el);
      this.buttons.push({ config, el });
    }

    // Small utility buttons (debug, fullscreen) along the top edge.
    const bar = document.createElement('div');
    bar.className = 'touch-utility-bar';
    for (const extra of extraButtons) {
      const b = document.createElement('button');
      b.className = 'touch-utility';
      b.textContent = extra.label;
      b.addEventListener('touchend', (e) => {
        e.preventDefault();
        extra.onPress();
      });
      b.addEventListener('click', extra.onPress);
      bar.appendChild(b);
    }
    parent.appendChild(bar);

    this.root.style.display = this.resolveVisibility() ? 'block' : 'none';

    const opts: AddEventListenerOptions = { passive: false };
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel'] as const) {
      this.root.addEventListener(type, this.onTouch, opts);
    }
  }

  private resolveVisibility(): boolean {
    const param = new URLSearchParams(location.search).get('touch');
    if (param === '1') return true;
    if (param === '0') return false;
    if (this.layout.visibility !== 'auto') return this.layout.visibility === 'always';
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  private placeStickAtRest(): void {
    const j = this.layout.joystick;
    const s = this.stickBase.style;
    s.left = `calc(env(safe-area-inset-left, 0px) + ${this.layout.edgeMargin + j.restX - j.radius}px)`;
    s.top = '';
    s.bottom = `calc(env(safe-area-inset-bottom, 0px) + ${this.layout.edgeMargin + j.restY - j.radius}px)`;
    s.opacity = String(this.layout.idleOpacity);
    this.stickKnob.style.transform = 'translate(-50%, -50%)';
  }

  private nearestButton(x: number, y: number): ButtonState | undefined {
    let best: ButtonState | undefined;
    let bestDist = Infinity;
    for (const b of this.buttons) {
      const r = b.el.getBoundingClientRect();
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      if (d <= (r.width / 2) * this.layout.hitRadiusScale && d < bestDist) {
        best = b;
        bestDist = d;
      }
    }
    return best;
  }

  private hasStick(): boolean {
    for (const b of this.bindings.values()) if (b.kind === 'stick') return true;
    return false;
  }

  private readonly onTouch = (e: TouchEvent): void => {
    e.preventDefault();
    const j = this.layout.joystick;

    if (e.type === 'touchstart') {
      for (const t of Array.from(e.changedTouches)) {
        if (this.bindings.has(t.identifier)) continue;
        const button = this.nearestButton(t.clientX, t.clientY);
        if (button) {
          this.bindings.set(t.identifier, { kind: 'button', button });
        } else if (t.clientX < window.innerWidth * j.zoneWidth && !this.hasStick()) {
          this.bindings.set(t.identifier, { kind: 'stick', baseX: t.clientX, baseY: t.clientY, x: t.clientX, y: t.clientY });
        }
      }
    } else if (e.type === 'touchmove') {
      for (const t of Array.from(e.changedTouches)) {
        const b = this.bindings.get(t.identifier);
        if (b?.kind !== 'stick') continue;
        b.x = t.clientX;
        b.y = t.clientY;
        // Drag the base along when the finger travels past the rim.
        const dx = b.x - b.baseX;
        const dy = b.y - b.baseY;
        const dist = Math.hypot(dx, dy);
        if (dist > j.radius) {
          b.baseX = b.x - (dx / dist) * j.radius;
          b.baseY = b.y - (dy / dist) * j.radius;
        }
      }
    } else {
      for (const t of Array.from(e.changedTouches)) this.bindings.delete(t.identifier);
    }

    // Reconcile: drop any binding whose finger is no longer on the screen.
    if (this.bindings.size > 0) {
      const live = new Set<number>();
      for (const t of Array.from(e.touches)) live.add(t.identifier);
      for (const id of this.bindings.keys()) if (!live.has(id)) this.bindings.delete(id);
    }
    this.sync();
    this.drawDebug(e);
  };

  /** Push the aggregate state of all fingers to the hub, emitting only transitions. */
  private sync(): void {
    const held = new Set<ActionName>();
    let stick: Extract<Binding, { kind: 'stick' }> | undefined;
    for (const b of this.bindings.values()) {
      if (b.kind === 'button') held.add(b.button.config.action);
      else stick = b;
    }
    for (const action of held) if (!this.heldButtons.has(action)) this.hub.press(action, BUTTON_SOURCE);
    for (const action of this.heldButtons) if (!held.has(action)) this.hub.release(action, BUTTON_SOURCE);
    this.heldButtons.clear();
    for (const action of held) this.heldButtons.add(action);

    for (const b of this.buttons) {
      const active = held.has(b.config.action);
      b.el.style.opacity = String(active ? this.layout.activeOpacity : this.layout.idleOpacity);
      b.el.classList.toggle('active', active);
    }

    const j = this.layout.joystick;
    if (stick) {
      joystickOutput(stick.x - stick.baseX, stick.y - stick.baseY, j, this.stickOut);
      const s = this.stickBase.style;
      s.left = `${stick.baseX - j.radius}px`;
      s.bottom = '';
      s.top = `${stick.baseY - j.radius}px`;
      s.opacity = String(this.layout.activeOpacity);
      this.stickKnob.style.transform = `translate(calc(-50% + ${stick.x - stick.baseX}px), calc(-50% + ${stick.y - stick.baseY}px))`;
    } else {
      this.stickOut.x = 0;
      this.stickOut.down = false;
      this.placeStickAtRest();
    }
    this.hub.setAxis(STICK_SOURCE, this.stickOut.x);
    if (this.stickOut.down && !this.stickDown) this.hub.press('down', STICK_SOURCE);
    else if (!this.stickOut.down && this.stickDown) this.hub.release('down', STICK_SOURCE);
    this.stickDown = this.stickOut.down;
  }

  /** Optional on-screen dots for every finger (debug), to diagnose device touch issues. */
  private drawDebug(e: TouchEvent): void {
    const show = this.showTouches();
    const live = new Set<number>();
    if (show) {
      for (const t of Array.from(e.touches)) {
        live.add(t.identifier);
        let dot = this.debugDots.get(t.identifier);
        if (!dot) {
          dot = document.createElement('div');
          dot.className = 'touch-debug-dot';
          this.root.appendChild(dot);
          this.debugDots.set(t.identifier, dot);
        }
        const b = this.bindings.get(t.identifier);
        dot.textContent = b ? (b.kind === 'stick' ? 'stick' : b.button.config.action) : '–';
        dot.style.left = `${t.clientX}px`;
        dot.style.top = `${t.clientY}px`;
      }
    }
    for (const [id, dot] of this.debugDots) {
      if (!live.has(id)) {
        dot.remove();
        this.debugDots.delete(id);
      }
    }
  }

  releaseAll(): void {
    this.bindings.clear();
    this.sync();
  }
}
