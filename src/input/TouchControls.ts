import { TOUCH_LAYOUT, type TouchButtonConfig, type TouchLayoutConfig } from '../config/controls';
import { ACTIONS, type ActionName } from './InputActions';
import type { InputHub } from './InputHub';

interface ButtonState {
  config: TouchButtonConfig;
  el: HTMLElement;
  cx: number;
  cy: number;
  radius: number;
}

/**
 * Multi-touch virtual buttons rendered as a DOM overlay above the canvas.
 * Each finger is bound to the button it started on; fingers that start on a
 * slide-group button (left/right) may slide onto another button in the same
 * group. Any number of fingers can hold different buttons at once.
 */
export class TouchControls {
  readonly root: HTMLElement;
  private readonly buttons: ButtonState[] = [];
  private readonly touchToButton = new Map<number, ButtonState>();
  private readonly heldActions = new Set<ActionName>();
  private visible: boolean;

  constructor(
    private readonly hub: InputHub,
    parent: HTMLElement,
    extraButtons: readonly { label: string; onPress: () => void }[] = [],
    private readonly layout: TouchLayoutConfig = TOUCH_LAYOUT,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'touch-layer';
    parent.appendChild(this.root);

    for (const config of layout.buttons) {
      const el = document.createElement('div');
      el.className = `touch-button touch-${config.action}`;
      el.textContent = config.label;
      const offset = `${layout.edgeMargin + config.x - config.size / 2}px`;
      el.style.width = el.style.height = `${config.size}px`;
      el.style.bottom = `calc(env(safe-area-inset-bottom, 0px) + ${layout.edgeMargin + config.y - config.size / 2}px)`;
      if (config.anchor === 'bottom-left') el.style.left = `calc(env(safe-area-inset-left, 0px) + ${offset})`;
      else el.style.right = `calc(env(safe-area-inset-right, 0px) + ${offset})`;
      el.style.opacity = String(layout.idleOpacity);
      this.root.appendChild(el);
      this.buttons.push({ config, el, cx: 0, cy: 0, radius: 0 });
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

    this.visible = this.resolveVisibility();
    this.root.style.display = this.visible ? 'block' : 'none';

    const opts: AddEventListenerOptions = { passive: false };
    this.root.addEventListener('touchstart', this.onTouch, opts);
    this.root.addEventListener('touchmove', this.onTouch, opts);
    this.root.addEventListener('touchend', this.onTouchEnd, opts);
    this.root.addEventListener('touchcancel', this.onTouchEnd, opts);
    this.measure();
  }

  private resolveVisibility(): boolean {
    const param = new URLSearchParams(location.search).get('touch');
    if (param === '1') return true;
    if (param === '0') return false;
    if (this.layout.visibility !== 'auto') return this.layout.visibility === 'always';
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  /** Cache button geometry; call after any resize or orientation change. */
  measure(): void {
    for (const b of this.buttons) {
      const r = b.el.getBoundingClientRect();
      b.cx = r.left + r.width / 2;
      b.cy = r.top + r.height / 2;
      b.radius = r.width / 2 + this.layout.hitSlop;
    }
  }

  private hitTest(x: number, y: number, group?: string): ButtonState | undefined {
    let best: ButtonState | undefined;
    let bestDist = Infinity;
    for (const b of this.buttons) {
      if (group !== undefined && b.config.slideGroup !== group) continue;
      const d = Math.hypot(x - b.cx, y - b.cy);
      if (d <= b.radius && d < bestDist) {
        best = b;
        bestDist = d;
      }
    }
    return best;
  }

  private readonly onTouch = (e: TouchEvent): void => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      const current = this.touchToButton.get(t.identifier);
      if (e.type === 'touchstart') {
        const hit = this.hitTest(t.clientX, t.clientY);
        if (hit) this.touchToButton.set(t.identifier, hit);
      } else if (current?.config.slideGroup !== undefined) {
        const hit = this.hitTest(t.clientX, t.clientY, current.config.slideGroup);
        if (hit) this.touchToButton.set(t.identifier, hit);
      }
    }
    this.sync();
  };

  private readonly onTouchEnd = (e: TouchEvent): void => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) this.touchToButton.delete(t.identifier);
    this.sync();
  };

  /** Push the aggregate held state of all fingers to the hub, emitting only transitions. */
  private sync(): void {
    for (const action of ACTIONS) {
      let held = false;
      for (const b of this.touchToButton.values()) if (b.config.action === action) held = true;
      const was = this.heldActions.has(action);
      if (held && !was) {
        this.heldActions.add(action);
        this.hub.press(action, 'touch');
      } else if (!held && was) {
        this.heldActions.delete(action);
        this.hub.release(action, 'touch');
      }
    }
    for (const b of this.buttons) {
      const active = this.heldActions.has(b.config.action);
      b.el.style.opacity = String(active ? this.layout.activeOpacity : this.layout.idleOpacity);
      b.el.classList.toggle('active', active);
    }
  }

  releaseAll(): void {
    this.touchToButton.clear();
    this.sync();
  }
}
