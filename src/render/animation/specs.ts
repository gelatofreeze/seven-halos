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

export const PLAYER_SHEET: SheetSpec = { key: 'player', frameWidth: 64, frameHeight: 48, columns: 12, frameCount: 42, footY: 44 };

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
} as const;

export const PLAYER_ANIMS: readonly AnimSpec[] = [
  { key: 'player.idle', frames: PLAYER_FRAMES.idle, fps: 5, loop: true },
  { key: 'player.run', frames: PLAYER_FRAMES.run, fps: 14, loop: true },
  { key: 'player.jump', frames: PLAYER_FRAMES.jump, fps: 10, loop: false },
  { key: 'player.fall', frames: PLAYER_FRAMES.fall, fps: 8, loop: true },
  { key: 'player.land', frames: PLAYER_FRAMES.land, fps: 20, loop: false },
  { key: 'player.hurt', frames: PLAYER_FRAMES.hurt, fps: 12, loop: false },
  { key: 'player.dead', frames: PLAYER_FRAMES.dead, fps: 3, loop: false },
];

export const SENTINEL_SHEET: SheetSpec = { key: 'sentinel', frameWidth: 96, frameHeight: 72, columns: 8, frameCount: 24, footY: 66 };

export const SENTINEL_FRAMES = {
  idle: [0, 1, 2, 3],
  walk: [4, 5, 6, 7, 8, 9],
  windup: [10, 11, 12, 13],
  strike: [14, 15],
  recover: [16, 17],
  stagger: [18, 19],
  dead: [20, 21, 22, 23],
} as const;

export const SENTINEL_ANIMS: readonly AnimSpec[] = [
  { key: 'sentinel.idle', frames: SENTINEL_FRAMES.idle, fps: 4, loop: true },
  { key: 'sentinel.walk', frames: SENTINEL_FRAMES.walk, fps: 8, loop: true },
  { key: 'sentinel.stagger', frames: SENTINEL_FRAMES.stagger, fps: 10, loop: false },
  { key: 'sentinel.dead', frames: SENTINEL_FRAMES.dead, fps: 6, loop: false },
];

/** Pick a frame from a logic-driven range using 0..1 progress. */
export function frameAt(frames: readonly number[], progress: number): number {
  const i = Math.min(frames.length - 1, Math.max(0, Math.floor(progress * frames.length)));
  return frames[i]!;
}
