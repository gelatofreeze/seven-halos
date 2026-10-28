import type { LoreEntry } from '../data/lore';

/**
 * Reading panel for inscriptions and books: a title and a few short
 * paragraphs (plain text). Tap ✕ / outside, or press Esc / Enter / E, to
 * close. The game is paused while it's open.
 */
export class LorePanel {
  readonly root: HTMLElement;
  isOpen = false;
  private readonly body: HTMLElement;
  private openedAt = 0;

  constructor(
    parent: HTMLElement,
    private readonly onChange: (open: boolean) => void,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'lore-backdrop';
    this.root.style.display = 'none';
    this.body = document.createElement('div');
    this.body.className = 'lore';
    this.body.setAttribute('role', 'dialog');
    this.root.appendChild(this.body);
    this.root.addEventListener('click', () => {
      if (performance.now() - this.openedAt > 300) this.close();
    });
    parent.appendChild(this.root);
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
  }

  open(entry: LoreEntry): void {
    this.body.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'lore-title';
    title.textContent = entry.title;
    this.body.appendChild(title);
    for (const para of entry.text) {
      const p = document.createElement('p');
      p.textContent = para;
      this.body.appendChild(p);
    }
    const hint = document.createElement('div');
    hint.className = 'lore-hint';
    hint.textContent = 'Tap to close · kept in your journal';
    this.body.appendChild(hint);
    this.isOpen = true;
    this.openedAt = performance.now();
    this.root.style.display = 'flex';
    this.onChange(true);
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.style.display = 'none';
    this.onChange(false);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown, { capture: true });
    this.root.remove();
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.isOpen) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    if (!e.repeat && ['Escape', 'Enter', 'Space', 'KeyE', 'KeyI'].includes(e.code)) this.close();
  };
}
