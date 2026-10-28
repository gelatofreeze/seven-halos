import { createCanvas } from './canvas';

/**
 * The Oracle (placeholder), 32 x 46, facing right, feet at the bottom centre:
 * an old woman, stooped, hooded, a pale cloth tied over her eyes, white hair
 * loose over her shoulders, leaning on a staff that carries a small lantern.
 */
export function buildOracle(): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(32, 46);
  const px = (c: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  const ROBE = '#3a3858';
  const ROBE_DARK = '#28263e';
  const ROBE_LIGHT = '#4c4a6e';
  const HOOD = '#2e2c48';
  const SKIN = '#d9c6b0';
  const HAIR = '#dcdce6';
  const CLOTH = '#f0ead8';
  const STAFF = '#5a453a';
  const GOLD = '#d9b866';
  // Robe, widening to the ground, with a lit edge.
  for (let y = 16; y < 46; y++) {
    const half = 5 + Math.floor((y - 16) / 4);
    px(ROBE, 15 - half, y, half * 2, 1);
    px(ROBE_LIGHT, 15 - half, y, 1, 1);
  }
  px(ROBE_DARK, 9, 44, 14, 2);
  px(ROBE_DARK, 14, 24, 1, 20);
  // Stooped shoulders and hood, head forward (to the right).
  px(HOOD, 10, 12, 11, 7);
  px(HOOD, 12, 6, 10, 8);
  px(HOOD, 13, 5, 7, 1);
  // Face in the hood, the cloth over her eyes.
  px(SKIN, 17, 9, 5, 6);
  px(CLOTH, 16, 10, 7, 2);
  px('#c8bfa8', 16, 11, 7, 1);
  px('#b09884', 20, 13, 2, 1);
  // White hair falling from the hood.
  px(HAIR, 15, 13, 2, 9);
  px(HAIR, 20, 14, 2, 6);
  px(HAIR, 11, 15, 2, 8);
  // A small halo-ring pendant.
  px(GOLD, 17, 20, 3, 1);
  px(GOLD, 17, 22, 3, 1);
  px(GOLD, 17, 21, 1, 1);
  px(GOLD, 19, 21, 1, 1);
  // Arm and hand on the staff.
  px(ROBE_LIGHT, 21, 19, 4, 3);
  px(SKIN, 25, 19, 2, 3);
  // Staff with a little lantern hanging from the crook.
  px(STAFF, 26, 2, 2, 44);
  px(STAFF, 28, 2, 2, 2);
  px('#7a7f92', 29, 4, 1, 2);
  px('#7a7f92', 28, 6, 3, 1);
  px('#ffe2a8', 28, 7, 3, 3);
  px('#7a7f92', 28, 10, 3, 1);
  return canvas;
}
