import { animFrame, REAPER_ANIMS, REAPER_FRAMES, REAPER_SHEET, SENTINEL_ANIMS, SENTINEL_FRAMES, SENTINEL_SHEET, type AnimSpec, type PhaseFrames, type SheetSpec } from '../animation/specs';

/** Per-attack telegraph presentation. */
export interface AttackVisual {
  frames: PhaseFrames;
  /** Glint position relative to the feet (facing right) and when it flashes (startup progress). */
  glint: { x: number; y: number; from: number; to: number };
  /** Eye glow tint during this attack's wind-up (red = the dangerous, committed one). */
  eyeTint: number;
}

/**
 * Death presentation, shared by every enemy: play the death frames once from
 * the moment of death, hold the last frame, then fade. `remains` keeps the
 * body visible (at `remainsAlpha`) instead of fading out completely.
 */
export interface DeathPresentation {
  /** Seconds after death before fading starts. */
  fadeDelay: number;
  fadeDuration: number;
  remains: boolean;
  remainsAlpha: number;
}

/** Frame and opacity `t` seconds after death. Pure, so it is unit-tested. */
export function deathPose(deathAnim: Pick<AnimSpec, 'frames' | 'fps' | 'loop'>, death: DeathPresentation, t: number): { frame: number; alpha: number } {
  const frame = animFrame({ ...deathAnim, loop: false }, t);
  const fade = Math.min(1, Math.max(0, (t - death.fadeDelay) / Math.max(0.001, death.fadeDuration)));
  const floor = death.remains ? death.remainsAlpha : 0;
  return { frame, alpha: 1 - fade * (1 - floor) };
}

/** How one enemy type is drawn. Gameplay never reads this. */
export interface EnemyVisualProfile {
  sheet: SheetSpec;
  /**
   * Timed animations by name: idle, walk, stagger, parried, broken, riposted,
   * dead, and optionally retreat. Frames are picked from simulation state time.
   */
  anims: readonly AnimSpec[];
  /** Head height for the health/posture bar and the riposte marker, px above the feet. */
  barY: number;
  eye: { x: number; y: number; tint: number };
  attacks: Record<string, AttackVisual>;
  death: DeathPresentation;
}

export const ENEMY_VISUALS: Record<string, EnemyVisualProfile> = {
  'hollow-sentinel': {
    sheet: SENTINEL_SHEET,
    anims: SENTINEL_ANIMS,
    barY: 46,
    eye: { x: 3, y: 34, tint: 0x7ff0ff },
    // Collapse (0.67 s), lie still briefly, then fade before the 4 s respawn.
    death: { fadeDelay: 1.0, fadeDuration: 1.4, remains: false, remainsAlpha: 0 },
    attacks: {
      'sentinel.cleave': {
        frames: { startup: SENTINEL_FRAMES.windup, active: SENTINEL_FRAMES.strike, recovery: SENTINEL_FRAMES.recover },
        glint: { x: -28, y: 62, from: 0.62, to: 0.9 },
        eyeTint: 0x7ff0ff,
      },
      'sentinel.cleave.delayed': {
        frames: { startup: SENTINEL_FRAMES.windup, active: SENTINEL_FRAMES.strike, recovery: SENTINEL_FRAMES.recover },
        glint: { x: -28, y: 62, from: 0.62, to: 0.9 },
        eyeTint: 0x7ff0ff,
      },
    },
  },
  'barrow-reaper': {
    sheet: REAPER_SHEET,
    anims: REAPER_ANIMS,
    barY: 44,
    eye: { x: 2, y: 34, tint: 0x9dffb8 },
    death: { fadeDelay: 0.8, fadeDuration: 1.2, remains: false, remainsAlpha: 0 },
    attacks: {
      // The low sweep glints down by the blade, near the ground: a cue to jump or roll.
      'reaper.sweep': { frames: REAPER_FRAMES.sweep, glint: { x: -30, y: 14, from: 0.55, to: 0.9 }, eyeTint: 0x9dffb8 },
      // The lunge flares red overhead: big, committed, and punishable afterwards.
      'reaper.harvest': { frames: REAPER_FRAMES.harvest, glint: { x: -16, y: 64, from: 0.6, to: 0.92 }, eyeTint: 0xff5a5a },
    },
  },
};
