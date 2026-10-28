import { DEBUG_TOGGLE_KEYS, KEY_BINDINGS } from '../config/controls';
import { ACTIONS, type ActionName } from './InputActions';
import type { InputHub } from './InputHub';

/** Feeds DOM keyboard events into the input hub. */
export class KeyboardSource {
  private readonly codeToAction = new Map<string, ActionName>();

  constructor(
    private readonly hub: InputHub,
    private readonly onDebugToggle: () => void,
    private readonly target: Window = window,
  ) {
    for (const action of ACTIONS) for (const code of KEY_BINDINGS[action]) this.codeToAction.set(code, action);
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (DEBUG_TOGGLE_KEYS.includes(e.code)) {
      e.preventDefault();
      if (!e.repeat) this.onDebugToggle();
      return;
    }
    const action = this.codeToAction.get(e.code);
    if (!action) return;
    e.preventDefault();
    if (!e.repeat) this.hub.press(action, `key:${e.code}`);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    const action = this.codeToAction.get(e.code);
    if (!action) return;
    e.preventDefault();
    this.hub.release(action, `key:${e.code}`);
  };

  destroy(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
  }
}
