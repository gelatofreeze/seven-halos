import type { State } from '../../core/StateMachine';
import { approach } from '../../core/math';
import { getAttack } from '../../data/weapons';
import { PLAYER_COMBAT } from '../../config/player';
import type { Player } from './Player';

/**
 * Player action states.
 *
 * Locomotion: idle, run, jump (rising), fall, land.
 * Actions:    dodge, attack.
 * Reactions:  hurt, dead.
 *
 * Convention: a state that returns a transition does so before applying any
 * per-tick movement, because the next state runs in the same tick.
 */
export type PlayerStateId = 'idle' | 'run' | 'jump' | 'fall' | 'land' | 'dodge' | 'attack' | 'hurt' | 'dead';

type PlayerState = State<Player, PlayerStateId>;

const grounded: PlayerState = {
  update(p, dt) {
    if (!p.body.grounded) return 'fall';
    const action = p.tryStartAction();
    if (action) return action;
    const next = p.locomotionState();
    if (next !== p.state) return next;
    p.moveHorizontal(dt);
    p.faceInput();
  },
};

const jump: PlayerState = {
  update(p, dt) {
    if (p.body.grounded && p.body.vy >= 0) return 'land';
    const action = p.tryStartAction();
    if (action) return action;
    if (p.body.vy >= 0) return 'fall';
    // Variable jump height: releasing early clamps the remaining upward speed once.
    if (!p.input.jumpHeld && !p.jumpCutApplied) {
      p.body.vy = Math.max(p.body.vy, -p.takeoffSpeed * p.tuning.jump.releaseVelocityCut);
      p.jumpCutApplied = true;
    }
    p.moveHorizontal(dt);
    p.faceInput();
  },
};

const fall: PlayerState = {
  update(p, dt) {
    if (p.body.grounded) {
      // A buffered jump fires on the landing frame, skipping the landing state.
      const action = p.tryStartAction();
      return action ?? 'land';
    }
    const action = p.tryStartAction();
    if (action) return action;
    p.moveHorizontal(dt);
    p.faceInput();
  },
};

const land: PlayerState = {
  enter(p) {
    p.events.push({ type: 'land', x: p.body.footX, y: p.body.footY, hard: isHardLanding(p) });
  },
  update(p, dt) {
    if (!p.body.grounded) return 'fall';
    const action = p.tryStartAction();
    if (action) return action;
    const l = p.tuning.landing;
    const hard = isHardLanding(p);
    if (p.fsm.time >= (hard ? l.hardDuration : l.softDuration)) return p.locomotionState();
    p.moveHorizontal(dt, hard ? l.hardSpeedMultiplier : 1);
    p.faceInput();
  },
};

function isHardLanding(p: Player): boolean {
  return p.landingSpeed >= p.tuning.landing.hardLandingSpeed;
}

const dodge: PlayerState = {
  enter(p) {
    const d = p.tuning.dodge;
    p.stamina.spend(d.staminaCost);
    p.dodgeBuffer = 0;
    p.jumping = false;
    p.actionFrame = -1;
    p.dodgeDirection = p.input.moveX !== 0 ? (p.input.moveX > 0 ? 1 : -1) : p.facing;
    p.facing = p.dodgeDirection;
    p.events.push({ type: 'dodge', x: p.body.footX, y: p.body.footY, facing: p.facing });
  },
  update(p, dt) {
    const d = p.tuning.dodge;
    const frame = p.fsm.ticks;
    p.actionFrame = frame;
    const total = d.startupFrames + d.invulnerableFrames + d.recoveryFrames;
    if (frame >= total) return p.locomotionState();
    if (frame >= d.cancelFrame) {
      const action = p.tryStartAction();
      if (action === 'dodge') {
        p.fsm.transition('dodge', true);
        return;
      }
      if (action) return action;
    }
    const dir = p.dodgeDirection;
    if (frame < d.startupFrames) p.body.vx = dir * d.startupSpeed;
    else if (frame < d.startupFrames + d.invulnerableFrames) p.body.vx = dir * d.activeSpeed;
    else {
      const decay = (d.activeSpeed - d.recoveryEndSpeed) / (d.recoveryFrames / 60);
      p.body.vx = approach(p.body.vx, dir * d.recoveryEndSpeed, decay * dt);
    }
  },
  exit(p) {
    p.actionFrame = -1;
  },
};

const attack: PlayerState = {
  enter(p) {
    const def = p.pendingComboAttack ?? p.equipment.lightAttack();
    p.pendingComboAttack = null;
    p.attack.start(def);
    p.stamina.spend(def.staminaCost);
    p.attackBuffer = 0;
    p.actionFrame = -1;
    // The attack may be aimed on its first frame; facing is locked afterwards.
    p.faceInput();
    p.events.push({ type: 'attack', faction: 'player', attackId: def.id, x: p.body.footX, y: p.body.footY, facing: p.facing });
  },
  update(p, dt) {
    const def = p.attack.attack!;
    const frame = p.fsm.ticks;
    p.actionFrame = frame;
    p.attack.frame = frame;
    if (p.attack.isDone) return p.locomotionState();

    if (frame >= def.cancels.dodgeFrom) {
      if (p.dodgeBuffer > 0 && p.canDodge()) return 'dodge';
      if (p.jumpBuffer > 0 && p.canJump()) {
        p.doJump();
        return 'jump';
      }
    }
    if (frame >= def.cancels.chainFrom && def.next && p.attackBuffer > 0 && p.canAttack()) {
      p.pendingComboAttack = getAttack(def.next);
      p.fsm.transition('attack', true);
      return;
    }

    if (p.body.grounded) {
      if (frame === def.movement.lungeFrame) p.body.vx = p.facing * def.movement.lungeSpeed;
      else p.applyFriction(def.movement.friction, dt);
    } else {
      // Airborne attacks keep momentum with light drag.
      p.applyFriction(p.tuning.air.deceleration * 0.5, dt);
    }
  },
  exit(p) {
    p.attack.clear();
    p.actionFrame = -1;
  },
};

const hurt: PlayerState = {
  enter(p) {
    p.jumping = false;
    p.attackBuffer = 0;
  },
  update(p, dt) {
    if (p.fsm.ticks >= p.hurtFrames && (p.body.grounded || p.fsm.ticks >= p.hurtFrames * 2)) return p.locomotionState();
    if (p.body.grounded) p.applyFriction(p.tuning.ground.deceleration * 0.6, dt);
  },
};

const dead: PlayerState = {
  enter(p) {
    p.jumping = false;
    p.events.push({ type: 'death', faction: 'player', x: p.body.footX, y: p.body.footY });
  },
  update(p, dt) {
    if (p.fsm.time >= PLAYER_COMBAT.respawnDelay) {
      p.respawn();
      return;
    }
    if (p.body.grounded) p.applyFriction(p.tuning.ground.deceleration, dt);
  },
};

export const PLAYER_STATES: Record<PlayerStateId, PlayerState> = {
  idle: grounded,
  run: grounded,
  jump,
  fall,
  land,
  dodge,
  attack,
  hurt,
  dead,
};
