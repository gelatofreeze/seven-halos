import { createInputFrame, type InputFrame, type InputProvider } from '../src/input/InputActions';
import { parseLevel } from '../src/world/Level';
import { Simulation, type SimulationOptions } from '../src/world/Simulation';

export const DT = 1 / 60;

/** Scripted input: set fields before each step; press flags auto-clear after one sample. */
export class ScriptedInput implements InputProvider {
  readonly frame: InputFrame = createInputFrame();
  sample(out: InputFrame): void {
    Object.assign(out, this.frame);
    this.frame.jumpPressed = false;
    this.frame.attackPressed = false;
    this.frame.heavyPressed = false;
    this.frame.dodgePressed = false;
    this.frame.parryPressed = false;
    this.frame.interactPressed = false;
  }
}

export interface FlatSimOptions extends SimulationOptions {
  enemyCol?: number;
  /** Level marker for the enemy: E = Vowcarved Sentinel, R = Barrow Reaper. */
  enemy?: 'E' | 'R';
  /** More enemies: [column, marker]. */
  extraEnemies?: [number, 'E' | 'R'][];
  extraRows?: string[];
  width?: number;
}

/** A flat arena (40 tiles by default) with the player at column 5 and optional enemies. */
export function flatSim(options: FlatSimOptions = {}): Simulation {
  const width = options.width ?? 40;
  const blank = '#' + '.'.repeat(width - 2) + '#';
  const rows: string[] = [];
  for (let i = 0; i < 10; i++) rows.push(blank);
  const spawnRow = blank.split('');
  spawnRow[5] = 'P';
  if (options.enemyCol !== undefined) spawnRow[options.enemyCol] = options.enemy ?? 'E';
  for (const [col, marker] of options.extraEnemies ?? []) spawnRow[col] = marker;
  rows.push(spawnRow.join(''));
  rows.push('#'.repeat(width), '#'.repeat(width));
  if (options.extraRows) rows.splice(0, options.extraRows.length, ...options.extraRows);
  return new Simulation(parseLevel({ id: 'test', name: 'test', tileSize: 16, rows }), options);
}

export function run(sim: Simulation, input: ScriptedInput, steps: number, each?: (i: number) => void): void {
  for (let i = 0; i < steps; i++) {
    each?.(i);
    sim.step(DT, input);
  }
}

/**
 * Player at column 5, Vowcarved Sentinel at column 8: within aggro range, it walks
 * into range and attacks. The attack is forced (standard cleave by default) so
 * timing-based tests are deterministic.
 */
export function engagedSim(attack: string | null = 'sentinel.cleave') {
  const sim = flatSim({ enemyCol: 8 });
  const input = new ScriptedInput();
  const enemy = sim.enemies[0]!;
  enemy.forcedAttack = attack;
  return { sim, input, enemy, player: sim.player };
}

/** Give the player the Mourning Crescent and equip it. */
export function equipScythe(sim: Simulation): void {
  const instance = sim.profile.inventory.add('mourning-crescent');
  const result = sim.requestEquip(instance.uid);
  if (result !== 'equipped') throw new Error(`equip failed: ${result}`);
}

/** Step until `predicate` is true (or give up); returns the number of steps taken. */
export function runUntil(sim: Simulation, input: ScriptedInput, predicate: () => boolean, max = 600, each?: (i: number) => void): number {
  for (let i = 0; i < max; i++) {
    if (predicate()) return i;
    each?.(i);
    sim.step(DT, input);
  }
  return -1;
}
