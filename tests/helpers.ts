import { createInputFrame, type InputFrame, type InputProvider } from '../src/input/InputActions';
import { parseLevel } from '../src/world/Level';
import { Simulation } from '../src/world/Simulation';

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
  }
}

/** A flat 40-tile arena with the player at column 5 and optional enemy. */
export function flatSim(options: { enemyCol?: number; extraRows?: string[] } = {}): Simulation {
  const width = 40;
  const blank = '#' + '.'.repeat(width - 2) + '#';
  const rows: string[] = [];
  for (let i = 0; i < 10; i++) rows.push(blank);
  const spawnRow = blank.split('');
  spawnRow[5] = 'P';
  if (options.enemyCol !== undefined) spawnRow[options.enemyCol] = 'E';
  rows.push(spawnRow.join(''));
  rows.push('#'.repeat(width), '#'.repeat(width));
  if (options.extraRows) rows.splice(0, options.extraRows.length, ...options.extraRows);
  return new Simulation(parseLevel({ id: 'test', name: 'test', tileSize: 16, rows }));
}

export function run(sim: Simulation, input: ScriptedInput, steps: number, each?: (i: number) => void): void {
  for (let i = 0; i < steps; i++) {
    each?.(i);
    sim.step(DT, input);
  }
}

/**
 * Player at column 5, Hollow Sentinel at column 8: within aggro range, it walks
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
