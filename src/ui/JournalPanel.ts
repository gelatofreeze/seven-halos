import type { PlayerProfile } from '../rpg/Profile';
import { journalLore, journalQuests } from './journalModel';

/**
 * The journal, opened from the pause menu: quests (current objective first;
 * finished objectives ticked; later ones hidden) and the lore read so far,
 * which can be reread. Plain text only.
 */
export class JournalPanel {
  readonly root: HTMLElement;
  isOpen = false;
  private readonly body: HTMLElement;
  private reading: string | null = null;

  constructor(
    parent: HTMLElement,
    private readonly profile: PlayerProfile,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'jr-backdrop';
    this.root.style.display = 'none';
    const panel = document.createElement('div');
    panel.className = 'jr';
    const head = document.createElement('div');
    head.className = 'jr-head';
    const title = document.createElement('div');
    title.className = 'jr-title';
    title.textContent = 'Journal';
    const close = document.createElement('button');
    close.className = 'jr-close';
    close.textContent = '✕';
    close.setAttribute('aria-label', 'Close journal');
    close.addEventListener('click', () => this.close());
    head.append(title, close);
    this.body = document.createElement('div');
    this.body.className = 'jr-body menu-scroll';
    panel.append(head, this.body);
    this.root.appendChild(panel);
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.close();
    });
    parent.appendChild(this.root);
  }

  open(): void {
    this.isOpen = true;
    this.reading = null;
    this.render();
    this.root.style.display = 'flex';
    this.root.querySelector<HTMLButtonElement>('.jr-close')?.focus();
  }

  close(): void {
    this.isOpen = false;
    this.root.style.display = 'none';
  }

  /** Keys while open (the pause menu forwards them). */
  handleKey(e: KeyboardEvent): void {
    if (e.code === 'Escape' || e.code === 'KeyI') {
      e.preventDefault();
      if (this.reading) {
        this.reading = null;
        this.render();
      } else this.close();
    }
  }

  destroy(): void {
    this.root.remove();
  }

  private add(parent: HTMLElement, tag: keyof HTMLElementTagNameMap, cls: string, text: string): HTMLElement {
    const e = document.createElement(tag);
    e.className = cls;
    e.textContent = text;
    parent.appendChild(e);
    return e;
  }

  private render(): void {
    const b = this.body;
    b.innerHTML = '';
    const quests = journalQuests(this.profile);
    this.add(b, 'div', 'jr-section', 'Quests');
    if (quests.length === 0) this.add(b, 'p', 'jr-note', 'No quests yet. Someone in the sanctuary may have words for you.');
    for (const q of quests) {
      const card = document.createElement('div');
      card.className = `jr-quest ${q.status}`;
      this.add(card, 'div', 'jr-quest-title', `${q.title}${q.status === 'completed' ? ' · complete' : ''}`);
      this.add(card, 'div', 'jr-quest-kind', q.kind === 'main' ? 'Main quest' : 'Side quest');
      this.add(card, 'p', 'jr-quest-desc', q.description);
      const list = document.createElement('ul');
      list.className = 'jr-objectives';
      for (const o of q.objectives) this.add(list, 'li', o.done ? 'done' : 'current', `${o.done ? '✓' : '◆'} ${o.text}${o.progress ? ` (${o.progress})` : ''}`);
      card.appendChild(list);
      b.appendChild(card);
    }
    this.add(b, 'div', 'jr-section', 'Discoveries');
    const lore = journalLore(this.profile);
    if (lore.length === 0) this.add(b, 'p', 'jr-note', 'Nothing read yet. Old stones sometimes have something to say.');
    for (const l of lore) {
      const btn = document.createElement('button');
      btn.className = 'jr-lore';
      btn.textContent = `${this.reading === l.id ? '▾' : '▸'} ${l.title}`;
      btn.addEventListener('click', () => {
        this.reading = this.reading === l.id ? null : l.id;
        this.render();
      });
      b.appendChild(btn);
      if (this.reading === l.id) for (const para of l.text) this.add(b, 'p', 'jr-lore-text', para);
    }
  }
}
