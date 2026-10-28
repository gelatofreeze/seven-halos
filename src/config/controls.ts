import type { ActionName } from '../input/InputActions';

/** Keyboard bindings, by `KeyboardEvent.code`. */
export const KEY_BINDINGS: Record<ActionName, readonly string[]> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'KeyK', 'KeyW', 'ArrowUp', 'KeyZ'],
  attack: ['KeyJ', 'KeyX'],
  dodge: ['KeyL', 'KeyC', 'ShiftLeft', 'ShiftRight'],
};

export const DEBUG_TOGGLE_KEYS: readonly string[] = ['Backquote', 'F3'];

export type TouchAnchor = 'bottom-left' | 'bottom-right';

export interface TouchButtonConfig {
  action: ActionName;
  label: string;
  anchor: TouchAnchor;
  /** Offset of the button centre from the anchored corner (inward), CSS px, before safe-area insets. */
  x: number;
  y: number;
  /** Diameter, CSS px. */
  size: number;
  /** Buttons in the same slide group hand a moving finger over to each other. */
  slideGroup?: string;
}

export interface TouchLayoutConfig {
  /** 'auto' shows touch controls on touch-capable devices; add ?touch=1 / ?touch=0 to force. */
  visibility: 'auto' | 'always' | 'never';
  /** Extra hit radius around each button, CSS px. */
  hitSlop: number;
  /** Minimum gap from the screen edge (added to safe-area insets), CSS px. */
  edgeMargin: number;
  idleOpacity: number;
  activeOpacity: number;
  buttons: readonly TouchButtonConfig[];
}

export const TOUCH_LAYOUT: TouchLayoutConfig = {
  visibility: 'auto',
  hitSlop: 14,
  edgeMargin: 14,
  idleOpacity: 0.42,
  activeOpacity: 0.85,
  buttons: [
    { action: 'left', label: '◀', anchor: 'bottom-left', x: 44, y: 52, size: 76, slideGroup: 'move' },
    { action: 'right', label: '▶', anchor: 'bottom-left', x: 132, y: 52, size: 76, slideGroup: 'move' },
    { action: 'jump', label: 'JUMP', anchor: 'bottom-right', x: 46, y: 50, size: 78 },
    { action: 'attack', label: 'ATK', anchor: 'bottom-right', x: 136, y: 72, size: 68 },
    { action: 'dodge', label: 'ROLL', anchor: 'bottom-right', x: 70, y: 138, size: 62 },
  ],
};
