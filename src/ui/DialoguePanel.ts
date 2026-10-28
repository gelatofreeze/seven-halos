import type { Conversation } from '../rpg/Dialogue';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  // textContent only: dialogue is never parsed as HTML.
  if (text) e.textContent = text;
  return e;
};

/**
 * Conversation panel, docked low so the speakers stay visible above it. Tap
 * the panel (or press Enter / Space / E) to continue; choices are buttons
 * (arrows + Enter on a keyboard). Esc or ✕ dismisses without finishing.
 * The game is paused while it's open (the scene isolates input on both
 * open and close, so nothing typed here fires afterwards).
 */
export class DialoguePanel {
  readonly root: HTMLElement;
  isOpen = false;
  private readonly speaker: HTMLElement;
  private readonly text: HTMLElement;
  private readonly choices: HTMLElement;
  private readonly hint: HTMLElement;
  private conversation: Conversation | null = null;
  private npcId = '';
  private npcName = '';
  private openedAt = 0;

  constructor(
    parent: HTMLElement,
    private readonly onChange: (open: boolean) => void,
    /** The conversation reached its end (not dismissed). */
    private readonly onFinished: (npcId: string) => void,
  ) {
    this.root = el('div', 'dlg-backdrop');
    this.root.style.display = 'none';
    const panel = el('div', 'dlg');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-live', 'polite');
    const head = el('div', 'dlg-head');
    this.speaker = el('div', 'dlg-speaker');
    const close = el('button', 'dlg-close', '✕');
    close.setAttribute('aria-label', 'End conversation');
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });
    head.append(this.speaker, close);
    this.text = el('p', 'dlg-text');
    this.choices = el('div', 'dlg-choices');
    this.hint = el('div', 'dlg-hint', 'Tap to continue ▸');
    panel.append(head, this.text, this.choices, this.hint);
    // Tapping anywhere on the panel continues (when there are no choices to pick).
    panel.addEventListener('click', () => {
      if (performance.now() - this.openedAt > 300) this.advance();
    });
    this.root.appendChild(panel);
    parent.appendChild(this.root);
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
  }

  open(npcId: string, npcName: string, conversation: Conversation): void {
    this.conversation = conversation;
    this.npcId = npcId;
    this.npcName = npcName;
    this.isOpen = true;
    this.openedAt = performance.now();
    this.root.style.display = 'flex';
    this.onChange(true);
    this.render();
  }

  close(): void {
    if (!this.isOpen) return;
    const finished = this.conversation?.finished ?? false;
    this.isOpen = false;
    this.conversation = null;
    this.root.style.display = 'none';
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (finished) this.onFinished(this.npcId);
    this.onChange(false);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown, { capture: true });
    this.root.remove();
  }

  private advance(): void {
    const c = this.conversation;
    if (!c || c.choices.length) return;
    c.advance();
    this.afterStep();
  }

  private choose(i: number): void {
    const c = this.conversation;
    if (!c || performance.now() - this.openedAt < 300) return;
    c.choose(i);
    this.afterStep();
  }

  private afterStep(): void {
    if (this.conversation?.finished) this.close();
    else this.render();
  }

  private render(): void {
    const node = this.conversation?.node;
    if (!node) return;
    this.speaker.textContent = node.speaker === 'you' ? 'You' : this.npcName;
    this.speaker.classList.toggle('you', node.speaker === 'you');
    this.text.textContent = node.text;
    this.choices.innerHTML = '';
    const options = node.choices ?? [];
    options.forEach((choice, i) => {
      const b = el('button', 'dlg-choice', choice.text);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.choose(i);
      });
      this.choices.appendChild(b);
    });
    this.hint.style.display = options.length ? 'none' : 'block';
    this.choices.querySelector<HTMLButtonElement>('button')?.focus();
  }

  /** Capture phase: keys drive the conversation and never reach gameplay while it is open. */
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.isOpen) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Escape') {
      this.close();
      return;
    }
    const buttons = [...this.choices.querySelectorAll<HTMLButtonElement>('button')];
    if (buttons.length) {
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (e.code === 'ArrowDown' || e.code === 'ArrowUp') buttons[(i + (e.code === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') this.choose(Math.max(0, i));
      return;
    }
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') this.advance();
  };
}
