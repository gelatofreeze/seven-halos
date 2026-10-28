import { getRegionDef } from '../world/regions';
import type { Simulation } from '../world/Simulation';
import { travelDestinations } from './worldModel';

/**
 * The shrine menu: rest, fast travel to another activated shrine, or leave.
 * Opens when the player uses an activated shrine; the game is paused while
 * it is up. Every action goes through the simulation's validated requests
 * (`requestRest`, `requestFastTravel`); this class only draws and routes.
 */
export class ShrineMenu {
  readonly root: HTMLElement;
  isOpen = false;
  private readonly panel: HTMLElement;
  private shrineId = '';
  private view: 'main' | 'travel' = 'main';

  constructor(
    parent: HTMLElement,
    private readonly sim: Simulation,
    private readonly onChange: (open: boolean) => void,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'sm-backdrop';
    this.root.style.display = 'none';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', 'Shrine');
    this.panel = document.createElement('div');
    this.panel.className = 'sm';
    this.root.appendChild(this.panel);
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.close();
    });
    parent.appendChild(this.root);
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
  }

  open(shrineId: string, firstTime: boolean): void {
    this.shrineId = shrineId;
    this.view = 'main';
    this.isOpen = true;
    this.root.style.display = 'flex';
    this.onChange(true);
    this.render(firstTime);
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.style.display = 'none';
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    this.onChange(false);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown, { capture: true });
    this.root.remove();
  }

  private button(label: string, onClick: () => void, cls = ''): HTMLButtonElement {
    const b = document.createElement('button');
    b.className = `sm-button ${cls}`;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  private render(firstTime = false): void {
    const shrine = this.sim.currentShrine();
    this.panel.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'sm-title';
    title.textContent = shrine?.name ?? 'Shrine';
    const sub = document.createElement('div');
    sub.className = 'sm-sub';
    sub.textContent = firstTime ? 'The shrine is lit. You will return here if you fall.' : getRegionDef(this.sim.level.id).name;
    this.panel.append(title, sub);

    const list = document.createElement('div');
    list.className = 'sm-list';
    if (this.view === 'main') {
      list.append(
        this.button('Rest', () => {
          if (this.sim.requestRest() === 'ok') this.close();
        }, 'primary'),
        this.button('Travel', () => {
          this.view = 'travel';
          this.render();
        }),
        this.button('Leave', () => this.close()),
      );
      const note = document.createElement('div');
      note.className = 'sm-note';
      note.textContent = 'Resting restores you and returns ordinary enemies. Your items and progress are kept.';
      this.panel.append(list, note);
    } else {
      const dests = travelDestinations(this.sim.profile.world, this.shrineId);
      for (const d of dests) {
        const b = this.button(d.here ? `${d.name} · you are here` : d.name, () => {
          if (this.sim.requestFastTravel(d.id) === 'ok') this.close();
        });
        b.disabled = d.here;
        const region = document.createElement('span');
        region.className = 'sm-region';
        region.textContent = d.regionName;
        b.appendChild(region);
        list.appendChild(b);
      }
      if (dests.length <= 1) {
        const note = document.createElement('div');
        note.className = 'sm-note';
        note.textContent = 'Light other shrines to travel between them.';
        list.appendChild(note);
      }
      list.appendChild(this.button('Back', () => {
        this.view = 'main';
        this.render();
      }));
      this.panel.appendChild(list);
    }
    this.panel.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }

  /** Capture phase: keys drive the menu and never reach gameplay while it is open. */
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.isOpen) return;
    e.stopImmediatePropagation();
    if (e.code === 'Escape' || e.code === 'KeyI') {
      e.preventDefault();
      if (this.view === 'travel') {
        this.view = 'main';
        this.render();
      } else this.close();
      return;
    }
    if (e.code !== 'ArrowUp' && e.code !== 'ArrowDown') return;
    e.preventDefault();
    const buttons = [...this.panel.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(i + (e.code === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
  };
}
