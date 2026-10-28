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
    this.delay = this.tuning.regenDelay;
  }

  update(dt: number, busy: boolean): void {
    if (this.delay > 0) {
      this.delay = Math.max(0, this.delay - dt);
      return;
    }
    const rate = this.tuning.regenRate * (busy ? this.tuning.busyRegenMultiplier : 1);
    this.current = Math.min(this.tuning.max, this.current + rate * dt);
  }

  reset(): void {
    this.current = this.tuning.max;
    this.delay = 0;
  }
}

/** Poise: accumulated poise damage above the threshold breaks the target into hitstun. */
export class Poise {
  current: number;
  private sinceHit = 0;

  constructor(
    public max: number,
    private readonly resetDelay: number,
  ) {
    this.current = max;
  }

  /** Apply poise damage; returns true when poise breaks (and resets). */
  damage(amount: number, bonus = 0): boolean {
    this.sinceHit = 0;
    this.current -= amount;
    if (this.current + bonus <= 0) {
      this.current = this.max;
      return true;
    }
    return false;
  }

  update(dt: number): void {
    this.sinceHit += dt;
    if (this.sinceHit >= this.resetDelay) this.current = this.max;
  }

  reset(): void {
    this.current = this.max;
    this.sinceHit = 0;
  }
}
