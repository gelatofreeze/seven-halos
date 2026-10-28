import type { Rewards } from '../data/enemies';

/**
 * The three separate currencies: Experience (levelling), Gold (merchants)
 * and Forge Points (weapon upgrades). Balances are whole, non-negative numbers.
 */
export class Wallet {
  experience = 0;
  gold = 0;
  forgePoints = 0;

  add(r: Rewards): void {
    this.experience += Math.max(0, Math.floor(r.experience));
    this.gold += Math.max(0, Math.floor(r.gold));
    this.forgePoints += Math.max(0, Math.floor(r.forgePoints));
  }

  /** Spend from one currency; returns false (and spends nothing) if the balance is short. */
  spend(currency: 'experience' | 'gold' | 'forgePoints', amount: number): boolean {
    if (amount < 0 || this[currency] < amount) return false;
    this[currency] -= amount;
    return true;
  }

  set(values: Rewards): void {
    this.experience = values.experience;
    this.gold = values.gold;
    this.forgePoints = values.forgePoints;
  }
}
