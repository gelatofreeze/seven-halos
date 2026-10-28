/**
 * Sprite sheet and animation specifications. These are the contract between
 * gameplay and art: final artwork must keep frame size, foot anchor and frame
 * order (or update this file and nothing else). See docs/ANIMATION.md.
 */
/** Frames are horizontally centred on the body: the feet sit at (frameWidth / 2, footY). */
export interface SheetSpec {
  key: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  frameCount: number;
  /** Pixel row of the feet inside a frame; sprites are anchored here. */
  footY: number;
}

export interface AnimSpec {
  key: string;
  frames: readonly number[];
  fps: number;
  loop: boolean;
}

export const PLAYER_SHEET: SheetSpec = { key: 'player', frameWidth: 64, frameHeight: 48, columns: 12, frameCount: 86, footY: 44 };
/**
 * The player holding the Mourning Crescent. Same frame contract as
 * `PLAYER_SHEET` (frames 0–59 redrawn with the scythe in hand) plus the
 * scythe-only attack frames 60–85.
 */
export const PLAYER_SCYTHE_SHEET: SheetSpec = { ...PLAYER_SHEET, key: 'player.scythe' };

/** Frame ranges for the player. Logic-driven ranges (dodge, attacks) are indexed by action progress, not time. */
export const PLAYER_FRAMES = {
  idle: [0, 1, 2, 3],
  run: [4, 5, 6, 7, 8, 9, 10, 11],
  jump: [12, 13],
  fall: [14, 15],
  land: [16, 17],
  dodge: [18, 19, 20, 21, 22, 23, 24, 25],
  attack1: { startup: [26, 27], active: [28, 29], recovery: [30, 31] },
  hurt: [32, 33],
  dead: [34, 35],
  attack2: { startup: [36, 37], active: [38, 39], recovery: [40, 41] },
  /** Heavy: wind-up, then the charge hold (alternating glow frames), then a two-handed overhead slam. */
  heavy: { startup: [42, 43], charge: [44, 45], active: [46, 47], recovery: [48, 49] },
  guard: [50],
  guardImpact: [51],
  parry: { startup: [52], window: [53], recovery: [54] },
  riposte: { startup: [55, 56], active: [57], recovery: [58] },
  guardBroken: [59],
  // Scythe sheet only (60–85):
  scytheLight1: { startup: [60, 61], active: [62, 63], recovery: [64] },
  scytheLight2: { startup: [65, 66], active: [67, 68], recovery: [69] },
  scytheLight3: { startup: [70, 71], active: [72, 73], recovery: [74] },
  scytheHeavy: { startup: [75, 76], charge: [77, 78], active: [79, 80], recovery: [81] },
  scytheRiposte: { startup: [82, 83], active: [84], recovery: [85] },
} as const;

export interface PhaseFrames {
  startup: readonly number[];
  active: readonly number[];
  recovery: readonly number[];
  /** Held (alternating) while charging. */
  charge?: readonly number[];
}

/** Player attack id → frames. Attacks are drawn from logic phase and progress. */
export const PLAYER_ATTACK_FRAMES: Record<string, PhaseFrames> = {
  'sword.light.1': PLAYER_FRAMES.attack1,
  'sword.light.2': PLAYER_FRAMES.attack2,
  'sword.heavy': PLAYER_FRAMES.heavy,
  'sword.riposte': PLAYER_FRAMES.riposte,
  'scythe.light.1': PLAYER_FRAMES.scytheLight1,
  'scythe.light.2': PLAYER_FRAMES.scytheLight2,
  'scythe.light.3': PLAYER_FRAMES.scytheLight3,
  'scythe.heavy': PLAYER_FRAMES.scytheHeavy,
  'scythe.riposte': PLAYER_FRAMES.scytheRiposte,
};

/** Weapon id → player sheet. */
export const WEAPON_SHEETS: Record<string, string> = {
  'pilgrim-sword': PLAYER_SHEET.key,
  'mourning-crescent': PLAYER_SCYTHE_SHEET.key,
};

/** Timed player animations; registered once per player sheet as `<sheet>.<name>`. */
export const PLAYER_ANIMS: readonly AnimSpec[] = [
  { key: 'idle', frames: PLAYER_FRAMES.idle, fps: 5, loop: true },
  { key: 'run', frames: PLAYER_FRAMES.run, fps: 14, loop: true },
  { key: 'jump', frames: PLAYER_FRAMES.jump, fps: 10, loop: false },
  { key: 'fall', frames: PLAYER_FRAMES.fall, fps: 8, loop: true },
  { key: 'land', frames: PLAYER_FRAMES.land, fps: 20, loop: false },
  { key: 'hurt', frames: PLAYER_FRAMES.hurt, fps: 12, loop: false },
  { key: 'dead', frames: PLAYER_FRAMES.dead, fps: 3, loop: false },
  { key: 'guardBroken', frames: PLAYER_FRAMES.guardBroken, fps: 1, loop: false },
];

export const SENTINEL_SHEET: SheetSpec = { key: 'sentinel', frameWidth: 96, frameHeight: 72, columns: 8, frameCount: 28, footY: 66 };

export const SENTINEL_FRAMES = {
  idle: [0, 1, 2, 3],
  walk: [4, 5, 6, 7, 8, 9],
  windup: [10, 11, 12, 13],
  strike: [14, 15],
  recover: [16, 17],
  stagger: [18, 19],
  dead: [20, 21, 22, 23],
  /** Posture broken: dropped to one knee, guard open. Also used after a parry. */
  broken: [24, 25],
  /** Riposted: thrown down, then pushing back up. */
  riposted: [26, 27],
} as const;

export const SENTINEL_ANIMS: readonly AnimSpec[] = [
  { key: 'sentinel.idle', frames: SENTINEL_FRAMES.idle, fps: 4, loop: true },
  { key: 'sentinel.walk', frames: SENTINEL_FRAMES.walk, fps: 8, loop: true },
  { key: 'sentinel.stagger', frames: SENTINEL_FRAMES.stagger, fps: 10, loop: false },
  { key: 'sentinel.dead', frames: SENTINEL_FRAMES.dead, fps: 6, loop: false },
  { key: 'sentinel.broken', frames: SENTINEL_FRAMES.broken, fps: 3, loop: true },
  { key: 'sentinel.riposted', frames: SENTINEL_FRAMES.riposted, fps: 2, loop: false },
  { key: 'sentinel.parried', frames: SENTINEL_FRAMES.stagger, fps: 6, loop: false },
];

/** Barrow Reaper — skeletal, hooded, with a long scythe. Feet at (48, 66). */
export const REAPER_SHEET: SheetSpec = { key: 'reaper', frameWidth: 96, frameHeight: 72, columns: 8, frameCount: 36, footY: 66 };

export const REAPER_FRAMES = {
  idle: [0, 1, 2, 3],
  walk: [4, 5, 6, 7, 8, 9],
  sweep: { startup: [10, 11, 12], active: [13, 14], recovery: [15, 16] },
  harvest: { startup: [17, 18, 19, 20], active: [21, 22], recovery: [23, 24] },
  stagger: [25, 26],
  broken: [27, 28],
  riposted: [29, 30],
  dead: [31, 32, 33, 34],
  retreat: [35],
} as const;

export const REAPER_ANIMS: readonly AnimSpec[] = [
  { key: 'reaper.idle', frames: REAPER_FRAMES.idle, fps: 5, loop: true },
  { key: 'reaper.walk', frames: REAPER_FRAMES.walk, fps: 12, loop: true },
  { key: 'reaper.stagger', frames: REAPER_FRAMES.stagger, fps: 10, loop: false },
  { key: 'reaper.parried', frames: REAPER_FRAMES.stagger, fps: 6, loop: false },
  { key: 'reaper.broken', frames: REAPER_FRAMES.broken, fps: 3, loop: true },
  { key: 'reaper.riposted', frames: REAPER_FRAMES.riposted, fps: 2, loop: false },
  { key: 'reaper.dead', frames: REAPER_FRAMES.dead, fps: 7, loop: false },
  { key: 'reaper.retreat', frames: REAPER_FRAMES.retreat, fps: 1, loop: false },
];

/**
 * Frame of a timed animation `elapsed` seconds after its state began.
 * Looping animations wrap; one-shots hold their last frame forever, so a
 * finished animation (death, landing) can never restart. Driven by
 * simulation state time, so it also freezes during hit-stop.
 */
export function animFrame(anim: Pick<AnimSpec, 'frames' | 'fps' | 'loop'>, elapsed: number): number {
  const n = anim.frames.length;
  const i = Math.floor(Math.max(0, elapsed) * anim.fps);
  return anim.frames[anim.loop ? i % n : Math.min(n - 1, i)]!;
}

/** Look up a timed animation by name in an animation list. */
export function findAnim(anims: readonly AnimSpec[], name: string): AnimSpec {
  const a = anims.find((x) => x.key === name || x.key.endsWith(`.${name}`));
  if (!a) throw new Error(`Missing animation: ${name}`);
  return a;
}

/** Pick a frame from a logic-driven range using 0..1 progress. */
export function frameAt(frames: readonly number[], progress: number): number {
  const i = Math.min(frames.length - 1, Math.max(0, Math.floor(progress * frames.length)));
  return frames[i]!;
}
