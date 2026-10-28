import { describe, expect, it } from 'vitest';
import { calculateDamage } from '../src/combat/Damage';
import type { DamageResult } from '../src/combat/types';
import { getAttack } from '../src/data/weapons';
import type { Simulation } from '../src/world/Simulation';
import { equipScythe, flatSim, run, ScriptedInput } from './helpers';

const L1 = getAttack('scythe.light.1');
const HEAVY = getAttack('scythe.heavy');

/** A passive target `dxTiles` tiles from the player (negative = behind). */
function target(dxTiles: number, scythe: boolean) {
  const col = 12;
  const sim = flatSim({ enemyCol: col });
  const input = new ScriptedInput();
  const enemy = sim.enemies[0]!;
  const hold = () => {
    enemy.cooldown = 999;
    enemy.body.vx = 0;
  };
  if (scythe) equipScythe(sim);
  run(sim, input, 2, hold);
  sim.player.body.teleport(enemy.body.footX - dxTiles * 16, sim.player.body.footY);
  sim.player.facing = 1;
  return { sim, input, enemy, player: sim.player, hold };
}

function swing(sim: Simulation, input: ScriptedInput, hold: () => void, press: 'attackPressed' | 'heavyPressed', holdHeavy = 0) {
  input.frame[press] = true;
  const active: number[] = [];
  for (let t = 0; t < 220; t++) {
    hold();
    input.frame.heavyHeld = t < holdHeavy;
    sim.step(1 / 60, input);
    while (sim.inHitstop) sim.step(1 / 60, input);
    let any = false;
    sim.combat.detection.forEachActive((hb) => {
      if (hb.owner === sim.player) any = true;
    });
    if (any) active.push(t);
    if (t > 3 && sim.player.state !== 'attack') break;
  }
  return active;
}

describe('Mourning Crescent (scythe)', () => {
  it('light attack frame data: slower startup and longer active window than the sword', () => {
    const { sim, input, hold } = target(2, true);
    const active = swing(sim, input, hold, 'attackPressed');
    expect(active[0]).toBe(L1.startupFrames);
    expect(active.at(-1)).toBe(L1.startupFrames + L1.activeFrames - 1);
    const sword = getAttack('sword.light.1');
    expect(L1.startupFrames).toBeGreaterThan(sword.startupFrames);
    expect(L1.staminaCost).toBeGreaterThan(sword.staminaCost);
  });

  it('out-reaches the sword: hits a target the sword cannot', () => {
    const far = 3.4;
    const withSword = target(far, false);
    swing(withSword.sim, withSword.input, withSword.hold, 'attackPressed');
    expect(withSword.enemy.hitsTaken).toBe(0);
    const withScythe = target(far, true);
    swing(withScythe.sim, withScythe.input, withScythe.hold, 'attackPressed');
    expect(withScythe.enemy.hitsTaken).toBe(1);
  });

  it('the returning sweep also catches an enemy just behind', () => {
    const { sim, input, enemy, player, hold } = target(-0.9, true);
    player.facing = 1;
    // First swing (front) misses the enemy behind; chain into the backswing.
    input.frame.attackPressed = true;
    let sawSecond = false;
    for (let t = 0; t < 120; t++) {
      hold();
      if (player.attack.attack?.id === 'scythe.light.1' && player.attack.frame === L1.cancels.chainFrom) input.frame.attackPressed = true;
      if (player.attack.attack?.id === 'scythe.light.2') sawSecond = true;
      sim.step(1 / 60, input);
    }
    expect(sawSecond).toBe(true);
    expect(enemy.hitsTaken).toBeGreaterThanOrEqual(1);
  });

  it('has a three-attack light combo', () => {
    const { sim, input, player, hold } = target(2, true);
    const seen = new Set<string>();
    input.frame.attackPressed = true;
    for (let t = 0; t < 200; t++) {
      hold();
      if (t % 5 === 0) input.frame.attackPressed = true;
      const id = player.attack.attack?.id;
      if (id) seen.add(id);
      sim.step(1 / 60, input);
    }
    expect([...seen]).toEqual(expect.arrayContaining(['scythe.light.1', 'scythe.light.2', 'scythe.light.3']));
  });

  it('heavy and charged heavy: committed timing with a longer charge than the sword', () => {
    const tap = target(2, true);
    const tapActive = swing(tap.sim, tap.input, tap.hold, 'heavyPressed', 1);
    expect(tapActive[0]).toBe(HEAVY.startupFrames);
    const full = target(2, true);
    const fullActive = swing(full.sim, full.input, full.hold, 'heavyPressed', 999);
    expect(fullActive[0]).toBe(HEAVY.startupFrames + HEAVY.charge!.maxFrames);
    expect(HEAVY.charge!.maxFrames).toBeGreaterThan(getAttack('sword.heavy').charge!.maxFrames);
    expect(full.enemy.health.max - full.enemy.health.current).toBeGreaterThan((tap.enemy.health.max - tap.enemy.health.current) * 1.5);
  });

  it('a missed heavy leaves a long, punishable recovery', () => {
    const { sim, input, player, hold } = target(8, true);
    input.frame.heavyPressed = true;
    let attackFrames = 0;
    for (let t = 0; t < 200 && (t < 2 || player.state === 'attack'); t++) {
      hold();
      sim.step(1 / 60, input);
      if (player.state === 'attack') attackFrames++;
    }
    expect(attackFrames).toBe(HEAVY.startupFrames + HEAVY.activeFrames + HEAVY.recoveryFrames);
    expect(HEAVY.recoveryFrames).toBeGreaterThan(getAttack('sword.heavy').recoveryFrames);
  });

  it('ripostes with its own riposte attack', () => {
    const { sim, input, enemy, player } = target(1.5, true);
    enemy.riposteOpen = true;
    enemy.fsm.transition('parried', true);
    input.frame.attackPressed = true;
    run(sim, input, 1);
    expect(player.state).toBe('riposte');
    expect(player.attack.attack?.id).toBe('scythe.riposte');
  });

  it('an upgraded sword stays competitive with the scythe', () => {
    const out: DamageResult = { damage: 0, postureDamage: 0, knockbackX: 0, knockbackY: 0, hitstunFrames: 0 };
    const defender = { defense: 2, absorption: 0.1, attackMultiplier: 1 };
    const sim = flatSim();
    sim.player.equipment.equipWeapon('pilgrim-sword', 3);
    sim.player.refreshStats();
    calculateDamage(getAttack('sword.light.1'), sim.player.stats, defender, out);
    const swordPlus3 = out.damage;
    calculateDamage(L1, { defense: 0, absorption: 0, attackMultiplier: 1 }, defender, out);
    expect(swordPlus3).toBeGreaterThan(out.damage);
  });
});

describe('Weapon switching', () => {
  it('is refused mid-attack and leaves the active attack, stamina and moveset untouched', () => {
    const { sim, input, player, hold } = target(2, false);
    const scythe = sim.profile.inventory.add('mourning-crescent');
    input.frame.attackPressed = true;
    run(sim, input, 3, hold);
    const stamina = player.stamina.current;
    expect(player.state).toBe('attack');
    expect(sim.requestEquip(scythe.uid)).toBe('busy');
    expect(player.equipment.weapon.id).toBe('pilgrim-sword');
    expect(player.attack.attack?.id).toBe('sword.light.1');
    expect(player.stamina.current).toBe(stamina);
  });

  it('is refused while rolling, guarding or reeling', () => {
    const { sim, input, player, hold } = target(6, false);
    const scythe = sim.profile.inventory.add('mourning-crescent');
    input.frame.dodgePressed = true;
    run(sim, input, 2, hold);
    expect(sim.requestEquip(scythe.uid)).toBe('busy');
    run(sim, input, 40, hold);
    input.frame.guardHeld = true;
    run(sim, input, 5, hold);
    expect(player.state).toBe('guard');
    expect(sim.requestEquip(scythe.uid)).toBe('busy');
  });

  it('works when idle; the next attack uses the new moveset; switching back restores the sword', () => {
    const { sim, input, player, hold } = target(2, false);
    const sword = sim.profile.equippedWeaponUid;
    const scythe = sim.profile.inventory.add('mourning-crescent');
    expect(sim.requestEquip(scythe.uid)).toBe('equipped');
    input.frame.attackPressed = true;
    run(sim, input, 1, hold);
    expect(player.attack.attack?.id).toBe('scythe.light.1');
    run(sim, input, 60, hold);
    expect(sim.requestEquip(sword)).toBe('equipped');
    input.frame.attackPressed = true;
    run(sim, input, 1, hold);
    expect(player.attack.attack?.id).toBe('sword.light.1');
  });

  it('refuses items that are not weapons or not owned', () => {
    const sim = flatSim();
    const dust = sim.profile.inventory.add('grave-dust', 2);
    expect(sim.requestEquip(dust.uid)).toBe('invalid');
    expect(sim.requestEquip(9999)).toBe('invalid');
  });
});
