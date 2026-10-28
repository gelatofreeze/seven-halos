/** Logical gameplay actions. Devices map to these; gameplay never sees raw keys or touches. */
export const ACTIONS = ['left', 'right', 'down', 'jump', 'attack', 'heavy', 'dodge', 'guard', 'parry'] as const;
export type ActionName = (typeof ACTIONS)[number];

/** Input snapshot consumed by one fixed simulation step. */
export interface InputFrame {
  /** -1..1. Keys give -1, 0 or 1; the touch joystick can give partial values. */
  moveX: number;
  down: boolean;
  jumpHeld: boolean;
  jumpPressed: boolean;
  attackPressed: boolean;
  /** Heavy attack: press starts it, holding charges it. */
  heavyPressed: boolean;
  heavyHeld: boolean;
  dodgePressed: boolean;
  guardHeld: boolean;
  parryPressed: boolean;
}

export function createInputFrame(): InputFrame {
  return {
    moveX: 0,
    down: false,
    jumpHeld: false,
    jumpPressed: false,
    attackPressed: false,
    heavyPressed: false,
    heavyHeld: false,
    dodgePressed: false,
    guardHeld: false,
    parryPressed: false,
  };
}

/** Anything that can fill an input frame for the next simulation step. */
export interface InputProvider {
  sample(out: InputFrame): void;
}
