import type { ActionName } from '../input/InputActions';

/** Keyboard bindings, by `KeyboardEvent.code`. */
export const KEY_BINDINGS: Record<ActionName, readonly string[]> = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'KeyW', 'ArrowUp', 'KeyZ'],
  attack: ['KeyJ', 'KeyX'],
  heavy: ['KeyK', 'KeyV'],
  dodge: ['KeyL', 'KeyC'],
  guard: ['ShiftLeft', 'ShiftRight', 'KeyO'],
  parry: ['KeyP', 'KeyF'],
  interact: ['KeyE', 'Enter'],
};

export const DEBUG_TOGGLE_KEYS: readonly string[] = ['Backquote', 'F3'];
/** Opens/closes the inventory. Menu actions are UI-level, not gameplay actions. */
export const MENU_TOGGLE_KEYS: readonly string[] = ['KeyI', 'Tab', 'Escape'];

/** Action buttons are anchored to the bottom-right corner (inside the safe area). */
export interface TouchButtonConfig {
  action: ActionName;
  label: string;
  /** Offset of the button centre from the bottom-right corner (inward), CSS px. */
  x: number;
  y: number;
  /** Diameter, CSS px. */
  size: number;
}

/**
 * Floating joystick: a finger landing anywhere in the left zone becomes the
 * stick's centre, so there is nothing to aim at. Dragging past the radius
 * drags the base along so the stick never "runs out".
 */
export interface JoystickConfig {
  /** Fraction of the screen width, from the left, that starts the joystick. */
  zoneWidth: number;
  /** Knob travel radius, CSS px. */
  radius: number;
  /** Fraction of the radius ignored around the centre. */
  deadzone: number;
  /** Fraction of the radius at which horizontal output reaches full speed. */
  fullTiltAt: number;
  /** Downward deflection fraction that holds "down" (drop through platforms). */
  downThreshold: number;
  /** Where the idle stick is drawn, from the bottom-left corner, CSS px. */
  restX: number;
  restY: number;
}

export interface TouchLayoutConfig {
  /** 'auto' shows touch controls on touch-capable devices; add ?touch=1 / ?touch=0 to force. */
  visibility: 'auto' | 'always' | 'never';
  /**
   * A touch in the button zone goes to the nearest button whose centre is
   * within this many radii, so slightly missed presses still count.
   */
  hitRadiusScale: number;
  /** Minimum gap from the screen edge (added to safe-area insets), CSS px. */
  edgeMargin: number;
  idleOpacity: number;
  activeOpacity: number;
  joystick: JoystickConfig;
  buttons: readonly TouchButtonConfig[];
}

export const TOUCH_LAYOUT: TouchLayoutConfig = {
  visibility: 'auto',
  hitRadiusScale: 1.3,
  edgeMargin: 14,
  idleOpacity: 0.42,
  activeOpacity: 0.85,
  joystick: {
    zoneWidth: 0.45,
    radius: 46,
    deadzone: 0.2,
    fullTiltAt: 0.6,
    downThreshold: 0.6,
    restX: 96,
    restY: 92,
  },
  // Inner arc (closest to the thumb's resting corner): jump, light attack, roll.
  // Outer arc: heavy (hold to charge), guard (hold), parry (tap).
  buttons: [
    { action: 'jump', label: 'JUMP', x: 46, y: 48, size: 76 },
    { action: 'attack', label: 'ATK', x: 132, y: 58, size: 66 },
    { action: 'dodge', label: 'ROLL', x: 60, y: 132, size: 60 },
    { action: 'heavy', label: 'HEAVY', x: 210, y: 84, size: 58 },
    { action: 'guard', label: 'GUARD', x: 140, y: 146, size: 58 },
    { action: 'parry', label: 'PARRY', x: 212, y: 166, size: 52 },
  ],
};
