import type { Rewards } from '../data/enemies';

export type Currency = 'experience' | 'gold' | 'weaponXp';

/**
 * The three currencies: Character XP (`experience`, levelling), Gold
 * (merchants) and Weapon XP (`weaponXp`, weapon upgrades). Balances are
 * whole, non-negative numbers; spending never takes one below zero.
 */
export class Wallet {
  experience = 0;
  gold = 0;
  weaponXp = 0;

  add(r: Rewards): void {
    this.experience += Math.max(0, Math.floor(r.experience));
    this.gold += Math.max(0, Math.floor(r.gold));
    this.weaponXp += Math.max(0, Math.floor(r.weaponXp));
  }

  /** Spend from one currency; returns false (and spends nothing) if the balance is short. */
  spend(currency: Currency, amount: number): boolean {
    if (!Number.isFinite(amount) || amount < 0 || this[currency] < amount) return false;
    this[currency] -= amount;
    return true;
  }

  set(values: Rewards): void {
    this.experience = values.experience;
    this.gold = values.gold;
    this.weaponXp = values.weaponXp;
  }
}
