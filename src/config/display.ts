/**
 * Rendering resolution. The game renders at a low logical resolution and is
 * scaled by an integer factor in device pixels, so pixel art stays crisp.
 * Height targets 270 px (16:9 at 480 x 270); width grows with the screen's
 * aspect ratio instead of stretching, within the min/max bounds.
 */
export const DISPLAY = {
  targetHeight: 270,
  minHeight: 216,
  maxHeight: 360,
  minWidth: 384,
  maxWidth: 640,
  tileSize: 16,
  backgroundColor: 0x07060d,
} as const;
