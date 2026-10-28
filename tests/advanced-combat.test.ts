import { describe, expect, it } from 'vitest';
import { calculateDamage } from '../src/combat/Damage';
import type { DamageResult } from '../src/combat/types';
import { GUARD, PARRY } from '../src/config/combat';
import { PLAYER_COMBAT } from '../src/config/player';
import { getAttack } from '../src/data/weapons';
import type { Sentinel } from '../src/entities/enemy/Sentinel';
import type { SimEvent } from '../src/world/SimEvents';
import type { Simulation } from '../src/world/Simulation';
import { engagedSim, flatSim, run, ScriptedInput } from './helpers';

const HEAVY = getAttack('sword.heavy');
const CHARGE = HEAVY.charge!;
const CLEAVE = getAttack('sentinel.cleave');
const RIPOSTE = getAttack('sword.riposte');

function drain(sim: Simulation): SimEvent[] {
  const out: SimEvent[] = [];
  sim.events.drain((e) => out.push(e));
  return out;
}

/** Step through hit-stop so tests count only "real" frames. */
function step(sim: Simulation, input: ScriptedInput): void {
  sim.step(1 / 60, input);
  while (sim.inHitstop) sim.step(1 / 60, input);
}

/** Sentinel two tiles in front of the player that never attacks. */
function passiveTarget() {
  const sim = flatSim({ enemyCol: 7 });
  const input = new ScriptedInput();
  const enemy = sim.enemies[0]!;
  const hold = () => {
    enemy.cooldown = 999;
  };
  hold();
  run(sim, input, 2, hold);
  return { sim, input, enemy, player: sim.player, hold };
}

/** Run a heavy attack holding the button for `holdTicks`; returns frames with an active player hitbox and damage dealt. */
function heavyAttack(holdTicks: number) {
  const { sim, input, enemy, player, hold } = passiveTarget();
  const hp = enemy.health.current;
  const stamina = player.stamina.current;
  input.frame.heavyPressed = true;
  const activeTicks: number[] = [];
  let maxCharge = 0;
  for (let tick = 0; tick < 200; tick++) {
    hold();
    input.frame.heavyHeld = tick < holdTicks;
    step(sim, input);
    maxCharge = Math.max(maxCharge, player.attack.chargeFrames);
    let any = false;
    sim.combat.detection.forEachActive((hb) => {
      if (hb.owner === player) any = true;
    });
    if (any) activeTicks.push(tick);
    if (tick > 5 && player.state !== 'attack') break;
  }
  return { activeTicks, damage: hp - enemy.health.current, staminaSpent: stamina - player.stamina.current, maxCharge, enemy };
}

describe('Heavy and charged attacks', () => {
  it('a tapped heavy is slower than a light and hits only on its active frames', () => {
    const tap = heavyAttack(1);
    expect(tap.maxCharge).toBe(0);
    expect(tap.activeTicks[0]).toBe(HEAVY.startupFrames);
    expect(tap.activeTicks.at(-1)).toBe(HEAVY.startupFrames + HEAVY.activeFrames - 1);
    expect(HEAVY.startupFrames).toBeGreaterThan(getAttack('sword.light.1').startupFrames * 2);
    expect(tap.staminaSpent).toBeCloseTo(HEAVY.staminaCost, 0);
  });

  it('holding charges up to a hard maximum, then releases automatically with more damage and posture', () => {
    const tap = heavyAttack(1);
    const full = heavyAttack(500);
    expect(full.maxCharge).toBe(CHARGE.maxFrames);
    // The swing is delayed by exactly the charge duration.
    expect(full.activeTicks[0]).toBe(HEAVY.startupFrames + CHARGE.maxFrames);
    expect(full.damage).toBeGreaterThan(tap.damage * 1.4);
    expect(full.staminaSpent).toBeCloseTo(HEAVY.staminaCost + CHARGE.staminaCost, 0);
    expect(full.enemy.posture.current).toBeGreaterThan(tap.enemy.posture.current);
  });

  it('a partial charge scales between the minimum and maximum', () => {
    const tap = heavyAttack(1);
    const half = heavyAttack(CHARGE.holdFrame + CHARGE.maxFrames / 2);
    const full = heavyAttack(500);
    expect(half.maxCharge).toBeGreaterThan(0);
    expect(half.maxCharge).toBeLessThan(CHARGE.maxFrames);
    expect(half.damage).toBeGreaterThan(tap.damage);
    expect(half.damage).toBeLessThan(full.damage);
  });

  it('cannot start a heavy in the air or with an empty stamina meter', () => {
    const { sim, input, player } = passiveTarget();
    input.frame.jumpPressed = true;
    input.frame.jumpHeld = true;
    run(sim, input, 6);
    input.frame.heavyPressed = true;
    run(sim, input, 1);
    expect(player.state).not.toBe('attack');
    run(sim, input, 80);
    player.stamina.spend(1000);
    input.frame.heavyPressed = true;
    run(sim, input, 1);
    expect(player.state).not.toBe('attack');
  });

  it('getting hit while charging interrupts the attack and ends the charge', () => {
    const { sim, input, enemy, player } = engagedSim();
    const events: SimEvent[] = [];
    let interrupted = false;
    run(sim, input, 300, () => {
      // Start charging as the Sentinel winds up, and keep holding.
      if (enemy.fsm.is('attack') && enemy.attack.frame === 5) input.frame.heavyPressed = true;
      input.frame.heavyHeld = true;
      events.push(...drain(sim));
      if (player.state === 'hurt' && events.some((e) => e.type === 'chargeStart')) interrupted = true;
    });
    expect(interrupted).toBe(true);
    expect(events.some((e) => e.type === 'chargeEnd')).toBe(true);
    expect(player.attack.attack).toBeNull();
  });
});

/** Engage the Sentinel while holding guard (facing it). Returns the player state right after the first swing. */
function blockFirstSwing(setup?: (sim: Simulation) => void) {
  const env = engagedSim();
  const { sim, input, enemy, player } = env;
  setup?.(sim);
  input.frame.guardHeld = true;
  const events: SimEvent[] = [];
  let afterSwing = '';
  let staminaBefore = 0;
  let staminaAfter = 0;
  let healthAfter = 0;
  run(sim, input, 200, () => {
    if (!afterSwing && enemy.fsm.is('attack') && enemy.attack.frame === CLEAVE.startupFrames - 1) staminaBefore = player.stamina.current;
    events.push(...drain(sim));
    if (!afterSwing && events.some((e) => e.type === 'block')) {
      afterSwing = player.state;
      staminaAfter = player.stamina.current;
      healthAfter = player.health.current;
    }
  });
  return { ...env, events, afterSwing, staminaBefore, staminaAfter, healthAfter };
}

describe('Guarding', () => {
  it('a frontal block costs stamina and only chip damage', () => {
    const r = blockFirstSwing();
    const block = r.events.find((e) => e.type === 'block');
    expect(block).toMatchObject({ guardBroken: false });
    const out: DamageResult = { damage: 0, postureDamage: 0, knockbackX: 0, knockbackY: 0, hitstunFrames: 0 };
    calculateDamage(CLEAVE, r.enemy.stats, r.player.stats, out);
    const chip = Math.round(out.damage * (1 - GUARD.damageReduction));
    expect(r.healthAfter).toBe(PLAYER_COMBAT.maxHealth - chip);
    expect(r.afterSwing).toBe('guard');
    const cost = Math.round(CLEAVE.guardStaminaDamage * (1 - GUARD.stability));
    expect(r.staminaBefore - r.staminaAfter).toBeCloseTo(cost, 0);
  });

  it('blocking with too little stamina breaks the guard, empties stamina and leaves the player open', () => {
    const r = blockFirstSwing((sim) => sim.player.stamina.spend(75));
    expect(r.events.find((e) => e.type === 'block')).toMatchObject({ guardBroken: true });
    expect(r.afterSwing).toBe('guardBroken');
    expect(r.staminaAfter).toBe(0);
    // The Sentinel punishes the broken guard with a follow-up hit.
    expect(r.events.some((e) => e.type === 'hit' && e.targetFaction === 'player')).toBe(true);
  });

  it('does not block attacks from behind', () => {
    const r = blockFirstSwing((sim) => {
      sim.player.facing = -1;
    });
    // Guard enter faces the input direction; with no input it keeps facing away.
    expect(r.events.some((e) => e.type === 'block')).toBe(false);
    expect(r.player.health.current).toBeLessThan(PLAYER_COMBAT.maxHealth - 10);
  });

  it('rolling cancels a raised guard immediately', () => {
    const { sim, input, player } = passiveTarget();
    input.frame.guardHeld = true;
    run(sim, input, 10);
    expect(player.state).toBe('guard');
    input.frame.dodgePressed = true;
    run(sim, input, 1);
    expect(player.state).toBe('dodge');
  });

  it('death while guarding (chip damage) is handled', () => {
    const r = blockFirstSwing((sim) => {
      sim.player.health.current = 1;
    });
    expect(r.player.isDead || r.events.some((e) => e.type === 'death')).toBe(true);
  });
});

/** Press parry when the Sentinel's swing is `framesBeforeActive` frames from landing. */
function parryAt(framesBeforeActive: number, setup?: (sim: Simulation) => void) {
  const env = engagedSim();
  const { sim, input, enemy } = env;
  setup?.(sim);
  const events: SimEvent[] = [];
  let pressed = false;
  run(sim, input, 160, () => {
    if (!pressed && enemy.fsm.is('attack') && enemy.attack.frame === CLEAVE.startupFrames - framesBeforeActive) {
      input.frame.parryPressed = true;
      pressed = true;
    }
    events.push(...drain(sim));
  });
  return { ...env, events, pressed };
}

/** Frames-before-active that lands the hit in the middle of the parry window. */
const GOOD_PARRY = PARRY.startupFrames + 3;

describe('Parrying', () => {
  it('a well-timed frontal parry negates the hit and staggers the Sentinel into a riposte opening', () => {
    const r = parryAt(GOOD_PARRY);
    expect(r.pressed).toBe(true);
    expect(r.events.some((e) => e.type === 'parry')).toBe(true);
    expect(r.player.health.current).toBe(PLAYER_COMBAT.maxHealth);
    expect(r.events.some((e) => e.type === 'hit' && e.targetFaction === 'player')).toBe(false);
  });

  it('leaves the Sentinel parried with posture damage and an opening', () => {
    const env = engagedSim();
    const { sim, input, enemy } = env;
    let state = '';
    run(sim, input, 160, () => {
      if (enemy.fsm.is('attack') && enemy.attack.frame === CLEAVE.startupFrames - GOOD_PARRY) input.frame.parryPressed = true;
      if (!state && (enemy.fsm.is('parried') || enemy.fsm.is('postureBroken'))) state = enemy.fsm.current;
    });
    expect(state).toBe('parried');
  });

  it('parrying too early whiffs, and the swing lands during the recovery', () => {
    const r = parryAt(PARRY.startupFrames + PARRY.windowFrames + 8);
    expect(r.events.some((e) => e.type === 'parry')).toBe(false);
    expect(r.player.health.current).toBeLessThan(PLAYER_COMBAT.maxHealth);
  });

  it('parrying too late fails', () => {
    const r = parryAt(1);
    expect(r.events.some((e) => e.type === 'parry')).toBe(false);
    expect(r.player.health.current).toBeLessThan(PLAYER_COMBAT.maxHealth);
  });

  it('cannot parry an attack from behind', () => {
    const r = parryAt(GOOD_PARRY, (sim) => {
      sim.player.facing = -1;
    });
    expect(r.events.some((e) => e.type === 'parry')).toBe(false);
    expect(r.player.health.current).toBeLessThan(PLAYER_COMBAT.maxHealth);
  });

  it('a whiffed parry locks out other actions until its recovery ends', () => {
    const { sim, input, player } = passiveTarget();
    input.frame.parryPressed = true;
    run(sim, input, PARRY.startupFrames + PARRY.windowFrames + 4);
    expect(player.state).toBe('parry');
    input.frame.attackPressed = true;
    run(sim, input, 1);
    expect(player.state).toBe('parry');
    expect(player.stamina.current).toBeLessThan(PLAYER_COMBAT.stamina.max);
  });
});

/** Parry the first swing, then press light attack. */
function parryThenRiposte() {
  const env = engagedSim();
  const { sim, input, enemy, player } = env;
  let riposted = false;
  let hpBefore = 0;
  let stillOpenAfterClaim: boolean | null = null;
  run(sim, input, 200, () => {
    if (enemy.fsm.is('attack') && enemy.attack.frame === CLEAVE.startupFrames - GOOD_PARRY) input.frame.parryPressed = true;
    if (enemy.fsm.is('parried') && enemy.fsm.ticks === 6) {
      hpBefore = enemy.health.current;
      input.frame.attackPressed = true;
    }
    if (player.state === 'riposte' && stillOpenAfterClaim === null) {
      riposted = true;
      stillOpenAfterClaim = enemy.canBeRiposted();
    }
  });
  return { ...env, riposted, hpBefore, stillOpenAfterClaim };
}

describe('Riposte', () => {
  it('a light attack next to a parried Sentinel becomes a riposte for heavy damage', () => {
    const r = parryThenRiposte();
    expect(r.riposted).toBe(true);
    const dealt = r.hpBefore - r.enemy.health.current;
    expect(dealt).toBeGreaterThan(RIPOSTE.damage.physical * 0.75);
    expect(r.enemy.fsm.current === 'riposted' || r.enemy.fsm.current === 'approach' || r.enemy.fsm.current === 'attack').toBe(true);
  });

  it('one opening allows exactly one riposte', () => {
    const r = parryThenRiposte();
    expect(r.stillOpenAfterClaim).toBe(false);
    // Mashing attack afterwards produces normal attacks, never a second riposte.
    const { sim, input, player, enemy } = r;
    let ripostes = 0;
    let wasRiposte = player.state === 'riposte';
    run(sim, input, 120, (i) => {
      enemy.cooldown = 999;
      if (i % 6 === 0) input.frame.attackPressed = true;
      const now = player.state === 'riposte';
      if (now && !wasRiposte) ripostes++;
      wasRiposte = now;
    });
    expect(ripostes).toBe(0);
  });

  it('the player is invulnerable while riposting', () => {
    const r = parryThenRiposte();
    expect(r.player.health.current).toBe(PLAYER_COMBAT.maxHealth);
  });

  it('is out of reach from too far away', () => {
    const { sim, input, enemy, player } = passiveTarget();
    enemy.riposteOpen = true;
    enemy.fsm.transition('parried', true);
    player.body.teleport(enemy.body.footX - 120, player.body.footY);
    run(sim, input, 1);
    input.frame.attackPressed = true;
    run(sim, input, 1);
    expect(player.state).toBe('attack');
  });
});

describe('Posture', () => {
  it('filling posture with hits breaks it and opens a riposte; hyper-armour does not prevent the break', () => {
    const { sim, input, enemy } = engagedSim();
    let broken = false;
    run(sim, input, 200, () => {
      if (enemy.fsm.is('attack') && enemy.attack.frame === 2) {
        enemy.posture.current = enemy.def.posture.max - 5;
        input.frame.attackPressed = true;
      }
      if (enemy.fsm.is('postureBroken')) {
        broken = true;
        expect(enemy.canBeRiposted()).toBe(true);
      }
    });
    expect(broken).toBe(true);
  });

  it('recovers when the pressure stops, so it is not a second health bar', () => {
    const { sim, input, enemy, hold } = passiveTarget();
    enemy.posture.damage(60);
    run(sim, input, 60, hold);
    expect(enemy.posture.current).toBe(60);
    run(sim, input, 60 * 3, hold);
    expect(enemy.posture.current).toBeLessThan(60);
  });

  it('heavy attacks deal far more posture damage than light attacks', () => {
    const light = getAttack('sword.light.1');
    expect(HEAVY.postureDamage).toBeGreaterThan(light.postureDamage * 2);
  });

  it('after being parried the Sentinel favours its delayed cleave', () => {
    const { enemy } = passiveTarget();
    enemy.forcedAttack = null;
    const sample = (parried: boolean) => {
      let delayed = 0;
      for (let i = 0; i < 400; i++) {
        enemy.wasParried = parried;
        if (enemy.chooseAttack().id === 'sentinel.cleave.delayed') delayed++;
      }
      return delayed / 400;
    };
    expect(sample(true)).toBeGreaterThan(sample(false) + 0.2);
  });
});

describe('Light attack latency is unchanged', () => {
  it('a light attack starts on the same step it is pressed', () => {
    const { sim, input, player } = passiveTarget();
    input.frame.attackPressed = true;
    run(sim, input, 1);
    expect(player.state).toBe('attack');
    expect(player.attack.attack?.kind).toBe('light');
    expect(player.actionFrame).toBe(0);
  });
});

// Keep the Sentinel type referenced for helpers above.
export type { Sentinel };
