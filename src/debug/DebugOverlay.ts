import type Phaser from 'phaser';
import type { DebugFlags } from '../config/debug';
import { makeRect } from '../core/Rect';
import type { Simulation } from '../world/Simulation';

/**
 * World-space collision/hitbox drawing plus a DOM text panel with the
 * player's state machine, frame counters and physics values.
 */
export class DebugOverlay {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly panel: HTMLPreElement;
  private readonly scratch = makeRect();
  private fpsSmoothed = 60;

  constructor(
    scene: Phaser.Scene,
    private readonly sim: Simulation,
    readonly flags: DebugFlags,
  ) {
    this.g = scene.add.graphics().setDepth(200);
    this.panel = document.createElement('pre');
    this.panel.className = 'debug-panel';
    document.getElementById('app')?.appendChild(this.panel);
    this.apply();
  }

  toggle(): void {
    this.flags.enabled = !this.flags.enabled;
    this.apply();
  }

  private apply(): void {
    this.g.setVisible(this.flags.enabled);
    this.panel.style.display = this.flags.enabled && this.flags.showStatePanel ? 'block' : 'none';
  }

  update(dt: number): void {
    if (!this.flags.enabled) return;
    const g = this.g;
    const sim = this.sim;
    const f = this.flags;
    g.clear();
    if (f.showSolids) {
      for (const s of sim.world.solids) {
        g.lineStyle(1, s.oneWay ? 0xffd166 : 0x4cc9f0, 0.5).strokeRect(s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1);
      }
    }
    for (const c of sim.combatants) {
      if (f.showHurtboxes && c.getHurtbox(this.scratch)) {
        const r = this.scratch;
        g.lineStyle(1, c.isInvulnerable() ? 0x00ffcc : 0x3a86ff, 1).strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      }
    }
    if (f.showBodies) {
      const b = sim.player.body;
      g.fillStyle(b.grounded ? 0x80ff80 : 0xff8080, 1).fillRect(b.footX - 1, b.footY - 1, 2, 2);
    }
    if (f.showHitboxes) {
      sim.combat.detection.forEachActive((hb) => {
        g.fillStyle(0xff3355, 0.35).fillRect(hb.rect.x, hb.rect.y, hb.rect.w, hb.rect.h);
        g.lineStyle(1, 0xff3355, 1).strokeRect(hb.rect.x + 0.5, hb.rect.y + 0.5, hb.rect.w - 1, hb.rect.h - 1);
      });
      for (const e of sim.enemies) {
        if (e.fsm.is('attack') && e.attack.phase === 'startup') {
          // Preview where the telegraphed strike will land.
          const spec = e.attackDef.hitboxes[0];
          if (spec) {
            const x = e.facing === 1 ? e.body.footX + spec.x : e.body.footX - spec.x - spec.w;
            g.lineStyle(1, 0xff9f1c, 0.8).strokeRect(x + 0.5, e.body.footY + spec.y + 0.5, spec.w - 1, spec.h - 1);
          }
        }
      }
    }

    if (f.showStatePanel) {
      this.fpsSmoothed += (1 / Math.max(dt, 1e-3) - this.fpsSmoothed) * 0.05;
      const p = sim.player;
      const b = p.body;
      const e = sim.enemies[0];
      this.panel.textContent = [
        `fps ${this.fpsSmoothed.toFixed(0)}  tick ${sim.tick}${sim.inHitstop ? '  HITSTOP' : ''}`,
        `player ${p.state}  frame ${p.actionFrame}  t ${p.fsm.time.toFixed(2)}`,
        `pos ${b.footX.toFixed(1)}, ${b.footY.toFixed(1)}  vel ${b.vx.toFixed(0)}, ${b.vy.toFixed(0)}`,
        `grounded ${b.grounded}  coyote ${(p.coyoteTimer * 1000).toFixed(0)}ms  jumpBuf ${(p.jumpBuffer * 1000).toFixed(0)}ms`,
        `invuln ${p.isInvulnerable()}  hp ${p.health.current}/${p.health.max}  st ${p.stamina.current.toFixed(0)}`,
        p.attack.attack ? `attack ${p.attack.attack.id} ${p.attack.phase} f${p.attack.frame}` : '',
        e ? `sentinel ${e.fsm.current}${e.fsm.is('attack') ? ` ${e.attack.phase} f${e.attack.frame}` : ''}  hp ${e.health.current}  poise ${e.poise.current}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
  }
}
