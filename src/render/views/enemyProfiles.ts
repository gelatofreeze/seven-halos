import { REAPER_FRAMES, REAPER_SHEET, SENTINEL_FRAMES, SENTINEL_SHEET, type PhaseFrames, type SheetSpec } from '../animation/specs';

/** Per-attack telegraph presentation. */
export interface AttackVisual {
  frames: PhaseFrames;
  /** Glint position relative to the feet (facing right) and when it flashes (startup progress). */
  glint: { x: number; y: number; from: number; to: number };
  /** Eye glow tint during this attack's wind-up (red = the dangerous, committed one). */
  eyeTint: number;
}

/** How one enemy type is drawn. Gameplay never reads this. */
export interface EnemyVisualProfile {
  sheet: SheetSpec;
  /** Animation key prefix registered for this sheet. */
  anim: string;
  /** Head height for the health/posture bar and the riposte marker, px above the feet. */
  barY: number;
  eye: { x: number; y: number; tint: number };
  attacks: Record<string, AttackVisual>;
  /** Fade-out duration after death, s. */
  deathFade: number;
}

export const ENEMY_VISUALS: Record<string, EnemyVisualProfile> = {
  'hollow-sentinel': {
    sheet: SENTINEL_SHEET,
    anim: 'sentinel',
    barY: 46,
    eye: { x: 3, y: 34, tint: 0x7ff0ff },
    deathFade: 2.5,
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
    anim: 'reaper',
    barY: 44,
    eye: { x: 2, y: 34, tint: 0x9dffb8 },
    deathFade: 1.8,
    attacks: {
      // The low sweep glints down by the blade, near the ground: a cue to jump or roll.
      'reaper.sweep': { frames: REAPER_FRAMES.sweep, glint: { x: -30, y: 14, from: 0.55, to: 0.9 }, eyeTint: 0x9dffb8 },
      // The lunge flares red overhead: big, committed, and punishable afterwards.
      'reaper.harvest': { frames: REAPER_FRAMES.harvest, glint: { x: -16, y: 64, from: 0.6, to: 0.92 }, eyeTint: 0xff5a5a },
    },
  },
};
