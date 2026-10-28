const MAX_CHAINED_TRANSITIONS = 4;

/**
 * Minimal explicit state machine. Each state may return the id of the next
 * state from `update`; transitions run `exit` then `enter`. `ticks` counts
 * fixed updates completed in the current state, so the first update of a
 * state sees `ticks === 0` (frame 0 of frame data).
 */
export interface State<C, K extends string> {
  enter?(ctx: C, previous: K | null): void;
  update(ctx: C, dt: number): K | void;
  exit?(ctx: C, next: K): void;
}

export class StateMachine<C, K extends string> {
  private currentId: K;
  private previousId: K | null = null;
  private transitions = 0;
  ticks = 0;
  time = 0;

  constructor(
    private readonly ctx: C,
    private readonly states: Record<K, State<C, K>>,
    initial: K,
  ) {
    this.currentId = initial;
    this.states[initial].enter?.(ctx, null);
  }

  get current(): K {
    return this.currentId;
  }

  get previous(): K | null {
    return this.previousId;
  }

  is(id: K): boolean {
    return this.currentId === id;
  }

  /** Change state. Re-entering the same state only happens when `force` is set. */
  transition(next: K, force = false): void {
    if (next === this.currentId && !force) return;
    this.states[this.currentId].exit?.(this.ctx, next);
    this.previousId = this.currentId;
    this.currentId = next;
    this.transitions++;
    this.ticks = 0;
    this.time = 0;
    this.states[next].enter?.(this.ctx, this.previousId);
  }

  /**
   * Run one fixed update. When a state transitions, the new state's update
   * runs in the same tick (frame 0), so actions start with zero added latency.
   * States that return a transition must not have applied per-tick movement.
   */
  update(dt: number): void {
    for (let chain = 0; chain < MAX_CHAINED_TRANSITIONS; chain++) {
      const transitionsBefore = this.transitions;
      const next = this.states[this.currentId].update(this.ctx, dt);
      if (next !== undefined && next !== this.currentId) {
        this.transition(next);
        continue;
      }
      // Forced re-entry from inside update (e.g. combo chain): run the fresh state too.
      if (this.transitions !== transitionsBefore) continue;
      break;
    }
    this.ticks++;
    this.time += dt;
  }
}
