import Phaser from 'phaser';
import { TEX } from '../textures/registerTextures';

/**
 * Lightweight, layered environmental lighting: no lighting engine, just a few
 * additive sprites per light, in fixed depth bands:
 * - glow  (behind the tiles): the bright core around the source;
 * - spill (over the tiles, under characters): a wide, faint pool that warms
 *   nearby stone and floor;
 * - halo  (optional second tint, e.g. a shrine's pale divine light).
 * Flames are a cycling sprite; embers a sparse particle stream. Everything is
 * cosmetic and driven by render time, never by the simulation.
 */
export interface LightPreset {
  tint: number;
  glow: { alpha: number; scale: number };
  spill?: { alpha: number; scale: number };
  halo?: { tint: number; alpha: number; scale: number };
  /** Fast fire flicker amount, 0..1. */
  flicker: number;
  /** Slow breathing, Hz (sacred and magical lights). */
  pulse?: number;
  flame?: boolean;
  /** Ember spawn interval, ms (sparse on purpose). */
  embers?: number;
}

export const LIGHT_PRESETS = {
  brazier: { tint: 0xff9a40, glow: { alpha: 0.5, scale: 1.4 }, spill: { alpha: 0.2, scale: 4.6 }, flicker: 0.16, flame: true, embers: 260 },
  torch: { tint: 0xffa050, glow: { alpha: 0.42, scale: 1.1 }, spill: { alpha: 0.16, scale: 3.6 }, flicker: 0.18, flame: true, embers: 520 },
  shrine: { tint: 0xe8c77a, glow: { alpha: 0.5, scale: 1.6 }, spill: { alpha: 0.18, scale: 4.2 }, halo: { tint: 0x9fb6ff, alpha: 0.22, scale: 3.2 }, flicker: 0.03, pulse: 0.35 },
  window: { tint: 0xffc890, glow: { alpha: 0.12, scale: 2.2 }, spill: { alpha: 0.1, scale: 4 }, flicker: 0.01 },
  divine: { tint: 0xe4ecff, glow: { alpha: 0.3, scale: 1.4 }, spill: { alpha: 0.1, scale: 3.4 }, flicker: 0, pulse: 0.25 },
  treasure: { tint: 0xffd27a, glow: { alpha: 0.4, scale: 1.0 }, spill: { alpha: 0.08, scale: 2 }, flicker: 0.04, pulse: 0.8 },
  lantern: { tint: 0xffd9a0, glow: { alpha: 0.38, scale: 0.7 }, spill: { alpha: 0.1, scale: 2.4 }, flicker: 0.08 },
  seal: { tint: 0xb89cff, glow: { alpha: 0.32, scale: 2.4 }, spill: { alpha: 0.08, scale: 4 }, flicker: 0, pulse: 0.2 },
  moon: { tint: 0xc8e0ff, glow: { alpha: 0.12, scale: 2 }, spill: { alpha: 0.06, scale: 3 }, flicker: 0 },
  // The cold breath of a cave mouth: faint, slow, there to be noticed.
  glowmoss: { tint: 0x8fe8d0, glow: { alpha: 0.26, scale: 0.6 }, spill: { alpha: 0.07, scale: 2.2 }, flicker: 0, pulse: 0.12 },
  // A treasure set out to be found: pale, steady, unmistakable.
  relic: { tint: 0xe4f4ff, glow: { alpha: 0.42, scale: 0.9 }, spill: { alpha: 0.1, scale: 2.6 }, halo: { tint: 0x9fe8d8, alpha: 0.16, scale: 1.8 }, flicker: 0, pulse: 0.5 },
  hollow: { tint: 0x8fe0d0, glow: { alpha: 0.22, scale: 0.9 }, spill: { alpha: 0.05, scale: 2 }, flicker: 0, pulse: 0.18 },
} as const satisfies Record<string, LightPreset>;

export type LightName = keyof typeof LIGHT_PRESETS;

/** Depth bands (see LevelRenderer): glow behind tiles, spill and flames over them, under characters (8+). */
const DEPTH = { glow: -2, spill: 1, flame: 2 };

interface Light {
  preset: LightPreset;
  glow: Phaser.GameObjects.Image;
  spill: Phaser.GameObjects.Image | null;
  halo: Phaser.GameObjects.Image | null;
  flame: Phaser.GameObjects.Image | null;
  phase: number;
  /** 0..1 brightness (an unlit shrine is dim). */
  level: number;
}

export type LightHandle = Light;

export class LightRig {
  private readonly lights: Light[] = [];
  private time = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Add a light centred at (x, y). For flames, the flame stands on (x, flameY). */
  add(name: LightName, x: number, y: number, flameY = y + 6): LightHandle {
    const preset: LightPreset = LIGHT_PRESETS[name];
    const add = (tint: number, depth: number) => this.scene.add.image(x, y, TEX.glow).setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth);
    const light: Light = {
      preset,
      glow: add(preset.tint, DEPTH.glow),
      spill: preset.spill ? add(preset.tint, DEPTH.spill) : null,
      halo: preset.halo ? add(preset.halo.tint, DEPTH.glow) : null,
      flame: preset.flame ? this.scene.add.image(x, flameY, TEX.flame, 0).setOrigin(0.5, 1).setDepth(DEPTH.flame) : null,
      phase: (x * 0.137 + y * 0.071) % (Math.PI * 2),
      level: 1,
    };
    if (preset.embers) {
      this.scene.add
        .particles(x, flameY - 8, TEX.ember, {
          lifespan: { min: 700, max: 1400 },
          speedY: { min: -30, max: -12 },
          speedX: { min: -5, max: 5 },
          frequency: preset.embers,
          quantity: 1,
          maxAliveParticles: 6,
          alpha: { start: 1, end: 0 },
          blendMode: Phaser.BlendModes.ADD,
        })
        .setDepth(DEPTH.flame);
    }
    this.lights.push(light);
    this.apply(light, 0);
    return light;
  }

  setLevel(light: LightHandle, level: number): void {
    light.level = level;
    if (light.flame) light.flame.setVisible(level > 0.5);
    this.apply(light, 0);
  }

  private apply(l: Light, n: number): void {
    const p = l.preset;
    const k = l.level * (1 + n);
    l.glow.setAlpha(p.glow.alpha * k).setScale(p.glow.scale * (1 + n * 0.25));
    if (l.spill && p.spill) l.spill.setAlpha(p.spill.alpha * k).setScale(p.spill.scale);
    if (l.halo && p.halo) l.halo.setAlpha(p.halo.alpha * l.level * (1 + n * 0.5)).setScale(p.halo.scale);
  }

  /** Cosmetic flicker, breathing and flame frames. */
  update(dt: number): void {
    this.time += dt;
    const t = this.time;
    for (const l of this.lights) {
      const p = l.preset;
      let n = 0;
      if (p.flicker) n += (Math.sin(t * 9 + l.phase) * 0.5 + Math.sin(t * 23 + l.phase * 2) * 0.3) * p.flicker * 2;
      if (p.pulse) n += Math.sin(t * Math.PI * 2 * p.pulse + l.phase) * 0.15;
      this.apply(l, n);
      if (l.flame) l.flame.setFrame(Math.floor(t * 10 + l.phase * 3) % 4);
    }
  }
}
