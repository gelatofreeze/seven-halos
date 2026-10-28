import { ACTIONS, type ActionName, type InputFrame, type InputProvider } from './InputActions';

/**
 * Aggregates every input device into logical action state. Devices call
 * `press`/`release` with a source key (e.g. "key:Space", "touch"); an action
 * is held while any source holds it. Presses are counted, so a tap that
 * starts and ends between two simulation steps is still delivered once.
 */
export class InputHub implements InputProvider {
  private readonly holders = new Map<ActionName, Set<string>>();
  private readonly pressCount = new Map<ActionName, number>();
  private readonly consumedCount = new Map<ActionName, number>();
  /** Most recently pressed horizontal direction, so left+right resolves to the newest. */
  private lastHorizontal: -1 | 1 = 1;
  /** Analog horizontal axes (-1..1) per source, e.g. the touch joystick. */
  private readonly axes = new Map<string, number>();

  constructor() {
    for (const action of ACTIONS) {
      this.holders.set(action, new Set());
      this.pressCount.set(action, 0);
      this.consumedCount.set(action, 0);
    }
  }

  press(action: ActionName, source: string): void {
    const set = this.holders.get(action)!;
    if (set.has(source)) return;
    const wasHeld = set.size > 0;
    set.add(source);
    if (!wasHeld) {
      this.pressCount.set(action, this.pressCount.get(action)! + 1);
      if (action === 'left') this.lastHorizontal = -1;
      else if (action === 'right') this.lastHorizontal = 1;
    }
  }

  release(action: ActionName, source: string): void {
    this.holders.get(action)!.delete(source);
  }

  /** A momentary press (e.g. the on-screen interaction prompt): delivered once, never left held. */
  tap(action: ActionName, source: string): void {
    this.press(action, source);
    this.release(action, source);
  }

  /** Set an analog horizontal axis for a source; 0 means "not steering". */
  setAxis(source: string, value: number): void {
    if (value === 0) this.axes.delete(source);
    else this.axes.set(source, Math.max(-1, Math.min(1, value)));
  }

  /** Release everything (focus loss, tab hidden, orientation change). */
  releaseAll(): void {
    for (const set of this.holders.values()) set.clear();
    this.axes.clear();
  }

  /**
   * Drop presses that haven't been sampled yet, so a tap made just before a
   * menu opened (or while it was open) never fires after it closes.
   */
  discardPendingPresses(): void {
    for (const action of ACTIONS) this.consumedCount.set(action, this.pressCount.get(action)!);
  }

  isHeld(action: ActionName): boolean {
    return this.holders.get(action)!.size > 0;
  }

  private consumePress(action: ActionName): boolean {
    const pressed = this.pressCount.get(action)!;
    if (pressed === this.consumedCount.get(action)) return false;
    this.consumedCount.set(action, pressed);
    return true;
  }

  sample(out: InputFrame): void {
    const left = this.isHeld('left');
    const right = this.isHeld('right');
    let axis = 0;
    for (const v of this.axes.values()) if (Math.abs(v) > Math.abs(axis)) axis = v;
    // Digital directions (keys) win over an analog axis when both are active.
    out.moveX = left && right ? this.lastHorizontal : right ? 1 : left ? -1 : axis;
    out.down = this.isHeld('down');
    out.jumpPressed = this.consumePress('jump');
    // A tap shorter than one step still counts as held for that step (minimum hop).
    out.jumpHeld = this.isHeld('jump') || out.jumpPressed;
    out.attackPressed = this.consumePress('attack');
    out.heavyPressed = this.consumePress('heavy');
    out.heavyHeld = this.isHeld('heavy') || out.heavyPressed;
    out.dodgePressed = this.consumePress('dodge');
    out.guardHeld = this.isHeld('guard');
    out.parryPressed = this.consumePress('parry');
    out.interactPressed = this.consumePress('interact');
  }
}
