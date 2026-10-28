import type Phaser from 'phaser';
import { DISPLAY } from '../config/display';

export interface ViewportLayout {
  /** Logical game resolution, px. */
  width: number;
  height: number;
  /** Integer number of device pixels per game pixel. */
  zoom: number;
  /** CSS size of the canvas element. */
  cssWidth: number;
  cssHeight: number;
}

export interface SafeArea {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

type DisplayBounds = Pick<typeof DISPLAY, 'targetHeight' | 'minHeight' | 'maxHeight' | 'minWidth' | 'maxWidth'>;

/**
 * Choose an integer device-pixel scale so the logical height is close to the
 * target, then let the logical width follow the screen's aspect ratio. This
 * keeps every game pixel the same size (no shimmering) and never stretches.
 * Screens wider than `maxWidth` are letterboxed rather than showing more world.
 */
export function computeViewport(cssWidth: number, cssHeight: number, dpr: number, d: DisplayBounds = DISPLAY): ViewportLayout {
  const devW = Math.max(1, Math.round(cssWidth * dpr));
  const devH = Math.max(1, Math.round(cssHeight * dpr));
  let zoom = Math.max(1, Math.round(devH / d.targetHeight));
  // Narrow screens (portrait, split view): shrink zoom so the minimum width still fits.
  if (devW / zoom < d.minWidth) zoom = Math.max(1, Math.floor(devW / d.minWidth));
  const width = Math.min(d.maxWidth, Math.max(d.minWidth, Math.floor(devW / zoom)));
  const height = Math.min(d.maxHeight, Math.max(d.minHeight, Math.floor(devH / zoom)));
  return { width, height, zoom, cssWidth: (width * zoom) / dpr, cssHeight: (height * zoom) / dpr };
}

/** Read CSS safe-area insets (notch, home indicator) in CSS px. */
export function readSafeAreaCss(probe: HTMLElement): SafeArea {
  const cs = getComputedStyle(probe);
  return {
    left: parseFloat(cs.paddingLeft) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    top: parseFloat(cs.paddingTop) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
  };
}

/**
 * Owns canvas sizing: listens for resize/orientation changes, keeps the game
 * at a crisp integer scale and reports safe-area insets in game pixels.
 */
export class Viewport {
  layout: ViewportLayout;
  safeArea: SafeArea = { left: 0, right: 0, top: 0, bottom: 0 };
  private readonly probe: HTMLElement;
  private pending = false;
  private readonly listeners: ((layout: ViewportLayout, safe: SafeArea) => void)[] = [];

  constructor(
    private readonly game: Phaser.Game,
    private readonly container: HTMLElement,
  ) {
    this.probe = document.createElement('div');
    this.probe.className = 'safe-area-probe';
    document.body.appendChild(this.probe);
    this.layout = this.measure();
    window.addEventListener('resize', this.schedule);
    window.addEventListener('orientationchange', this.schedule);
    window.visualViewport?.addEventListener('resize', this.schedule);
    this.apply();
  }

  onChange(fn: (layout: ViewportLayout, safe: SafeArea) => void): void {
    this.listeners.push(fn);
  }

  private measure(): ViewportLayout {
    const vv = window.visualViewport;
    const w = vv?.width ?? window.innerWidth;
    const h = vv?.height ?? window.innerHeight;
    return computeViewport(w, h, window.devicePixelRatio || 1);
  }

  private readonly schedule = (): void => {
    if (this.pending) return;
    this.pending = true;
    // iOS reports stale sizes during rotation; measure on the next frames.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        this.pending = false;
        this.apply();
      }),
    );
  };

  apply(): void {
    const layout = this.measure();
    this.layout = layout;
    const dpr = window.devicePixelRatio || 1;
    const css = readSafeAreaCss(this.probe);
    const cssToGame = dpr / layout.zoom;
    // Safe areas are measured against the window; convert to the canvas, which is centred.
    const vv = window.visualViewport;
    const winW = vv?.width ?? window.innerWidth;
    const winH = vv?.height ?? window.innerHeight;
    const marginX = Math.max(0, (winW - layout.cssWidth) / 2);
    const marginY = Math.max(0, (winH - layout.cssHeight) / 2);
    this.safeArea = {
      left: Math.max(0, css.left - marginX) * cssToGame,
      right: Math.max(0, css.right - marginX) * cssToGame,
      top: Math.max(0, css.top - marginY) * cssToGame,
      bottom: Math.max(0, css.bottom - marginY) * cssToGame,
    };
    const scale = this.game.scale;
    if (scale.width !== layout.width || scale.height !== layout.height) scale.resize(layout.width, layout.height);
    scale.setZoom(layout.zoom / dpr);
    const canvas = this.game.canvas;
    canvas.style.width = `${layout.cssWidth}px`;
    canvas.style.height = `${layout.cssHeight}px`;
    this.container.style.setProperty('--game-css-width', `${layout.cssWidth}px`);
    for (const fn of this.listeners) fn(layout, this.safeArea);
  }
}
