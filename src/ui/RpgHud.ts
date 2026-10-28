import { getItem } from '../data/items';
import type { PlayerProfile } from '../rpg/Profile';

/**
 * Unobtrusive DOM read-out under the health/stamina bars: equipped weapon and
 * the three currencies. DOM text stays crisp at any pixel scale.
 */
export class RpgHud {
  private readonly root: HTMLElement;
  private readonly weapon: HTMLElement;
  private readonly currencies: HTMLElement;
  private shownRevision = -1;

  constructor(
    parent: HTMLElement,
    private readonly profile: PlayerProfile,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'rpg-hud';
    this.weapon = document.createElement('div');
    this.weapon.className = 'rpg-hud-weapon';
    this.currencies = document.createElement('div');
    this.currencies.className = 'rpg-hud-currencies';
    this.root.append(this.weapon, this.currencies);
    parent.appendChild(this.root);
  }

  update(): void {
    const p = this.profile;
    if (p.revision === this.shownRevision) return;
    this.shownRevision = p.revision;
    const instance = p.equippedWeapon();
    const name = instance ? getItem(instance.itemId).name : '—';
    this.weapon.textContent = `▸ ${name}${instance && instance.upgradeLevel > 0 ? ` +${instance.upgradeLevel}` : ''}`;
    const w = p.wallet;
    this.currencies.innerHTML = `<span class="cur-xp">XP ${w.experience}</span><span class="cur-gold">Gold ${w.gold}</span><span class="cur-fp">Forge ${w.forgePoints}</span>`;
  }

  /**
   * Sit just under the canvas-drawn health/stamina bars, which scale with the
   * game: `cssPerGamePixel` and the safe-area offsets come from the viewport.
   */
  place(cssPerGamePixel: number, safeLeftGamePx: number, safeTopGamePx: number, canvasLeftCss: number, canvasTopCss: number): void {
    // Bars occupy game rows 8..24 (see Hud.ts); leave a 3 px gap below them.
    this.root.style.left = `${canvasLeftCss + (8 + safeLeftGamePx) * cssPerGamePixel}px`;
    this.root.style.top = `${canvasTopCss + (27 + safeTopGamePx) * cssPerGamePixel}px`;
    this.root.style.fontSize = `${Math.max(9, Math.min(13, 3.4 * cssPerGamePixel))}px`;
  }

  /** Force a redraw on the next update (e.g. after an equip that didn't change the revision). */
  invalidate(): void {
    this.shownRevision = -1;
  }

  destroy(): void {
    this.root.remove();
  }
}
