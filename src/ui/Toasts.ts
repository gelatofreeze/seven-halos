export type ToastKind = 'reward' | 'loot' | 'rare' | 'info';

/** Short, stacked notifications at the top of the screen (rewards, pickups, messages). */
export class Toasts {
  private readonly root: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'toasts';
    parent.appendChild(this.root);
  }

  show(text: string, kind: ToastKind = 'info', seconds = 2.6): void {
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.textContent = text;
    this.root.appendChild(el);
    while (this.root.children.length > 4) this.root.firstElementChild?.remove();
    window.setTimeout(() => el.classList.add('fade'), seconds * 1000);
    window.setTimeout(() => el.remove(), seconds * 1000 + 600);
  }

  destroy(): void {
    this.root.remove();
  }
}
