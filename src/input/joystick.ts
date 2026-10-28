import type { JoystickConfig } from '../config/controls';

export interface JoystickOutput {
  /** Horizontal axis, -1..1. */
  x: number;
  down: boolean;
}

/**
 * Map a knob offset (CSS px from the stick centre) to gameplay input.
 * Horizontal output ramps from 0 at the deadzone to full at `fullTiltAt`,
 * so most deliberate pushes are full speed (platforming wants commitment)
 * while small nudges still allow careful positioning.
 */
export function joystickOutput(dx: number, dy: number, cfg: JoystickConfig, out: JoystickOutput): JoystickOutput {
  const nx = dx / cfg.radius;
  const ny = dy / cfg.radius;
  const ax = Math.abs(nx);
  if (ax <= cfg.deadzone) out.x = 0;
  else out.x = Math.sign(nx) * Math.min(1, (ax - cfg.deadzone) / Math.max(1e-6, cfg.fullTiltAt - cfg.deadzone));
  // Down only when the push is mostly downward, so running never drops you through platforms.
  out.down = ny >= cfg.downThreshold && ny > ax;
  return out;
}
