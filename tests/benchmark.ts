import type { Simulation } from '../src/world/Simulation';
import { getAttack } from '../src/data/weapons';
import { equipScythe, flatSim, ScriptedInput } from './helpers';

export interface BenchResult {
  weapon: string;
  mode: string;
  seconds: number;
  damage: number;
  posture: number;
  stamina: number;
  hits: number;
  dps: number;
  damagePerStamina: number;
}

/**
 * Reproducible weapon benchmark: the player mashes a pattern against a
 * stationary Vowcarved Sentinel dummy (health/posture refilled every step so it
 * never dies or staggers) at `distance` px for `seconds`. Stamina limits are
 * real, so DPS reflects stamina throttling.
 */
export function benchWeapon(
  weapon: 'sword' | 'scythe',
  mode: 'light' | 'heavy' | 'charged',
  distance: number,
  seconds = 12,
  /** 'sustained': only start an attack when stamina covers its cost (good play). 'burst': mash from full. */
  policy: 'sustained' | 'burst' = 'sustained',
): BenchResult {
  const sim: Simulation = flatSim({ enemyCol: 20, width: 50 });
  if (weapon === 'scythe') equipScythe(sim);
  const input = new ScriptedInput();
  const e = sim.enemies[0]!;
  const p = sim.player;
  const anchorX = e.body.footX;
  let damage = 0;
  let posture = 0;
  let stamina = 0;
  let hits = 0;
  const steps = seconds * 60;
  for (let t = 0; t < steps; t++) {
    // Freeze the dummy in place, fully healthy, never attacking.
    e.cooldown = 999;
    e.body.teleport(anchorX, e.body.footY);
    if (!e.fsm.is('idle') && !e.fsm.is('approach') && !e.fsm.is('stagger')) e.fsm.transition('approach', true);
    if (p.state !== 'attack') {
      p.body.teleport(anchorX - distance, p.body.footY);
      p.facing = 1;
    }
    const next = mode === 'light' ? (p.state === 'attack' && p.attack.attack?.next ? p.attack.attack.next : p.equipment.weapon.moveset.light) : p.equipment.weapon.moveset.heavy;
    const affordable = policy === 'burst' || p.stamina.current >= getAttack(next).staminaCost + (mode === 'charged' ? getAttack(next).charge?.staminaCost ?? 0 : 0);
    if (mode === 'light' && t % 4 === 0 && affordable) input.frame.attackPressed = true;
    if (mode !== 'light' && p.state !== 'attack' && t % 4 === 0 && affordable) input.frame.heavyPressed = true;
    input.frame.heavyHeld = mode === 'charged';
    const hp = e.health.current;
    const ps = e.posture.current;
    const st = p.stamina.current;
    sim.step(1 / 60, input);
    if (e.health.current < hp) {
      damage += hp - e.health.current;
      hits++;
    }
    if (e.posture.current > ps) posture += e.posture.current - ps;
    if (p.stamina.current < st) stamina += st - p.stamina.current;
    e.health.reset();
    e.posture.reset();
  }
  return {
    weapon,
    mode,
    seconds,
    damage,
    posture,
    stamina: Math.round(stamina),
    hits,
    dps: Math.round((damage / seconds) * 10) / 10,
    damagePerStamina: Math.round((damage / Math.max(1, stamina)) * 100) / 100,
  };
}

/** Does a single light attack connect at `distance`? */
export function connectsAt(weapon: 'sword' | 'scythe', distance: number): boolean {
  const sim = flatSim({ enemyCol: 20, width: 50 });
  if (weapon === 'scythe') equipScythe(sim);
  const input = new ScriptedInput();
  const e = sim.enemies[0]!;
  const p = sim.player;
  p.body.teleport(e.body.footX - distance, p.body.footY);
  p.facing = 1;
  input.frame.attackPressed = true;
  const anchorX = e.body.footX;
  for (let t = 0; t < 40; t++) {
    e.cooldown = 999;
    e.body.teleport(anchorX, e.body.footY);
    sim.step(1 / 60, input);
  }
  return e.hitsTaken > 0;
}
