/**
 * Contextual interaction prompt ("Rest · Forest Road Shrine"). On touch
 * screens it is the button: tapping it presses the `interact` action once.
 * With a keyboard it shows the key. It sits mid-screen, clear of the
 * joystick zone and the action buttons, and only appears while there is
 * something to use, so it adds no permanent combat button.
 */
export class InteractionPrompt {
  private readonly root: HTMLButtonElement;
  private shown: string | null = null;

  constructor(
    parent: HTMLElement,
    private readonly onPress: () => void,
    touch: boolean,
  ) {
    this.root = document.createElement('button');
    this.root.className = `interact-prompt${touch ? ' touch' : ''}`;
    this.root.type = 'button';
    this.root.style.display = 'none';
    this.root.tabIndex = -1;
    // Act on click (after the finger lifts), so the tap can't fall through
    // onto whatever menu it opens; pointerdown is swallowed so nothing else sees it.
    this.root.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    this.root.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onPress();
    });
    parent.appendChild(this.root);
  }

  /** Called every frame; only touches the DOM when the label changes. */
  set(label: string | null): void {
    if (label === this.shown) return;
    this.shown = label;
    if (label === null) {
      this.root.style.display = 'none';
      return;
    }
    this.root.innerHTML = '';
    const key = document.createElement('span');
    key.className = 'interact-key';
    key.textContent = 'E';
    const text = document.createElement('span');
    text.textContent = label;
    this.root.append(key, text);
    this.root.style.display = 'flex';
  }

  destroy(): void {
    this.root.remove();
  }
}
