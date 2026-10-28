import type { Content } from '../data/validateContent';
import { GAME_CONTENT } from '../data/validateContent';
import { findAnim, PLAYER_ANIMS, PLAYER_ATTACK_FRAMES, PLAYER_SHEET, WEAPON_SHEETS, type AnimSpec, type PhaseFrames, type SheetSpec } from './animation/specs';
import { ENEMY_VISUALS } from './views/enemyProfiles';

/** Animation names every enemy profile must provide (see EnemyView). */
const ENEMY_ANIMS = ['idle', 'walk', 'stagger', 'parried', 'broken', 'riposted', 'dead'];
const PLAYER_ANIM_NAMES = ['idle', 'run', 'jump', 'fall', 'land', 'hurt', 'dead', 'guardBroken'];

/**
 * Checks the presentation mappings against content: every weapon has a
 * sheet, every player and enemy attack has frames, every animation exists
 * and every frame index is inside its sheet. Pure data; Phaser-free.
 */
export function validateVisuals(c: Content = GAME_CONTENT): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);
  const inSheet = (what: string, frames: readonly number[], sheet: SheetSpec) => {
    if (frames.length === 0) err(`${what}: has no frames`);
    for (const f of frames) if (!(Number.isInteger(f) && f >= 0 && f < sheet.frameCount)) err(`${what}: frame ${f} is outside sheet "${sheet.key}" (${sheet.frameCount} frames)`);
  };
  const phases = (what: string, p: PhaseFrames, sheet: SheetSpec) => {
    inSheet(`${what} startup`, p.startup, sheet);
    inSheet(`${what} active`, p.active, sheet);
    inSheet(`${what} recovery`, p.recovery, sheet);
    if (p.charge) inSheet(`${what} charge`, p.charge, sheet);
  };
  const anim = (what: string, anims: readonly AnimSpec[], name: string, sheet: SheetSpec) => {
    try {
      const a = findAnim(anims, name);
      if (!(a.fps > 0)) err(`${what} "${name}": fps must be > 0`);
      inSheet(`${what} "${name}"`, a.frames, sheet);
    } catch {
      err(`${what}: missing animation "${name}"`);
    }
  };

  for (const name of PLAYER_ANIM_NAMES) anim('player', PLAYER_ANIMS, name, PLAYER_SHEET);
  for (const w of Object.values(c.weapons)) {
    if (!WEAPON_SHEETS[w.id]) err(`weapon "${w.id}": no player sheet in WEAPON_SHEETS`);
    const ids = new Set([w.moveset.heavy, w.moveset.riposte]);
    for (let id: string | undefined = w.moveset.light; id && !ids.has(id); id = c.attacks[id]?.next) ids.add(id);
    for (const id of ids) {
      const frames = PLAYER_ATTACK_FRAMES[id];
      if (!frames) err(`weapon "${w.id}": attack "${id}" has no PLAYER_ATTACK_FRAMES entry`);
      else phases(`player attack "${id}"`, frames, PLAYER_SHEET);
    }
  }
  for (const e of Object.values(c.enemies)) {
    const profile = ENEMY_VISUALS[e.id];
    if (!profile) {
      err(`enemy "${e.id}": no visual profile in render/views/enemyProfiles.ts`);
      continue;
    }
    for (const name of ENEMY_ANIMS) anim(`enemy "${e.id}"`, profile.anims, name, profile.sheet);
    for (const o of e.attacks) {
      const v = profile.attacks[o.attack];
      if (!v) err(`enemy "${e.id}": attack "${o.attack}" has no visual`);
      else phases(`enemy "${e.id}" attack "${o.attack}"`, v.frames, profile.sheet);
    }
    const d = profile.death;
    if (!(d.fadeDelay >= 0 && d.fadeDuration > 0 && d.remainsAlpha >= 0 && d.remainsAlpha <= 1)) err(`enemy "${e.id}": invalid death presentation`);
    if (e.respawnDelay !== null && !d.remains && d.fadeDelay + d.fadeDuration >= e.respawnDelay) err(`enemy "${e.id}": still fading when it respawns`);
  }
  return errors;
}
