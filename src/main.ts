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
import { WorldScene } from './scenes/WorldScene';
import { UIScene } from './scenes/UIScene';
import { SaveManager } from './persistence/SaveGame';
import { createBrowserStorage } from './platform/LocalStorageAdapter';
import { PlayerProfile } from './rpg/Profile';
import { DEV_TOOLS_ENABLED } from './config/build';
import { setUpDevWorld } from './dev/devTools';
import { Toasts } from './ui/Toasts';
import { GameWorld } from './world/GameWorld';

const app = document.getElementById('app')!;
const container = document.getElementById('game')!;

// Persistent profile: loaded once, saved by the gameplay scene when it changes.
const profile = new PlayerProfile();
const save = new SaveManager(createBrowserStorage(), profile);
save.load();

// The world resumes where the profile left off (a new game starts at the sanctuary approach).
const world = new GameWorld(profile, { devPickups: DEV_TOOLS_ENABLED });
// Development builds register the combat test chamber and honour ?region=test-chamber.
const devStart = DEV_TOOLS_ENABLED ? setUpDevWorld() : null;
world.start(devStart ?? GameWorld.resumeLocation(profile));

const services: GameServices = {
  input: new InputHub(),
  debug: createDebugFlags(),
  viewport: null,
  onDebugToggle: null,
  onMenuToggle: null,
  releaseInputs: () => undefined,
  profile,
  save,
  world,
  toasts: new Toasts(app),
};
const toggleDebug = () => services.onDebugToggle?.();
const toggleMenu = () => services.onMenuToggle?.();

new KeyboardSource(services.input, toggleDebug, toggleMenu);

// The pause menu lives behind a small utility button rather than another large combat button.
const utilityButtons = [
  { label: 'MENU', onPress: toggleMenu },
  { label: 'DBG', onPress: toggleDebug },
];
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
// Block page scrolling everywhere except inside the menu's scrollable areas (the menu itself
// cancels scrolling while an item is being dragged).
document.addEventListener(
  'touchmove',
  (e) => {
    if (!(e.target instanceof Element && e.target.closest('.menu-scroll'))) e.preventDefault();
  },
  { passive: false },
);
document.addEventListener('gesturestart', block);
document.addEventListener('dblclick', block);
document.addEventListener('contextmenu', block);

const releaseAll = () => {
  services.input.releaseAll();
  touch.releaseAll();
};
services.releaseInputs = releaseAll;
window.addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    releaseAll();
    save.saveIfChanged();
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
  scene: [BootScene, WorldScene, UIScene],
});

// Hide the desktop controls hint after a while.
setTimeout(() => document.getElementById('help')?.classList.add('faded'), 9000);

// Save on the way out (tab closed, app backgrounded on iOS).
window.addEventListener('pagehide', () => save.saveIfChanged());
