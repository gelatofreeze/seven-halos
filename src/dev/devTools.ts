import type { SaveManager } from '../persistence/SaveGame';
import type { Simulation } from '../world/Simulation';

/**
 * DEVELOPMENT-ONLY helpers, reachable only when `DEV_TOOLS_ENABLED` (see
 * config/build.ts). They exist so the owner can test rare items without
 * farming. Commercial builds compile them out; never call them from gameplay.
 */
export const devTools = {
  /** Put an item straight into the inventory. */
  grantItem(sim: Simulation, itemId: string): void {
    sim.profile.inventory.add(itemId);
    sim.profile.touch();
  },
  /** Drop a pickup just in front of the player, to test the pickup flow. */
  dropInFront(sim: Simulation, itemId: string): void {
    const p = sim.player;
    sim.spawnPickup(itemId, 1, p.body.footX + p.facing * 28, p.body.footY - 4, 0);
  },
  addCurrencies(sim: Simulation): void {
    sim.profile.wallet.add({ experience: 500, gold: 200, weaponXp: 300 });
    sim.profile.touch();
  },
  resetSave(save: SaveManager, sim: Simulation): void {
    save.reset();
    sim.syncEquipmentFromProfile();
  },
};

/** The pause menu's development section. Only ever called behind `DEV_TOOLS_ENABLED`. */
export function renderDevSection(container: HTMLElement, sim: Simulation, save: SaveManager, done: (message: string) => void): void {
  const title = document.createElement('div');
  title.className = 'pm-dev-title';
  title.textContent = 'Development tools (test builds only)';
  const row = document.createElement('div');
  row.className = 'pm-dev';
  const add = (label: string, fn: () => void, message: string) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', () => {
      fn();
      done(message);
    });
    row.appendChild(b);
  };
  add('Grant Mourning Crescent', () => devTools.grantItem(sim, 'mourning-crescent'), 'Mourning Crescent added to your inventory.');
  add('Drop scythe in front', () => devTools.dropInFront(sim, 'mourning-crescent'), 'A scythe lies in front of you. Close this and walk over it.');
  add('+ Currencies', () => devTools.addCurrencies(sim), 'Added 500 Character XP, 200 Gold, 300 Weapon XP.');
  add('Reset save', () => devTools.resetSave(save, sim), 'Save reset: fresh profile.');
  container.append(title, row);
}
