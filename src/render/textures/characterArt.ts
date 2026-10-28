import { PLAYER_FRAMES, PLAYER_SHEET, REAPER_FRAMES, REAPER_SHEET, SENTINEL_FRAMES, SENTINEL_SHEET, type SheetSpec } from '../animation/specs';
import { createCanvas, quantizeAlpha } from './canvas';
import { PALETTE as C } from './palette';

/**
 * Procedural placeholder character sheets. Deliberately simple, readable
 * silhouettes that honour the final sheet contract (frame size, foot anchor,
 * frame order) so real art can replace them file-for-file.
 */
interface Pose {
  bob?: number;
  lean?: number;
  crouch?: number;
  /** Feet as [x offset from body centre, lift above ground]. */
  front?: readonly [number, number];
  back?: readonly [number, number];
  /** Weapon angle in radians: 0 points forward, positive rotates downward. */
  weapon?: number;
  reach?: number;
  /** Cape/rag flare: positive streams backward, negative lifts upward. */
  flare?: number;
  rotate?: number;
  pivot?: number;
  smear?: readonly [number, number];
  eye?: number;
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, width: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'square';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function poly(ctx: CanvasRenderingContext2D, color: string, points: readonly number[]): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0]!, points[1]!);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i]!, points[i + 1]!);
  ctx.closePath();
  ctx.fill();
}

function smearArc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, from: number, to: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r, Math.min(from, to), Math.max(from, to));
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(x, y, r - 3, Math.min(from, to) + 0.2, Math.max(from, to) - 0.1);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function withRotation(ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number, draw: () => void): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.translate(-cx, -cy);
  draw();
  ctx.restore();
}

// ---- Player: a mortal pilgrim knight --------------------------------------------------------

type WeaponArt = 'sword' | 'scythe';

/** Draw a scythe gripped at (hx, hy) pointing along angle `a`: pole with a crescent blade at the head. */
function drawScythe(ctx: CanvasRenderingContext2D, hx: number, hy: number, a: number, poleLength: number, bladeLength: number, colors: { pole: string; blade: string; edge: string }): void {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  // Perpendicular, on the "inside" of the swing.
  const px = -dy;
  const py = dx;
  const headX = hx + dx * poleLength;
  const headY = hy + dy * poleLength;
  line(ctx, hx - dx * poleLength * 0.35, hy - dy * poleLength * 0.35, headX, headY, 2, colors.pole);
  // Crescent blade: hooks back toward the wielder.
  ctx.strokeStyle = colors.blade;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(headX, headY);
  ctx.quadraticCurveTo(headX + px * bladeLength * 0.9 + dx * 3, headY + py * bladeLength * 0.9 + dy * 3, headX + px * bladeLength - dx * bladeLength * 0.55, headY + py * bladeLength - dy * bladeLength * 0.55);
  ctx.stroke();
  ctx.strokeStyle = colors.edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(headX + px * 2, headY + py * 2);
  ctx.quadraticCurveTo(headX + px * bladeLength * 0.75, headY + py * bladeLength * 0.75, headX + px * (bladeLength - 1) - dx * bladeLength * 0.45, headY + py * (bladeLength - 1) - dy * bladeLength * 0.45);
  ctx.stroke();
}

function drawKnight(ctx: CanvasRenderingContext2D, ox: number, oy: number, p: Pose, weaponArt: WeaponArt = 'sword'): void {
  const cx = ox + PLAYER_SHEET.frameWidth / 2;
  const feet = oy + PLAYER_SHEET.footY;
  const draw = () => {
    const crouch = p.crouch ?? 0;
    const bob = p.bob ?? 0;
    const lean = p.lean ?? 0;
    const hipY = feet - 11 + crouch + bob;
    const shoulderY = hipY - 10;
    const front = p.front ?? [2, 0];
    const back = p.back ?? [-2, 0];
    const flare = p.flare ?? 0;

    line(ctx, cx - 1, hipY, cx + back[0], feet - 1 - back[1], 3, C.steelDark);
    // Cape
    poly(ctx, C.capeDark, [
      cx - 2 + lean, shoulderY,
      cx + 1 + lean, shoulderY + 1,
      cx - 2, hipY + 5 - Math.max(0, -flare),
      cx - 6 - Math.max(0, flare), hipY + 4 - Math.max(0, -flare) * 2 - Math.max(0, flare) * 0.6,
    ]);
    poly(ctx, C.cape, [cx - 2 + lean, shoulderY, cx + lean, shoulderY + 1, cx - 2, hipY + 2, cx - 4 - Math.max(0, flare) * 0.6, hipY + 1 - Math.max(0, -flare)]);
    line(ctx, cx + 1, hipY, cx + front[0], feet - 1 - front[1], 3, C.steel);
    // Torso, belt, pauldron
    poly(ctx, C.steel, [cx - 4 + lean, shoulderY, cx + 4 + lean, shoulderY, cx + 3, hipY + 1, cx - 3, hipY + 1]);
    line(ctx, cx + 2 + lean * 0.7, shoulderY + 2, cx + 2, hipY - 2, 1, C.steelLight);
    ctx.fillStyle = C.steelDark;
    ctx.fillRect(Math.round(cx - 3), Math.round(hipY - 2), 7, 2);
    ctx.fillStyle = C.steelLight;
    ctx.fillRect(Math.round(cx - 1 + lean), Math.round(shoulderY - 1), 5, 3);
    // Helm with visor slit and crest
    const hx = Math.round(cx - 3 + lean);
    const hy = Math.round(shoulderY - 7);
    ctx.fillStyle = C.steelLight;
    ctx.fillRect(hx, hy, 7, 7);
    ctx.fillStyle = C.steel;
    ctx.fillRect(hx, hy + 5, 7, 2);
    ctx.fillStyle = C.visor;
    ctx.fillRect(hx + 3, hy + 2, 4, 1);
    ctx.fillStyle = C.cape;
    ctx.fillRect(hx + 1, hy - 2, 3, 2);
    ctx.fillRect(hx - 1, hy - 1, 2, 2);
    // Sword arm
    const a = p.weapon ?? 0.9;
    const reach = p.reach ?? 6;
    const sx = cx + 1 + lean;
    const sy = shoulderY + 2;
    const hxp = sx + Math.cos(a) * reach;
    const hyp = sy + Math.sin(a) * reach;
    if (weaponArt === 'scythe') {
      // Spectral, wider trail for the scythe's sweeping arcs.
      if (p.smear) smearArc(ctx, sx, sy, 25, p.smear[0], p.smear[1], '#c9ffe6');
      line(ctx, sx, sy, hxp, hyp, 2, C.steelDark);
      drawScythe(ctx, hxp, hyp, a, 18, 11, { pole: C.wood, blade: C.greatsword, edge: '#e8fff4' });
      return;
    }
    if (p.smear) smearArc(ctx, sx, sy, 20, p.smear[0], p.smear[1], '#cfeaff');
    line(ctx, sx, sy, hxp, hyp, 2, C.steelDark);
    const px = -Math.sin(a);
    const py = Math.cos(a);
    line(ctx, hxp - px * 2, hyp - py * 2, hxp + px * 2, hyp + py * 2, 1, C.hilt);
    line(ctx, hxp + Math.cos(a) * 2, hyp + Math.sin(a) * 2, hxp + Math.cos(a) * 17, hyp + Math.sin(a) * 17, 2, C.blade);
    line(ctx, hxp - Math.cos(a) * 2, hyp - Math.sin(a) * 2, hxp - Math.cos(a) * 2, hyp - Math.sin(a) * 2, 1, C.hilt);
  };
  if (p.rotate) withRotation(ctx, cx, feet - (p.pivot ?? 10), p.rotate, draw);
  else draw();
}

function playerPoses(): Map<number, Pose> {
  const poses = new Map<number, Pose>();
  const F = PLAYER_FRAMES;
  F.idle.forEach((f, i) => poses.set(f, { bob: i >= 2 ? 1 : 0, weapon: 1.0 + (i >= 2 ? 0.05 : 0), front: [3, 0], back: [-3, 0] }));
  F.run.forEach((f, i) => {
    const t = (i / F.run.length) * Math.PI * 2;
    poses.set(f, {
      bob: -Math.round(Math.abs(Math.sin(t)) * 1.5),
      lean: 2,
      front: [Math.round(Math.sin(t) * 5), Math.max(0, Math.round(Math.cos(t) * 3))],
      back: [Math.round(-Math.sin(t) * 5), Math.max(0, Math.round(-Math.cos(t) * 3))],
      weapon: 2.3,
      flare: 3,
    });
  });
  poses.set(F.jump[0], { crouch: -1, front: [3, 4], back: [-2, 2], weapon: -0.2, flare: 1 });
  poses.set(F.jump[1], { crouch: -1, front: [3, 5], back: [-3, 3], weapon: -0.4, flare: 2 });
  poses.set(F.fall[0], { front: [3, 1], back: [-3, 0], weapon: 0.4, flare: -2 });
  poses.set(F.fall[1], { front: [2, 1], back: [-4, 1], weapon: 0.5, flare: -3 });
  poses.set(F.land[0], { crouch: 4, front: [4, 0], back: [-4, 0], weapon: 1.3, lean: 2 });
  poses.set(F.land[1], { crouch: 2, front: [3, 0], back: [-3, 0], weapon: 1.1, lean: 1 });
  F.dodge.forEach((f, i) => {
    if (i === 0) poses.set(f, { crouch: 5, lean: 4, front: [5, 0], back: [-3, 0], weapon: 2.4, flare: 2 });
    else if (i === F.dodge.length - 1) poses.set(f, { crouch: 4, lean: 3, front: [4, 0], back: [-4, 0], weapon: 2.2 });
    else poses.set(f, { crouch: 8, lean: 3, front: [3, 4], back: [0, 5], weapon: 2.0, rotate: (i / (F.dodge.length - 1)) * Math.PI * 2, pivot: 8 });
  });
  const A1 = F.attack1;
  poses.set(A1.startup[0], { lean: -1, weapon: -2.0, reach: 5, front: [4, 0], back: [-4, 0] });
  poses.set(A1.startup[1], { lean: -2, weapon: -2.5, reach: 5, front: [4, 0], back: [-4, 0] });
  poses.set(A1.active[0], { lean: 3, weapon: -0.5, reach: 7, front: [6, 0], back: [-4, 0], smear: [-2.4, -0.4] });
  poses.set(A1.active[1], { lean: 3, weapon: 0.35, reach: 7, front: [6, 0], back: [-4, 0], smear: [-1.6, 0.4] });
  poses.set(A1.recovery[0], { lean: 2, weapon: 0.8, reach: 6, front: [5, 0], back: [-4, 0] });
  poses.set(A1.recovery[1], { lean: 1, weapon: 1.0, reach: 6, front: [4, 0], back: [-3, 0] });
  const A2 = F.attack2;
  poses.set(A2.startup[0], { lean: 1, weapon: 1.3, reach: 6, front: [4, 0], back: [-4, 0], crouch: 1 });
  poses.set(A2.startup[1], { lean: 2, weapon: 1.7, reach: 5, front: [5, 0], back: [-4, 0], crouch: 2 });
  poses.set(A2.active[0], { lean: 3, weapon: -0.6, reach: 7, front: [6, 0], back: [-4, 0], smear: [-0.6, 1.4] });
  poses.set(A2.active[1], { lean: 2, weapon: -1.5, reach: 7, front: [6, 0], back: [-4, 0], smear: [-1.6, 0.6] });
  poses.set(A2.recovery[0], { lean: 1, weapon: -1.1, reach: 6, front: [4, 0], back: [-3, 0] });
  poses.set(A2.recovery[1], { lean: 0, weapon: -0.3, reach: 6, front: [3, 0], back: [-3, 0] });
  poses.set(F.hurt[0], { lean: -3, weapon: 1.8, front: [2, 1], back: [-4, 0], flare: 3 });
  poses.set(F.hurt[1], { lean: -2, weapon: 1.5, front: [3, 0], back: [-4, 0], flare: 2 });
  poses.set(F.dead[0], { crouch: 6, lean: 3, weapon: 1.9, front: [4, 0], back: [-3, 0] });
  poses.set(F.dead[1], { crouch: 3, weapon: 1.6, front: [3, 0], back: [-3, 0], rotate: -Math.PI / 2, pivot: 1 });
  // Heavy: big wind-up behind the head, a hold, then a two-handed overhead slam into the ground.
  const H = F.heavy;
  poses.set(H.startup[0], { lean: -2, crouch: 1, weapon: -2.4, reach: 4, front: [5, 0], back: [-5, 0], flare: 1 });
  poses.set(H.startup[1], { lean: -3, crouch: 2, weapon: -2.9, reach: 4, front: [5, 0], back: [-6, 0], flare: 2 });
  poses.set(H.charge[0], { lean: -3, crouch: 3, weapon: -3.05, reach: 4, front: [6, 0], back: [-6, 0], flare: 2 });
  poses.set(H.charge[1], { lean: -3, crouch: 3, weapon: -3.0, reach: 4, front: [6, 0], back: [-6, 0], flare: 3 });
  poses.set(H.active[0], { lean: 4, crouch: 2, weapon: -1.0, reach: 8, front: [7, 0], back: [-5, 0], smear: [-2.9, -0.6], flare: 3 });
  poses.set(H.active[1], { lean: 5, crouch: 5, weapon: 0.9, reach: 8, front: [7, 0], back: [-6, 0], smear: [-1.8, 1.0], flare: 2 });
  poses.set(H.recovery[0], { lean: 5, crouch: 6, weapon: 1.25, reach: 8, front: [7, 0], back: [-6, 0] });
  poses.set(H.recovery[1], { lean: 3, crouch: 3, weapon: 1.15, reach: 7, front: [5, 0], back: [-5, 0] });
  // Guard: blade raised across the body.
  poses.set(F.guard[0], { lean: -1, crouch: 2, weapon: -1.25, reach: 4, front: [4, 0], back: [-5, 0] });
  poses.set(F.guardImpact[0], { lean: -3, crouch: 3, weapon: -1.45, reach: 3, front: [3, 0], back: [-6, 0], flare: 2 });
  // Parry: a quick outward flick of the blade.
  poses.set(F.parry.startup[0], { lean: -1, weapon: -0.4, reach: 4, front: [4, 0], back: [-4, 0] });
  poses.set(F.parry.window[0], { lean: 2, weapon: -1.1, reach: 7, front: [5, 0], back: [-4, 0], smear: [-1.6, -0.2] });
  poses.set(F.parry.recovery[0], { lean: 3, weapon: -1.6, reach: 7, front: [5, 0], back: [-4, 0] });
  // Riposte: draw back, then a full-length thrust.
  poses.set(F.riposte.startup[0], { lean: -2, crouch: 2, weapon: 0.1, reach: 2, front: [5, 0], back: [-5, 0] });
  poses.set(F.riposte.startup[1], { lean: -3, crouch: 3, weapon: 0.05, reach: 1, front: [5, 0], back: [-6, 0], flare: 2 });
  poses.set(F.riposte.active[0], { lean: 6, crouch: 3, weapon: 0.05, reach: 10, front: [9, 0], back: [-6, 0], flare: 4 });
  poses.set(F.riposte.recovery[0], { lean: 3, crouch: 2, weapon: 0.6, reach: 8, front: [6, 0], back: [-5, 0] });
  poses.set(F.guardBroken[0], { lean: -4, crouch: 3, weapon: 2.1, reach: 6, front: [2, 1], back: [-6, 0], flare: 4 });
  return poses;
}

/**
 * Scythe variant: the same base poses with the weapon carried upright or
 * shouldered (so the crescent reads clearly), plus the scythe's own attacks.
 */
function playerScythePoses(): Map<number, Pose> {
  const poses = playerPoses();
  const F = PLAYER_FRAMES;
  const carry = (frames: readonly number[], weapon: number, reach = 5) => {
    for (const f of frames) poses.set(f, { ...poses.get(f)!, weapon, reach });
  };
  carry(F.idle, -1.25);
  carry(F.run, -2.35, 4);
  carry(F.jump, -1.6);
  carry(F.fall, -1.3);
  carry(F.land, -0.9);
  carry(F.hurt, -2.2);
  carry(F.guard, -1.45, 4);
  carry(F.guardImpact, -1.6, 3);
  const set = (f: number, pose: Pose) => poses.set(f, { front: [4, 0], back: [-4, 0], reach: 6, ...pose });
  // Light 1: high-to-low forward sweep.
  set(60, { lean: -2, weapon: -2.4 });
  set(61, { lean: -3, weapon: -2.75, crouch: 1 });
  set(62, { lean: 3, weapon: -0.9, smear: [-2.6, -0.6], front: [6, 0] });
  set(63, { lean: 4, weapon: 0.5, smear: [-1.4, 0.8], front: [7, 0] });
  set(64, { lean: 2, weapon: 0.95, front: [5, 0] });
  // Light 2: returning backswing that also covers behind.
  set(65, { lean: 3, weapon: 0.8 });
  set(66, { lean: 4, weapon: 1.2, crouch: 2 });
  set(67, { lean: -1, weapon: 2.4, smear: [0.6, 2.7] });
  set(68, { lean: -2, weapon: 3.0, smear: [1.4, 3.1], back: [-6, 0] });
  set(69, { lean: -1, weapon: 2.6 });
  // Light 3: a full spin.
  set(70, { crouch: 3, weapon: -2.8, lean: -2 });
  set(71, { crouch: 4, weapon: 2.8, lean: -1, flare: 3 });
  set(72, { lean: 3, weapon: -0.3, smear: [-3.1, 0.3], crouch: 2, flare: 4 });
  set(73, { lean: -2, weapon: 2.9, smear: [0.3, 3.1], crouch: 2, flare: -3 });
  set(74, { crouch: 2, weapon: 1.1 });
  // Heavy: raised high, then a ground-splitting harvest arc.
  set(75, { lean: -3, weapon: -2.0, reach: 5 });
  set(76, { lean: -4, weapon: -2.5, crouch: 2, reach: 5 });
  set(77, { lean: -4, weapon: -2.7, crouch: 3, reach: 5, flare: 2 });
  set(78, { lean: -4, weapon: -2.75, crouch: 3, reach: 5, flare: 3 });
  set(79, { lean: 5, weapon: -0.4, smear: [-2.9, -0.2], crouch: 3, front: [7, 0] });
  set(80, { lean: 6, weapon: 1.0, smear: [-1.6, 1.2], crouch: 6, front: [8, 0] });
  set(81, { lean: 5, weapon: 1.3, crouch: 6, front: [7, 0] });
  // Riposte: hook the staggered enemy and draw the blade through.
  set(82, { lean: -2, weapon: -1.8 });
  set(83, { lean: -3, weapon: -2.2, crouch: 2 });
  set(84, { lean: 6, weapon: 0.6, smear: [-2.2, 0.8], crouch: 4, front: [8, 0] });
  set(85, { lean: 3, weapon: 1.1, crouch: 2 });
  return poses;
}

// ---- Barrow Reaper: a hooded skeleton with a long scythe -------------------------------------

const BONE = '#d9d3c1';
const BONE_DARK = '#9a9282';
const SHROUD = '#2a2140';
const SHROUD_LIGHT = '#43356a';
const REAPER_EYE = '#9dffb8';

function drawReaper(ctx: CanvasRenderingContext2D, ox: number, oy: number, p: Pose): void {
  const cx = ox + REAPER_SHEET.frameWidth / 2;
  const feet = oy + REAPER_SHEET.footY;
  const draw = () => {
    const crouch = p.crouch ?? 0;
    const lean = p.lean ?? 0;
    const hipY = feet - 13 + crouch + (p.bob ?? 0);
    const shoulderY = hipY - 12;
    const front = p.front ?? [3, 0];
    const back = p.back ?? [-3, 0];
    const flare = p.flare ?? 0;
    // Bony legs
    line(ctx, cx - 1, hipY, cx + back[0], feet - 1 - back[1], 2, BONE_DARK);
    line(ctx, cx + 1, hipY, cx + front[0], feet - 1 - front[1], 2, BONE);
    // Tattered shroud from shoulders to knees, ragged hem streaming back.
    poly(ctx, SHROUD, [
      cx - 5 + lean, shoulderY - 1,
      cx + 4 + lean, shoulderY - 1,
      cx + 5, hipY + 4,
      cx + 2, hipY + 8,
      cx - 1, hipY + 5,
      cx - 4 - flare, hipY + 9 - Math.max(0, -flare) * 2,
      cx - 8 - flare * 1.5, hipY + 4 - Math.max(0, -flare) * 3,
    ]);
    // Ribcage glimpsed through the shroud
    for (let i = 0; i < 3; i++) line(ctx, cx - 2 + lean * 0.8, shoulderY + 2 + i * 3, cx + 3 + lean * 0.8, shoulderY + 2 + i * 3, 1, BONE_DARK);
    line(ctx, cx + lean * 0.5, shoulderY, cx, hipY, 1, BONE);
    // Hood and skull
    const hx = Math.round(cx - 4 + lean * 1.2);
    const hy = Math.round(shoulderY - 10);
    ctx.fillStyle = SHROUD_LIGHT;
    ctx.fillRect(hx - 1, hy - 1, 10, 10);
    ctx.fillStyle = BONE;
    ctx.fillRect(hx + 2, hy + 2, 6, 6);
    ctx.fillStyle = '#0b0a12';
    ctx.fillRect(hx + 3, hy + 3, 2, 2);
    ctx.fillRect(hx + 6, hy + 3, 1, 2);
    ctx.fillRect(hx + 4, hy + 7, 3, 1);
    if ((p.eye ?? 1) > 0) {
      ctx.fillStyle = (p.eye ?? 1) > 1 ? '#ffffff' : REAPER_EYE;
      ctx.fillRect(hx + 6, hy + 3, 1, 1);
      ctx.fillRect(hx + 3, hy + 3, 1, 1);
    }
    // Arms and the long scythe
    const a = p.weapon ?? -1.3;
    const reach = p.reach ?? 6;
    const sx = cx + 1 + lean;
    const sy = shoulderY + 3;
    const handX = sx + Math.cos(a) * reach;
    const handY = sy + Math.sin(a) * reach;
    if (p.smear) smearArc(ctx, sx, sy, 34, p.smear[0], p.smear[1], '#b6ffd0');
    line(ctx, sx - 3, sy, handX, handY, 1, BONE_DARK);
    line(ctx, sx + 2, sy - 1, handX, handY, 1, BONE);
    drawScythe(ctx, handX, handY, a, 26, 17, { pole: '#4a3a2e', blade: '#aeb8c0', edge: '#eef7ff' });
  };
  if (p.rotate) withRotation(ctx, cx, feet - (p.pivot ?? 12), p.rotate, draw);
  else draw();
}

function reaperPoses(): Map<number, Pose> {
  const poses = new Map<number, Pose>();
  const F = REAPER_FRAMES;
  F.idle.forEach((f, i) => poses.set(f, { bob: i === 1 || i === 2 ? -1 : 0, weapon: -1.3, flare: i % 2 === 0 ? 1 : 2 }));
  F.walk.forEach((f, i) => {
    const t = (i / F.walk.length) * Math.PI * 2;
    poses.set(f, {
      lean: 3,
      bob: Math.round(Math.sin(t)),
      front: [Math.round(Math.sin(t) * 5), Math.max(0, Math.round(Math.cos(t) * 2))],
      back: [Math.round(-Math.sin(t) * 5), Math.max(0, Math.round(-Math.cos(t) * 2))],
      weapon: -1.0,
      flare: 3 + (i % 2),
    });
  });
  // Low Reap: blade drawn back low behind, then swept along the ground.
  const S = F.sweep;
  poses.set(S.startup[0], { lean: -1, crouch: 2, weapon: 2.5, front: [5, 0], back: [-5, 0], eye: 1 });
  poses.set(S.startup[1], { lean: -2, crouch: 4, weapon: 2.75, front: [6, 0], back: [-6, 0], eye: 2 });
  poses.set(S.startup[2], { lean: -3, crouch: 5, weapon: 2.95, front: [6, 0], back: [-7, 0], eye: 2 });
  poses.set(S.active[0], { lean: 3, crouch: 5, weapon: 1.1, smear: [0.5, 2.9], front: [8, 0], back: [-6, 0], eye: 2 });
  poses.set(S.active[1], { lean: 5, crouch: 4, weapon: 0.15, smear: [0.1, 2.2], front: [9, 0], back: [-6, 0], eye: 2 });
  poses.set(S.recovery[0], { lean: 4, crouch: 3, weapon: -0.2, front: [7, 0], back: [-5, 0] });
  poses.set(S.recovery[1], { lean: 2, crouch: 1, weapon: -0.8, front: [5, 0], back: [-4, 0] });
  // Harvest Lunge: deep crouch with the scythe raised behind, then a gliding chop that sticks.
  const H = F.harvest;
  H.startup.forEach((f, i) => poses.set(f, { lean: -2 - i, crouch: 4 + i * 1.5, weapon: -2.1 - i * 0.25, front: [7, 0], back: [-7, 0], flare: 2, eye: i >= 2 ? 2 : 1 }));
  poses.set(H.active[0], { lean: 7, crouch: 3, weapon: -0.6, smear: [-2.9, -0.4], front: [10, 0], back: [-8, 2], flare: 5, eye: 2 });
  poses.set(H.active[1], { lean: 7, crouch: 5, weapon: 1.2, smear: [-1.5, 1.3], front: [10, 0], back: [-8, 0], flare: 4, eye: 2 });
  poses.set(H.recovery[0], { lean: 6, crouch: 8, weapon: 1.45, front: [9, 0], back: [-7, 0] });
  poses.set(H.recovery[1], { lean: 5, crouch: 7, weapon: 1.4, front: [8, 0], back: [-6, 0] });
  poses.set(F.stagger[0], { lean: -5, weapon: -2.1, front: [2, 2], back: [-7, 0], flare: 5 });
  poses.set(F.stagger[1], { lean: -3, crouch: 2, weapon: -1.8, front: [3, 0], back: [-6, 0], flare: 3 });
  poses.set(F.broken[0], { lean: 3, crouch: 9, weapon: 1.8, front: [7, 0], back: [-3, 4] });
  poses.set(F.broken[1], { lean: 3, crouch: 10, weapon: 1.85, front: [7, 0], back: [-3, 4] });
  poses.set(F.riposted[0], { crouch: 8, weapon: 1.6, front: [6, 0], back: [-6, 0], rotate: -1.0, pivot: 3, eye: 0 });
  poses.set(F.riposted[1], { lean: 2, crouch: 8, weapon: 1.7, front: [6, 0], back: [-4, 3] });
  poses.set(F.dead[0], { lean: -3, crouch: 5, weapon: 2.0, eye: 0 });
  poses.set(F.dead[1], { crouch: 10, weapon: 1.8, eye: 0 });
  poses.set(F.dead[2], { crouch: 10, weapon: 1.6, rotate: -0.8, pivot: 3, eye: 0 });
  poses.set(F.dead[3], { crouch: 10, weapon: 1.5, rotate: -1.45, pivot: 2, eye: 0 });
  poses.set(F.retreat[0], { lean: -5, crouch: 1, weapon: -1.5, front: [2, 4], back: [-6, 0], flare: -3 });
  return poses;
}

// ---- Hollow Sentinel: an empty suit of armour with a cold eye -----------------------------

function drawSentinel(ctx: CanvasRenderingContext2D, ox: number, oy: number, p: Pose): void {
  const cx = ox + SENTINEL_SHEET.frameWidth / 2;
  const feet = oy + SENTINEL_SHEET.footY;
  const draw = () => {
    const crouch = p.crouch ?? 0;
    const lean = p.lean ?? 0;
    const hipY = feet - 14 + crouch + (p.bob ?? 0);
    const shoulderY = hipY - 15;
    const front = p.front ?? [4, 0];
    const back = p.back ?? [-4, 0];
    line(ctx, cx - 2, hipY, cx + back[0], feet - 2 - back[1], 5, C.huskDark);
    line(ctx, cx + 2, hipY, cx + front[0], feet - 2 - front[1], 5, C.husk);
    // Tattered skirt
    const flare = p.flare ?? 0;
    poly(ctx, C.rag, [cx - 7, hipY - 2, cx + 7, hipY - 2, cx + 6, hipY + 7, cx + 2, hipY + 5, cx - 1, hipY + 8, cx - 5 - flare, hipY + 6, cx - 8 - flare, hipY + 3]);
    // Torso
    poly(ctx, C.husk, [cx - 8 + lean, shoulderY, cx + 8 + lean, shoulderY, cx + 6, hipY, cx - 6, hipY]);
    poly(ctx, C.huskDark, [cx - 2 + lean, shoulderY + 3, cx + 3 + lean, shoulderY + 3, cx + 1, hipY - 3, cx - 1, hipY - 3]);
    line(ctx, cx + 5 + lean, shoulderY + 1, cx + 4, hipY - 1, 1, C.huskLight);
    // Pauldrons
    ctx.fillStyle = C.huskLight;
    ctx.fillRect(Math.round(cx - 10 + lean), Math.round(shoulderY - 2), 6, 4);
    ctx.fillRect(Math.round(cx + 4 + lean), Math.round(shoulderY - 2), 7, 4);
    // Great helm with a single cold eye
    const hx = Math.round(cx - 4 + lean * 1.2);
    const hy = Math.round(shoulderY - 10);
    ctx.fillStyle = C.husk;
    ctx.fillRect(hx, hy, 10, 10);
    ctx.fillStyle = C.huskLight;
    ctx.fillRect(hx, hy, 10, 2);
    ctx.fillStyle = C.visor;
    ctx.fillRect(hx + 3, hy + 4, 7, 2);
    ctx.fillStyle = (p.eye ?? 1) > 1 ? '#ffffff' : C.eye;
    ctx.fillRect(hx + 6, hy + 4, 2, 2);
    // Greatsword held two-handed
    const a = p.weapon ?? 1.1;
    const reach = p.reach ?? 8;
    const sx = cx + 2 + lean;
    const sy = shoulderY + 4;
    const hxp = sx + Math.cos(a) * reach;
    const hyp = sy + Math.sin(a) * reach;
    if (p.smear) smearArc(ctx, sx, sy, 30, p.smear[0], p.smear[1], '#b9f4ff');
    line(ctx, sx - 4, sy, hxp, hyp, 3, C.huskDark);
    line(ctx, sx + 3, sy - 1, hxp, hyp, 3, C.husk);
    const px = -Math.sin(a);
    const py = Math.cos(a);
    line(ctx, hxp - px * 4, hyp - py * 4, hxp + px * 4, hyp + py * 4, 2, C.iron);
    line(ctx, hxp + Math.cos(a) * 3, hyp + Math.sin(a) * 3, hxp + Math.cos(a) * 32, hyp + Math.sin(a) * 32, 4, C.greatsword);
    line(ctx, hxp + Math.cos(a) * 4 + px, hyp + Math.sin(a) * 4 + py, hxp + Math.cos(a) * 30 + px, hyp + Math.sin(a) * 30 + py, 1, C.steelLight);
  };
  if (p.rotate) withRotation(ctx, cx, feet - (p.pivot ?? 14), p.rotate, draw);
  else draw();
}

function sentinelPoses(): Map<number, Pose> {
  const poses = new Map<number, Pose>();
  const F = SENTINEL_FRAMES;
  F.idle.forEach((f, i) => poses.set(f, { bob: i === 1 || i === 2 ? 1 : 0, weapon: 1.25, front: [5, 0], back: [-5, 0] }));
  F.walk.forEach((f, i) => {
    const t = (i / F.walk.length) * Math.PI * 2;
    poses.set(f, {
      bob: Math.abs(Math.sin(t)) > 0.7 ? -1 : 0,
      lean: 1,
      front: [Math.round(Math.sin(t) * 6), Math.max(0, Math.round(Math.cos(t) * 3))],
      back: [Math.round(-Math.sin(t) * 6), Math.max(0, Math.round(-Math.cos(t) * 3))],
      weapon: 1.3,
      flare: 1,
    });
  });
  F.windup.forEach((f, i) => poses.set(f, { lean: -1 - i, crouch: i === 3 ? 2 : 0, weapon: -1.6 - i * 0.35, reach: 7, front: [6, 0], back: [-6, 0], eye: i >= 2 ? 2 : 1 }));
  poses.set(F.strike[0], { lean: 4, crouch: 2, weapon: -0.2, reach: 10, front: [9, 0], back: [-6, 0], smear: [-2.6, -0.2], eye: 2 });
  poses.set(F.strike[1], { lean: 5, crouch: 4, weapon: 0.75, reach: 10, front: [9, 0], back: [-7, 0], smear: [-1.4, 0.8], eye: 2 });
  poses.set(F.recover[0], { lean: 4, crouch: 5, weapon: 1.0, reach: 9, front: [8, 0], back: [-7, 0] });
  poses.set(F.recover[1], { lean: 2, crouch: 3, weapon: 1.15, reach: 9, front: [7, 0], back: [-6, 0] });
  poses.set(F.stagger[0], { lean: -4, weapon: 2.0, reach: 6, front: [3, 2], back: [-7, 0], flare: 3 });
  poses.set(F.stagger[1], { lean: -3, crouch: 2, weapon: 1.8, reach: 7, front: [4, 0], back: [-6, 0], flare: 2 });
  poses.set(F.dead[0], { lean: -3, crouch: 4, weapon: 1.9, front: [4, 0], back: [-5, 0], eye: 0 });
  poses.set(F.dead[1], { crouch: 9, weapon: 1.7, front: [6, 0], back: [-6, 0], eye: 0 });
  poses.set(F.dead[2], { crouch: 9, weapon: 1.5, front: [6, 0], back: [-6, 0], rotate: -0.8, pivot: 3, eye: 0 });
  poses.set(F.dead[3], { crouch: 9, weapon: 1.4, front: [6, 0], back: [-6, 0], rotate: -1.45, pivot: 2, eye: 0 });
  poses.set(F.broken[0], { lean: 3, crouch: 9, weapon: 1.9, reach: 6, front: [7, 0], back: [-3, 4], eye: 1 });
  poses.set(F.broken[1], { lean: 3, crouch: 10, weapon: 1.95, reach: 6, front: [7, 0], back: [-3, 4], eye: 1 });
  poses.set(F.riposted[0], { crouch: 9, weapon: 1.6, front: [6, 0], back: [-6, 0], rotate: -0.9, pivot: 3, eye: 0 });
  poses.set(F.riposted[1], { lean: 2, crouch: 8, weapon: 1.7, front: [6, 0], back: [-4, 3], eye: 1 });
  return poses;
}

function buildSheet(spec: SheetSpec, poses: Map<number, Pose>, draw: (ctx: CanvasRenderingContext2D, ox: number, oy: number, p: Pose) => void): HTMLCanvasElement {
  const rows = Math.ceil(spec.frameCount / spec.columns);
  const { canvas, ctx } = createCanvas(spec.columns * spec.frameWidth, rows * spec.frameHeight);
  for (let f = 0; f < spec.frameCount; f++) {
    const pose = poses.get(f);
    if (!pose) continue;
    const ox = (f % spec.columns) * spec.frameWidth;
    const oy = Math.floor(f / spec.columns) * spec.frameHeight;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, spec.frameWidth, spec.frameHeight);
    ctx.clip();
    draw(ctx, ox, oy, pose);
    ctx.restore();
  }
  quantizeAlpha(ctx, canvas.width, canvas.height);
  return canvas;
}

export function buildPlayerSheet(): HTMLCanvasElement {
  return buildSheet(PLAYER_SHEET, playerPoses(), (ctx, ox, oy, p) => drawKnight(ctx, ox, oy, p, 'sword'));
}

export function buildPlayerScytheSheet(): HTMLCanvasElement {
  return buildSheet(PLAYER_SHEET, playerScythePoses(), (ctx, ox, oy, p) => drawKnight(ctx, ox, oy, p, 'scythe'));
}

export function buildReaperSheet(): HTMLCanvasElement {
  return buildSheet(REAPER_SHEET, reaperPoses(), drawReaper);
}

export function buildSentinelSheet(): HTMLCanvasElement {
  return buildSheet(SENTINEL_SHEET, sentinelPoses(), drawSentinel);
}
