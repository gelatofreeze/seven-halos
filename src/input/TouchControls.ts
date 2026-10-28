import { TOUCH_LAYOUT, type TouchButtonConfig, type TouchLayoutConfig } from '../config/controls';
import type { InputHub } from './InputHub';
import { TouchRouter, type ButtonHitArea, type TouchPoint } from './TouchRouter';

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
  private readonly router: TouchRouter;
  private readonly stickBase: HTMLElement;
  private readonly stickKnob: HTMLElement;
  private readonly debugDots = new Map<number, HTMLElement>();

  constructor(
    hub: InputHub,
    parent: HTMLElement,
    extraButtons: readonly { label: string; onPress: () => void }[] = [],
    private readonly showTouches: () => boolean = () => false,
    private readonly layout: TouchLayoutConfig = TOUCH_LAYOUT,
  ) {
    this.router = new TouchRouter(hub, layout);
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

  /** Button hit circles, read from the DOM at touch time so rotation can't leave stale geometry. */
  private hitAreas(): ButtonHitArea[] {
    return this.buttons.map((b) => {
      const r = b.el.getBoundingClientRect();
      return { action: b.config.action, cx: r.left + r.width / 2, cy: r.top + r.height / 2, radius: r.width / 2 };
    });
  }

  private readonly onTouch = (e: TouchEvent): void => {
    e.preventDefault();
    const changed: TouchPoint[] = Array.from(e.changedTouches, (t) => ({ id: t.identifier, x: t.clientX, y: t.clientY }));
    if (e.type === 'touchstart') this.router.begin(changed, this.hitAreas(), window.innerWidth);
    else if (e.type === 'touchmove') this.router.move(changed);
    else this.router.end(changed);
    this.router.reconcile(new Set(Array.from(e.touches, (t) => t.identifier)));
    this.router.sync();
    this.render();
    this.drawDebug(e);
  };

  private render(): void {
    const held = this.router.heldActions;
    for (const b of this.buttons) {
      const active = held.has(b.config.action);
      b.el.style.opacity = String(active ? this.layout.activeOpacity : this.layout.idleOpacity);
      b.el.classList.toggle('active', active);
    }
    const j = this.layout.joystick;
    const stick = this.router.stick;
    if (stick) {
      const s = this.stickBase.style;
      s.left = `${stick.baseX - j.radius}px`;
      s.bottom = '';
      s.top = `${stick.baseY - j.radius}px`;
      s.opacity = String(this.layout.activeOpacity);
      this.stickKnob.style.transform = `translate(calc(-50% + ${stick.x - stick.baseX}px), calc(-50% + ${stick.y - stick.baseY}px))`;
    } else {
      this.placeStickAtRest();
    }
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
        const b = this.router.bindings.get(t.identifier);
        dot.textContent = b ? (b.kind === 'stick' ? 'stick' : b.action) : '–';
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
    this.router.releaseAll();
    this.render();
  }
}
