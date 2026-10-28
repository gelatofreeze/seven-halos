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

  /** Release everything (focus loss, tab hidden, orientation change). */
  releaseAll(): void {
    for (const set of this.holders.values()) set.clear();
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
    out.moveX = left && right ? this.lastHorizontal : right ? 1 : left ? -1 : 0;
    out.down = this.isHeld('down');
    out.jumpPressed = this.consumePress('jump');
    // A tap shorter than one step still counts as held for that step (minimum hop).
    out.jumpHeld = this.isHeld('jump') || out.jumpPressed;
    out.attackPressed = this.consumePress('attack');
    out.dodgePressed = this.consumePress('dodge');
  }
}
