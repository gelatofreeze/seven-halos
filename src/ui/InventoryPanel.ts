import { DEV_TOOLS_ENABLED } from '../config/build';
import { renderDevSection } from '../dev/devTools';
import type { SaveManager } from '../persistence/SaveGame';
import type { Simulation } from '../world/Simulation';
import { equipMessage, inventoryRows } from './inventoryModel';

/**
 * A compact inventory / equipment panel. Opening it pauses the game, so no
 * combat input can leak through while it is up; all actions are large,
 * tappable buttons for iPhone.
 */
export class InventoryPanel {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly message: HTMLElement;
  isOpen = false;

  constructor(
    parent: HTMLElement,
    private readonly sim: Simulation,
    private readonly save: SaveManager,
    private readonly onChange: (open: boolean) => void,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'inventory-backdrop';
    this.root.style.display = 'none';
    const panel = document.createElement('div');
    panel.className = 'inventory-panel';
    const header = document.createElement('div');
    header.className = 'inventory-header';
    header.innerHTML = '<span>Inventory</span>';
    const close = document.createElement('button');
    close.className = 'inventory-close';
    close.textContent = '✕';
    close.addEventListener('click', () => this.close());
    header.appendChild(close);
    this.body = document.createElement('div');
    this.body.className = 'inventory-body';
    this.message = document.createElement('div');
    this.message.className = 'inventory-message';
    panel.append(header, this.body, this.message);
    this.root.appendChild(panel);
    // Tapping the dimmed backdrop closes the panel; taps inside it don't.
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.close();
    });
    parent.appendChild(this.root);
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    this.isOpen = true;
    this.message.textContent = '';
    this.render();
    this.root.style.display = 'flex';
    this.onChange(true);
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.style.display = 'none';
    this.onChange(false);
  }

  private render(): void {
    const { weapons, materials } = inventoryRows(this.sim.profile);
    const w = this.sim.profile.wallet;
    this.body.innerHTML = '';
    const wallet = document.createElement('div');
    wallet.className = 'inventory-wallet';
    wallet.innerHTML = `<span class="cur-xp">Experience ${w.experience}</span><span class="cur-gold">Gold ${w.gold}</span><span class="cur-fp">Forge Points ${w.forgePoints}</span>`;
    this.body.appendChild(wallet);

    this.body.appendChild(section('Weapons'));
    for (const row of weapons) {
      const el = document.createElement('div');
      el.className = `inventory-row rarity-${row.rarity}`;
      const text = document.createElement('div');
      text.className = 'inventory-row-text';
      text.innerHTML = `<div class="inventory-name">${row.name}${row.upgradeLevel ? ` +${row.upgradeLevel}` : ''}</div><div class="inventory-sub">${row.category} · ${row.rarity}</div><div class="inventory-desc">${row.description}</div>`;
      const btn = document.createElement('button');
      btn.className = 'inventory-equip';
      btn.textContent = row.equipped ? 'Equipped' : 'Equip';
      btn.disabled = row.equipped;
      btn.addEventListener('click', () => {
        const result = this.sim.requestEquip(row.uid);
        this.render();
        this.message.textContent = equipMessage(result, row.name);
      });
      el.append(text, btn);
      this.body.appendChild(el);
    }

    this.body.appendChild(section('Materials'));
    if (materials.length === 0) this.body.appendChild(note('None yet. Enemies sometimes drop them.'));
    for (const m of materials) this.body.appendChild(note(`${m.name} × ${m.quantity}`));

    // Development-only section; the call and the module compile out of commercial builds.
    if (DEV_TOOLS_ENABLED) {
      renderDevSection(this.body, this.sim, this.save, (message) => {
        this.render();
        this.message.textContent = message;
      });
    }
  }

  destroy(): void {
    this.root.remove();
  }
}

export function section(title: string): HTMLElement {
  const h = document.createElement('div');
  h.className = 'inventory-section';
  h.textContent = title;
  return h;
}

function note(text: string): HTMLElement {
  const n = document.createElement('div');
  n.className = 'inventory-note';
  n.textContent = text;
  return n;
}
