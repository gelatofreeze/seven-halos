import { DEV_TOOLS_ENABLED } from '../config/build';
import { MENU_LAYOUT } from '../config/menu';
import { getSlot, isSlotId, type SlotId } from '../data/equipmentSlots';
import { renderDevSection } from '../dev/devTools';
import type { SaveManager } from '../persistence/SaveGame';
import type { Simulation } from '../world/Simulation';
import { JournalPanel } from './JournalPanel';
import { backpackCells, equipMessage, equipmentSlots, itemDetails, progression, unequipMessage, upgradeMessage, validTargets, type CellView } from './menuModel';

export type MenuLayout = 'wide' | 'split' | 'tabs';
type Area = 'gear' | 'bag' | 'item' | 'upgrade';
/** Where a dragged item came from: the backpack, or an equipment slot. */
type DragSource = 'bag' | SlotId;

interface DragState {
  pointerId: number;
  pointerType: string;
  uid: number;
  from: DragSource;
  el: HTMLElement;
  startX: number;
  startY: number;
  active: boolean;
  timer: number;
  ghost: HTMLElement | null;
  hover: HTMLElement | null;
}

/** Pick a layout from the space available (CSS px). Pure, so it's tested. */
export function chooseLayout(width: number, height: number): MenuLayout {
  if (width >= MENU_LAYOUT.wideMinWidth && height >= MENU_LAYOUT.wideMinHeight) return 'wide';
  if (width >= MENU_LAYOUT.splitMinWidth) return 'split';
  return 'tabs';
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
};

/**
 * The pause menu: equipment, backpack grid, item details and progression.
 * Opening it pauses the game (the scene stops stepping) and its owner drops
 * every held and pending input, so nothing leaks into combat on either side.
 *
 * Every action goes through the simulation or the domain services; this class
 * only draws `menuModel` data and routes gestures. Items move by pointer drag
 * (mouse, touch, pen) or by tapping an item and then a highlighted slot. It
 * redraws only after an action, never per frame.
 */
export class PauseMenu {
  readonly root: HTMLElement;
  isOpen = false;
  layout: MenuLayout = 'split';
  private readonly panel: HTMLElement;
  private readonly currencies: HTMLElement;
  private readonly tabs: HTMLElement;
  private readonly areas: Record<Area, HTMLElement>;
  private readonly slotsEl: HTMLElement;
  private readonly gridEl: HTMLElement;
  private readonly bagTitle: HTMLElement;
  private readonly detailsEl: HTMLElement;
  private readonly progressEl: HTMLElement;
  private readonly message: HTMLElement;
  private tab: Area = 'item';
  private selectedUid = 0;
  private drag: DragState | null = null;
  /** A drag just ended: ignore the click the browser sends after pointerup. */
  private suppressClickUntil = 0;
  private upgrading = false;
  private readonly journal: JournalPanel;

  constructor(
    parent: HTMLElement,
    private readonly sim: Simulation,
    private readonly save: SaveManager,
    private readonly onChange: (open: boolean) => void,
  ) {
    this.root = el('div', 'pm-backdrop');
    this.root.style.display = 'none';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', 'Pause menu');
    this.panel = el('div', 'pm');

    const header = el('div', 'pm-header');
    header.appendChild(el('div', 'pm-title', 'Paused'));
    this.currencies = el('div', 'pm-currencies');
    this.tabs = el('div', 'pm-tabs');
    this.tabs.setAttribute('role', 'tablist');
    const close = el('button', 'pm-close', '✕');
    close.setAttribute('aria-label', 'Close menu');
    close.addEventListener('click', () => this.close());
    const journal = el('button', 'pm-tab pm-journal', 'Journal');
    journal.dataset.key = 'journal';
    journal.addEventListener('click', () => this.journal.open());
    header.append(this.currencies, this.tabs, journal, close);

    const body = el('div', 'pm-body');
    const area = (name: Area, title: string, cls: string) => {
      const section = el('section', `pm-area ${cls}`);
      section.dataset.area = name;
      const h = el('h2', 'pm-area-title', title);
      section.appendChild(h);
      body.appendChild(section);
      return section;
    };
    this.areas = {
      gear: area('gear', 'Equipment', 'pm-equipment'),
      bag: area('bag', 'Backpack', 'pm-backpack'),
      item: area('item', 'Item', 'pm-details'),
      upgrade: area('upgrade', 'Progression', 'pm-progress'),
    };
    this.bagTitle = this.areas.bag.firstElementChild as HTMLElement;
    this.slotsEl = el('div', 'pm-slots');
    this.areas.gear.appendChild(this.slotsEl);
    this.gridEl = el('div', 'pm-grid menu-scroll');
    this.gridEl.setAttribute('role', 'grid');
    this.areas.bag.appendChild(this.gridEl);
    this.detailsEl = el('div', 'pm-details-body menu-scroll');
    this.areas.item.appendChild(this.detailsEl);
    this.progressEl = el('div', 'pm-progress-body menu-scroll');
    this.areas.upgrade.appendChild(this.progressEl);

    const footer = el('div', 'pm-footer');
    this.message = el('div', 'pm-message');
    this.message.setAttribute('aria-live', 'polite');
    footer.appendChild(this.message);

    this.panel.append(header, body, footer);
    this.root.appendChild(this.panel);
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.close();
    });
    // While dragging, the page must not scroll: cancel the touch's default action.
    this.root.addEventListener('touchmove', (e) => {
      if (this.drag?.active) e.preventDefault();
    }, { passive: false });
    parent.appendChild(this.root);
    this.journal = new JournalPanel(parent, sim.profile);

    window.addEventListener('pointermove', this.onPointerMove, { passive: false });
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerCancel);
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
    window.addEventListener('resize', this.onResize);
    window.addEventListener('blur', this.cancelDrag);
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.upgrading = false;
    this.message.textContent = '';
    if (!this.sim.profile.inventory.find(this.selectedUid)) this.selectedUid = this.sim.profile.equippedWeaponUid;
    this.root.style.display = 'flex';
    this.onChange(true);
    this.applyLayout();
    this.render();
    this.focusKey(`bag:${this.selectedUid}`);
  }

  /** Open straight onto the journal (e.g. from a quest toast later). */
  openJournal(): void {
    this.open();
    this.journal.open();
  }

  close(): void {
    if (!this.isOpen) return;
    this.journal.close();
    this.cancelDrag();
    this.isOpen = false;
    this.root.style.display = 'none';
    // Don't leave focus on a hidden button (Space would "press" it again).
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    this.onChange(false);
  }

  destroy(): void {
    this.cancelDrag();
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerCancel);
    window.removeEventListener('keydown', this.onKeyDown, { capture: true });
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('blur', this.cancelDrag);
    this.journal.destroy();
    this.root.remove();
  }

  // ---- Layout ------------------------------------------------------------------------------

  private readonly onResize = (): void => {
    // Rotating mid-drag would leave the ghost and highlights misplaced: cancel cleanly.
    this.cancelDrag();
    if (this.isOpen) this.applyLayout();
  };

  private applyLayout(): void {
    const r = this.root.getBoundingClientRect();
    this.layout = chooseLayout(r.width || window.innerWidth, r.height || window.innerHeight);
    this.panel.dataset.layout = this.layout;
    if (this.layout === 'split' && (this.tab === 'gear' || this.tab === 'bag')) this.tab = 'item';
    const visible: Record<MenuLayout, Area[]> = {
      wide: ['gear', 'bag', 'item', 'upgrade'],
      split: ['gear', 'bag', this.tab],
      tabs: [this.tab],
    };
    for (const [name, section] of Object.entries(this.areas) as [Area, HTMLElement][]) section.hidden = !visible[this.layout].includes(name);
    this.renderTabs();
  }

  private renderTabs(): void {
    this.tabs.innerHTML = '';
    const names: [Area, string][] =
      this.layout === 'tabs'
        ? [
            ['gear', 'Gear'],
            ['bag', 'Bag'],
            ['item', 'Item'],
            ['upgrade', 'Upgrade'],
          ]
        : this.layout === 'split'
          ? [
              ['item', 'Item'],
              ['upgrade', 'Upgrade'],
            ]
          : [];
    for (const [area, label] of names) {
      const b = el('button', 'pm-tab', label);
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(this.tab === area));
      b.dataset.key = `tab:${area}`;
      b.addEventListener('click', () => this.showTab(area));
      this.tabs.appendChild(b);
    }
  }

  private showTab(area: Area): void {
    this.tab = area;
    this.applyLayout();
  }

  // ---- Rendering ---------------------------------------------------------------------------

  private render(): void {
    const focused = (document.activeElement as HTMLElement | null)?.dataset?.key;
    const profile = this.sim.profile;
    const prog = progression(profile, this.selectedUid);
    this.currencies.innerHTML = '';
    for (const [cls, label, value] of [
      ['cur-xp', 'XP', prog.characterXp],
      ['cur-wxp', 'WXP', prog.weaponXp],
      ['cur-gold', 'Gold', prog.gold],
    ] as const) {
      const c = el('span', cls);
      c.append(el('b', '', label), ` ${value}`);
      this.currencies.appendChild(c);
    }
    this.renderSlots();
    this.renderBackpack();
    this.renderDetails();
    this.renderProgress();
    if (focused) this.focusKey(focused);
  }

  private renderSlots(): void {
    const profile = this.sim.profile;
    const targets = new Set(this.selectedUid ? validTargets(profile, this.selectedUid) : []);
    this.slotsEl.innerHTML = '';
    for (const { slot, item } of equipmentSlots(profile)) {
      const b = el('button', `pm-slot${item ? ` rarity-${item.rarity}` : ' empty'}${slot.functional ? '' : ' placeholder'}`);
      b.dataset.drop = `slot:${slot.id}`;
      b.dataset.key = `slot:${slot.id}`;
      // Tap-to-equip: with an item selected, the slots it fits glow and a tap equips it.
      if (targets.has(slot.id) && profile.loadout.get(slot.id) !== this.selectedUid) b.classList.add('slot-target');
      if (item && item.uid === this.selectedUid) b.classList.add('selected');
      const icon = el('span', 'pm-slot-icon', item ? item.icon : slot.icon);
      const label = el('span', 'pm-slot-label', item ? `${item.name}${item.tier ? ` +${item.tier}` : ''}` : slot.label);
      b.append(icon, label);
      b.title = item?.effects.length ? `${slot.label}: ${item.name} — ${item.effects.join('; ')}` : slot.functional ? slot.label : `${slot.label} (coming later)`;
      if (item?.effects.length) b.appendChild(el('span', 'pm-slot-effect', '✦'));
      b.setAttribute('aria-label', item ? `${slot.label}: ${item.name}${item.tier ? ` plus ${item.tier}` : ''}` : `${slot.label}: empty${slot.functional ? '' : ', coming later'}`);
      b.addEventListener('click', () => this.onSlotTap(slot.id));
      if (item) b.addEventListener('pointerdown', (e) => this.onPointerDown(e, item.uid, slot.id, b));
      this.slotsEl.appendChild(b);
    }
  }

  private renderBackpack(): void {
    const cells = backpackCells(this.sim.profile);
    this.bagTitle.textContent = `Backpack · ${cells.length}`;
    this.gridEl.innerHTML = '';
    cells.forEach((cell, index) => this.gridEl.appendChild(this.cellButton(cell, index)));
    // Empty cells keep the grid shape and are drop targets ("move to the end").
    const cols = this.gridColumns();
    const total = Math.max(MENU_LAYOUT.minBackpackCells, Math.ceil((cells.length + 1) / cols) * cols);
    for (let i = cells.length; i < total; i++) {
      const empty = el('div', 'pm-cell empty');
      empty.dataset.drop = `bag:${i}`;
      empty.setAttribute('aria-hidden', 'true');
      this.gridEl.appendChild(empty);
    }
  }

  private cellButton(cell: CellView, index: number): HTMLElement {
    const b = el('button', `pm-cell rarity-${cell.rarity}`);
    b.dataset.drop = `bag:${index}`;
    b.dataset.key = `bag:${cell.uid}`;
    b.dataset.uid = String(cell.uid);
    if (cell.uid === this.selectedUid) b.classList.add('selected');
    if (cell.equippedIn) b.classList.add('equipped');
    b.appendChild(el('span', 'pm-cell-icon', cell.icon));
    if (cell.tier) b.appendChild(el('span', 'pm-cell-tier', `+${cell.tier}`));
    if (cell.quantity > 1) b.appendChild(el('span', 'pm-cell-qty', `×${cell.quantity}`));
    if (cell.equippedIn) b.appendChild(el('span', 'pm-cell-eq', 'E'));
    b.title = cell.name;
    b.setAttribute('aria-label', `${cell.name}${cell.tier ? ` plus ${cell.tier}` : ''}${cell.quantity > 1 ? `, ${cell.quantity}` : ''}, ${cell.rarity}${cell.equippedIn ? ', equipped' : ''}`);
    b.addEventListener('click', () => this.onCellTap(cell.uid));
    b.addEventListener('pointerdown', (e) => this.onPointerDown(e, cell.uid, 'bag', b));
    return b;
  }

  private renderDetails(): void {
    const d = itemDetails(this.sim.profile, this.selectedUid);
    this.detailsEl.innerHTML = '';
    if (!d) {
      this.detailsEl.appendChild(el('p', 'pm-note', 'Select an item to see its details.'));
      return;
    }
    const head = el('div', `pm-item-head rarity-${d.cell.rarity}`);
    head.append(el('span', 'pm-item-icon', d.cell.icon));
    const names = el('div', 'pm-item-names');
    names.append(
      el('div', 'pm-item-name', `${d.cell.name}${d.cell.tier ? ` +${d.cell.tier}` : ''}`),
      el('div', 'pm-item-sub', `${d.category} · ${d.cell.rarity}${d.cell.quantity > 1 ? ` · ×${d.cell.quantity}` : ''}${d.cell.equippedIn ? ` · equipped (${getSlot(d.cell.equippedIn).label.toLowerCase()})` : ''}`),
    );
    head.appendChild(names);
    this.detailsEl.append(head, el('p', 'pm-item-desc', d.description));
    if (d.cell.effects.length) {
      // What it does, in plain words, and whether it's doing it now.
      const box = el('div', `pm-effects${d.cell.equippedIn ? ' active' : ''}`);
      for (const line of d.cell.effects) box.appendChild(el('div', 'pm-effect', `✦ ${line}`));
      if (d.effectNote) box.appendChild(el('div', 'pm-note', d.effectNote));
      this.detailsEl.appendChild(box);
    }

    if (d.stats) {
      const table = el('table', 'pm-stats');
      const caption = el('caption', '', d.comparedWith ? `vs ${d.comparedWith}` : `Tier ${d.cell.tier} / ${d.cell.maxTier}`);
      table.appendChild(caption);
      for (const s of d.stats) {
        const tr = el('tr');
        tr.append(el('th', '', s.label), el('td', '', String(s.value)));
        const delta = el('td', `pm-delta ${s.verdict ?? ''}`);
        if (s.delta !== undefined && s.delta !== 0) delta.textContent = `${s.delta > 0 ? '+' : ''}${s.delta}`;
        tr.appendChild(delta);
        table.appendChild(tr);
      }
      this.detailsEl.appendChild(table);
    }

    const actions = el('div', 'pm-actions');
    for (const a of d.actions) {
      const b = el('button', 'pm-button', a.state === 'equipped' ? `Equipped · ${a.label}` : `Equip · ${a.label}`);
      b.dataset.key = `equip:${a.slot}`;
      b.disabled = a.state !== 'ok';
      b.addEventListener('click', () => this.equip(this.selectedUid, a.slot));
      actions.appendChild(b);
    }
    if (d.unequipFrom) {
      const from = d.unequipFrom;
      const b = el('button', 'pm-button subtle', 'Unequip');
      b.dataset.key = `unequip:${from}`;
      b.addEventListener('click', () => this.unequip(from));
      actions.appendChild(b);
    }
    if (d.actions.length === 0) actions.appendChild(el('p', 'pm-note', d.cell.kind === 'material' ? 'A material. It will be used for crafting in a later update.' : 'Cannot be equipped.'));
    if (this.layout !== 'wide' && d.stats) {
      const up = el('button', 'pm-button subtle', 'Upgrade ›');
      up.dataset.key = 'goto:upgrade';
      up.addEventListener('click', () => this.showTab('upgrade'));
      actions.appendChild(up);
    }
    this.detailsEl.appendChild(actions);
  }

  private renderProgress(): void {
    const p = progression(this.sim.profile, this.selectedUid);
    this.progressEl.innerHTML = '';
    const wallet = el('dl', 'pm-wallet');
    for (const [cls, label, value, note] of [
      ['cur-xp', 'Character XP', p.characterXp, 'for levelling (coming later)'],
      ['cur-wxp', 'Weapon XP', p.weaponXp, 'spent on weapon upgrades'],
      ['cur-gold', 'Gold', p.gold, 'for merchants (coming later)'],
    ] as const) {
      const dt = el('dt', cls, label);
      const dd = el('dd');
      dd.append(el('b', cls, String(value)), el('span', 'pm-note', ` ${note}`));
      wallet.append(dt, dd);
    }
    this.progressEl.appendChild(wallet);

    const q = p.upgrade;
    if (q) {
      const box = el('div', 'pm-upgrade');
      box.appendChild(el('div', 'pm-upgrade-title', `${q.name}${q.level ? ` +${q.level}` : ''}`));
      box.appendChild(el('div', 'pm-upgrade-tier', q.nextLevel === null ? `Tier ${q.level} / ${q.maxLevel} · max` : `Tier ${q.level} → ${q.nextLevel}  (max ${q.maxLevel})`));
      if (q.next) {
        const list = el('ul', 'pm-upgrade-gains');
        for (const key of ['light', 'combo', 'heavy', 'charged'] as const) {
          const li = el('li');
          li.append(`${key[0]!.toUpperCase()}${key.slice(1)} ${q.current[key]} → `, el('b', '', String(q.next[key])), el('span', 'pm-delta better', ` +${q.next[key] - q.current[key]}`));
          list.appendChild(li);
        }
        box.appendChild(list);
        box.appendChild(el('div', 'pm-upgrade-cost', `Cost ${q.cost} WXP · you have ${q.available}`));
      }
      const b = el('button', 'pm-button primary', q.nextLevel === null ? 'Max tier' : q.canUpgrade ? `Upgrade · ${q.cost} WXP` : `Need ${q.cost! - q.available} more WXP`);
      b.dataset.key = 'upgrade';
      b.disabled = !q.canUpgrade || this.upgrading;
      b.addEventListener('click', () => {
        if (this.upgrading) return;
        // Disable at once: a double tap can't reach the transaction twice (it also checks the tier).
        this.upgrading = true;
        b.disabled = true;
        const result = this.sim.upgradeWeapon(q.uid, q.level);
        this.upgrading = false;
        this.selectedUid = q.uid;
        this.render();
        this.say(upgradeMessage(result, q.name));
      });
      box.appendChild(b);
      this.progressEl.appendChild(box);
    }

    // Development-only section; the call and the module compile out of commercial builds.
    if (DEV_TOOLS_ENABLED) {
      renderDevSection(
        this.progressEl,
        this.sim,
        this.save,
        (message) => {
          this.render();
          this.say(message);
        },
        () => this.close(),
      );
    }
  }

  private say(text: string): void {
    this.message.textContent = text;
  }

  private focusKey(key: string): void {
    const target = this.panel.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
    target?.focus({ preventScroll: false });
  }

  private gridColumns(): number {
    const cols = getComputedStyle(this.gridEl).gridTemplateColumns.split(' ').filter(Boolean).length;
    return Math.max(1, cols || 4);
  }

  // ---- Actions -----------------------------------------------------------------------------

  private onCellTap(uid: number): void {
    if (performance.now() < this.suppressClickUntil) return;
    this.selectedUid = uid;
    this.say('');
    this.render();
    const targets = validTargets(this.sim.profile, uid).filter((s) => this.sim.profile.loadout.get(s) !== uid);
    if (targets.length) this.say(this.layout === 'tabs' ? 'Open Gear and tap a glowing slot to equip.' : 'Tap a glowing slot to equip, or drag it there.');
  }

  private onSlotTap(slot: SlotId): void {
    if (performance.now() < this.suppressClickUntil) return;
    const profile = this.sim.profile;
    const occupant = profile.loadout.get(slot);
    const selectedFits = this.selectedUid && occupant !== this.selectedUid && validTargets(profile, this.selectedUid).includes(slot);
    if (selectedFits) {
      this.equip(this.selectedUid, slot);
      return;
    }
    if (occupant) {
      this.selectedUid = occupant;
      this.say('');
      this.render();
      return;
    }
    const def = getSlot(slot);
    this.say(def.functional ? `Select an item that fits the ${def.label.toLowerCase()} slot.` : `${def.label} slot: this kind of equipment arrives in a later update.`);
  }

  private unequip(slot: SlotId): void {
    const uid = this.sim.profile.loadout.get(slot);
    const name = itemDetails(this.sim.profile, uid)?.cell.name ?? 'item';
    const result = this.sim.requestUnequip(slot);
    this.selectedUid = uid;
    this.render();
    this.say(unequipMessage(result, name));
  }

  private equip(uid: number, slot: SlotId): void {
    const name = itemDetails(this.sim.profile, uid)?.cell.name ?? 'Item';
    const result = this.sim.requestEquip(uid, slot);
    this.selectedUid = uid;
    this.render();
    this.say(equipMessage(result, name, slot));
  }

  /** Drop `uid` (dragged from `from`) on a target key: `slot:<id>` or `bag:<index>`. */
  private drop(uid: number, from: DragSource, target: string): void {
    const [kind, value] = target.split(':') as [string, string];
    const profile = this.sim.profile;
    if (kind === 'slot' && isSlotId(value)) {
      if (from === value) return;
      this.equip(uid, value);
      return;
    }
    if (kind === 'bag') {
      let message = '';
      if (from !== 'bag') {
        // Taking something off goes through the simulation (it may change what the player can do).
        const result = this.sim.requestUnequip(from);
        message = unequipMessage(result, itemDetails(profile, uid)?.cell.name ?? 'item');
        if (result !== 'unequipped') {
          this.say(message);
          return;
        }
      }
      profile.inventory.move(uid, Number(value));
      profile.touch();
      this.selectedUid = uid;
      this.render();
      this.say(message);
    }
  }

  // ---- Pointer drag and drop ---------------------------------------------------------------

  private onPointerDown(e: PointerEvent, uid: number, from: DragSource, source: HTMLElement): void {
    if (this.drag || !e.isPrimary || e.button > 0) return;
    const drag: DragState = { pointerId: e.pointerId, pointerType: e.pointerType, uid, from, el: source, startX: e.clientX, startY: e.clientY, active: false, timer: 0, ghost: null, hover: null };
    this.drag = drag;
    // Touch and pen: press and hold to pick up (a quick vertical swipe scrolls the backpack instead).
    if (e.pointerType !== 'mouse') drag.timer = window.setTimeout(() => this.beginDrag(e.clientX, e.clientY), MENU_LAYOUT.holdToDragMs);
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.active) {
      const dist = Math.hypot(dx, dy);
      if (d.pointerType === 'mouse') {
        if (dist > MENU_LAYOUT.mouseDragThreshold) this.beginDrag(e.clientX, e.clientY);
      } else if (Math.abs(dx) > MENU_LAYOUT.touchDragThreshold && Math.abs(dx) > Math.abs(dy) * 1.2) {
        // A sideways swipe can't be a scroll (the backpack scrolls vertically): pick up at once.
        this.beginDrag(e.clientX, e.clientY);
      } else if (dist > MENU_LAYOUT.touchDragThreshold) {
        // It's a scroll: forget the press.
        window.clearTimeout(d.timer);
        this.drag = null;
      }
      if (!this.drag?.active) return;
    }
    e.preventDefault();
    this.moveGhost(e.clientX, e.clientY);
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    window.clearTimeout(d.timer);
    if (!d.active) {
      this.drag = null;
      return; // a tap: the click handler selects / equips
    }
    const target = d.hover?.dataset.drop && d.hover.classList.contains('drop-ok') ? d.hover.dataset.drop : null;
    this.endDrag();
    this.suppressClickUntil = performance.now() + 350;
    if (target) this.drop(d.uid, d.from, target);
    else if (d.from !== 'bag' && getSlot(d.from).required && d.hover?.dataset.drop?.startsWith('bag:')) this.say(equipMessage('required', '', d.from));
    else this.say('Drop cancelled.');
  };

  private readonly onPointerCancel = (e: PointerEvent): void => {
    if (this.drag && e.pointerId === this.drag.pointerId) this.cancelDrag();
  };

  private beginDrag(x: number, y: number): void {
    const d = this.drag;
    if (!d || d.active || !this.isOpen) return;
    d.active = true;
    window.clearTimeout(d.timer);
    try {
      d.el.setPointerCapture(d.pointerId);
    } catch {
      // The pointer may already be gone; the window listeners still see it.
    }
    const cell = itemDetails(this.sim.profile, d.uid)?.cell;
    const ghost = el('div', `pm-ghost rarity-${cell?.rarity ?? 'common'}`, cell?.icon ?? '?');
    document.body.appendChild(ghost);
    d.ghost = ghost;
    this.panel.classList.add('pm-dragging');
    d.el.classList.add('drag-source');
    // Highlight where it can go.
    const slots = new Set(validTargets(this.sim.profile, d.uid));
    for (const t of this.panel.querySelectorAll<HTMLElement>('[data-drop]')) {
      const [kind, value] = t.dataset.drop!.split(':') as [string, string];
      const ok = kind === 'bag' ? d.from === 'bag' || !getSlot(d.from).required : isSlotId(value) && slots.has(value) && value !== d.from;
      t.classList.toggle('drop-ok', ok);
    }
    navigator.vibrate?.(8);
    this.say(`Moving ${cell?.name ?? 'item'}…`);
    this.moveGhost(x, y);
  }

  private moveGhost(x: number, y: number): void {
    const d = this.drag;
    if (!d?.ghost) return;
    // Offset up and left so a finger doesn't hide the preview.
    const off = d.pointerType === 'mouse' ? 0 : MENU_LAYOUT.touchGhostOffset;
    d.ghost.style.transform = `translate(${x - off}px, ${y - off}px) translate(-50%, -50%)`;
    const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]') ?? null;
    if (hit === d.hover) return;
    d.hover?.classList.remove('drop-hover');
    d.hover = hit && this.panel.contains(hit) ? hit : null;
    d.hover?.classList.add('drop-hover');
  }

  private endDrag(): void {
    const d = this.drag;
    if (!d) return;
    window.clearTimeout(d.timer);
    d.ghost?.remove();
    d.el.classList.remove('drag-source');
    try {
      if (d.el.hasPointerCapture(d.pointerId)) d.el.releasePointerCapture(d.pointerId);
    } catch {
      // ignore
    }
    this.panel.classList.remove('pm-dragging');
    for (const t of this.panel.querySelectorAll('.drop-ok, .drop-hover')) t.classList.remove('drop-ok', 'drop-hover');
    this.drag = null;
  }

  /** Abandon a drag without changing anything (Escape, rotation, focus loss, pointercancel). */
  private readonly cancelDrag = (): void => {
    if (!this.drag) return;
    const wasActive = this.drag.active;
    this.endDrag();
    if (wasActive && this.isOpen) this.say('Drop cancelled.');
  };

  // ---- Keyboard ----------------------------------------------------------------------------

  /** Runs before the game's keyboard source (capture), so no key reaches gameplay while open. */
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.isOpen) return;
    e.stopImmediatePropagation();
    if (this.journal.isOpen) {
      this.journal.handleKey(e);
      return;
    }
    if (e.code === 'Escape') {
      e.preventDefault();
      if (this.drag) this.cancelDrag();
      else this.close();
      return;
    }
    if (e.code === 'KeyI') {
      e.preventDefault();
      this.close();
      return;
    }
    if (e.code === 'Tab') return; // normal focus navigation
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: 0, ArrowDown: 0 }[e.code];
    if (step === undefined) return;
    const active = document.activeElement as HTMLElement | null;
    const container = active?.closest('.pm-grid, .pm-slots');
    if (!active || !container) {
      e.preventDefault();
      this.focusKey(`bag:${this.selectedUid}`);
      return;
    }
    const items = [...container.querySelectorAll<HTMLElement>('button')];
    const cols = container === this.gridEl ? this.gridColumns() : 3;
    const delta = e.code === 'ArrowUp' ? -cols : e.code === 'ArrowDown' ? cols : step;
    const next = items[items.indexOf(active) + delta];
    e.preventDefault();
    next?.focus();
  };
}
