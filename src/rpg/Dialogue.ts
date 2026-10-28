import { getDialogue, type Condition, type DialogueChoice, type DialogueDef, type DialogueNode, type Outcome } from '../data/dialogue';
import type { PlayerProfile } from './Profile';

/** Does a dialogue condition hold for this profile? */
export function conditionHolds(c: Condition, profile: PlayerProfile): boolean {
  if ('quest' in c) {
    if (profile.quests.status(c.quest) !== c.status) return false;
    return c.objective === undefined || profile.quests.currentObjective(c.quest) === c.objective;
  }
  return profile.world.isActive(c.checkpoint) === c.lit;
}

/** The node a conversation opens on, given the current state. */
export function startNode(def: DialogueDef, profile: PlayerProfile): string {
  for (const e of def.entries) if (!e.when || e.when.every((c) => conditionHolds(c, profile))) return e.start;
  return def.entries[def.entries.length - 1]!.start;
}

/**
 * One conversation, step by step. Presentation-free: the dialogue panel only
 * shows `node` and calls `advance` / `choose`. Outcomes go to `apply` as they
 * happen; `finished` is true once an end was reached (not when dismissed).
 */
export class Conversation {
  readonly def: DialogueDef;
  nodeId: string | null;
  finished = false;

  constructor(
    dialogueId: string,
    profile: PlayerProfile,
    private readonly apply: (o: Outcome) => void,
  ) {
    this.def = getDialogue(dialogueId);
    this.nodeId = startNode(this.def, profile);
    this.enter();
  }

  get node(): DialogueNode | null {
    return this.nodeId ? (this.def.nodes[this.nodeId] ?? null) : null;
  }

  get choices(): readonly DialogueChoice[] {
    return this.node?.choices ?? [];
  }

  /** Continue past a node with no choices. */
  advance(): void {
    const n = this.node;
    if (!n || n.choices?.length) return;
    this.go(n.next ?? null);
  }

  choose(index: number): void {
    const c = this.node?.choices?.[index];
    if (!c) return;
    if (c.outcome) this.apply(c.outcome);
    this.go(c.next ?? null);
  }

  private go(next: string | null): void {
    this.nodeId = next;
    if (next === null) this.finished = true;
    else this.enter();
  }

  private enter(): void {
    const o = this.node?.outcome;
    if (o) this.apply(o);
  }
}
