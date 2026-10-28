/** Hit points. */
export class Health {
  current: number;

  constructor(public max: number) {
    this.current = max;
  }

  get isDepleted(): boolean {
    return this.current <= 0;
  }

  get ratio(): number {
    return this.max > 0 ? this.current / this.max : 0;
  }

  /** Returns damage actually dealt. */
  damage(amount: number): number {
    const dealt = Math.min(this.current, Math.max(0, amount));
    this.current -= dealt;
    return dealt;
  }

  heal(amount: number): void {
    this.current = Math.min(this.max, this.current + Math.max(0, amount));
  }

  reset(): void {
    this.current = this.max;
  }
}

export interface StaminaTuning {
  max: number;
  /** Regeneration per second. */
  regenRate: number;
  /** Seconds after spending before regeneration resumes. */
  regenDelay: number;
  /** Seconds before regeneration resumes when a spend empties the meter (exhaustion penalty). */
  exhaustedRegenDelay: number;
  /** Regeneration multiplier while an action (attack, dodge) is in progress. */
  busyRegenMultiplier: number;
}

/**
 * Stamina in the Souls tradition: any action can start as long as stamina is
 * above zero, even if its cost is higher; the meter then bottoms out at zero.
 */
export class Stamina {
  current: number;
  private delay = 0;

  constructor(readonly tuning: StaminaTuning) {
    this.current = tuning.max;
  }

  get ratio(): number {
    return this.current / this.tuning.max;
  }

  canSpend(): boolean {
    return this.current > 0;
  }

  spend(cost: number): void {
    this.current = Math.max(0, this.current - cost);
    this.delay = this.current <= 0 ? this.tuning.exhaustedRegenDelay : this.tuning.regenDelay;
  }

  /** `regenMultiplier` scales regeneration (0 while attacking, reduced while guarding). */
  update(dt: number, regenMultiplier = 1): void {
    if (this.delay > 0) {
      this.delay = Math.max(0, this.delay - dt);
      return;
    }
    const rate = this.tuning.regenRate * regenMultiplier;
    this.current = Math.min(this.tuning.max, this.current + rate * dt);
  }

  reset(): void {
    this.current = this.tuning.max;
    this.delay = 0;
  }
}

export interface PostureTuning {
  max: number;
  /** Seconds without posture damage before it starts to recover. */
  regenDelay: number;
  /** Posture recovered per second once recovering. */
  regenRate: number;
}

/**
 * Posture: how close a combatant is to losing its footing. It fills with
 * posture damage and drains back when the pressure stops, so it rewards
 * sustained, well-timed offense rather than total damage. Filling it
 * completely is a posture break: a long stagger that opens a riposte.
 */
export class Posture {
  current = 0;
  private sinceDamage = 0;

  constructor(readonly tuning: PostureTuning) {}

  get ratio(): number {
    return Math.min(1, this.current / this.tuning.max);
  }

  /** Add posture damage; returns true when this breaks posture. */
  damage(amount: number): boolean {
    this.sinceDamage = 0;
    this.current = Math.min(this.tuning.max, this.current + Math.max(0, amount));
    return this.current >= this.tuning.max;
  }

  update(dt: number): void {
    this.sinceDamage += dt;
    if (this.sinceDamage >= this.tuning.regenDelay) this.current = Math.max(0, this.current - this.tuning.regenRate * dt);
  }

  reset(): void {
    this.current = 0;
    this.sinceDamage = 0;
  }
}
