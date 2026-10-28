import Phaser from 'phaser';
import './style.css';
import { sfx } from './audio/Sfx';
import { createDebugFlags } from './config/debug';
import { DISPLAY } from './config/display';
import { computeViewport } from './game/Viewport';
import { setServices, type GameServices } from './game/services';
import { InputHub } from './input/InputHub';
import { KeyboardSource } from './input/KeyboardSource';
import { TouchControls } from './input/TouchControls';
import { BootScene } from './scenes/BootScene';
import { TestChamberScene } from './scenes/TestChamberScene';
import { UIScene } from './scenes/UIScene';

const app = document.getElementById('app')!;
const container = document.getElementById('game')!;

const services: GameServices = {
  input: new InputHub(),
  debug: createDebugFlags(),
  viewport: null,
  onDebugToggle: null,
};
const toggleDebug = () => services.onDebugToggle?.();

new KeyboardSource(services.input, toggleDebug);

const utilityButtons = [{ label: 'DBG', onPress: toggleDebug }];
if (document.fullscreenEnabled) {
  utilityButtons.push({
    label: '⛶',
    onPress: () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else
        void document.documentElement
          .requestFullscreen({ navigationUI: 'hide' })
          .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
          .catch(() => undefined);
    },
  });
}
const touch = new TouchControls(services.input, app, utilityButtons, () => services.debug.enabled);

// ---- Browser hygiene: no scrolling, zooming or stuck inputs ------------------------------
const block = (e: Event) => e.preventDefault();
document.addEventListener('touchmove', block, { passive: false });
document.addEventListener('gesturestart', block);
document.addEventListener('dblclick', block);
document.addEventListener('contextmenu', block);

const releaseAll = () => {
  services.input.releaseAll();
  touch.releaseAll();
};
window.addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    releaseAll();
    sfx.suspend();
  } else {
    sfx.resume();
  }
});

// Audio can only start from a user gesture (iOS).
const unlock = () => sfx.unlock();
for (const type of ['touchend', 'pointerdown', 'keydown']) document.addEventListener(type, unlock, { capture: true });

// ---- Game -------------------------------------------------------------------------------
const dpr = window.devicePixelRatio || 1;
const initial = computeViewport(window.innerWidth, window.innerHeight, dpr);

new Phaser.Game({
  type: Phaser.AUTO,
  parent: container,
  width: initial.width,
  height: initial.height,
  backgroundColor: DISPLAY.backgroundColor,
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  banner: false,
  disableContextMenu: true,
  scale: { mode: Phaser.Scale.NONE, zoom: initial.zoom / dpr },
  // All input is handled by our own DOM sources; Phaser's handlers stay off.
  input: { keyboard: false, mouse: false, touch: false, gamepad: false },
  // Placeholder sound uses its own Web Audio context.
  audio: { noAudio: true },
  callbacks: { preBoot: (game) => setServices(game, services) },
  scene: [BootScene, TestChamberScene, UIScene],
});

// Hide the desktop controls hint after a while.
setTimeout(() => document.getElementById('help')?.classList.add('faded'), 9000);
