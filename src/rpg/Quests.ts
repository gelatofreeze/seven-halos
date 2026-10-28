import type { QuestStatus } from '../data/dialogue';
import { QUESTS, getQuest, type ObjectiveDef } from '../data/quests';
import type { PlayerProfile } from './Profile';

/** Something that happened in the world that objectives may care about. */
export type QuestEvent =
  | { type: 'enterRegion'; region: string }
  | { type: 'activateCheckpoint'; checkpoint: string }
  | { type: 'talk'; npc: string }
  | { type: 'collect'; thing: 'halo' };

export interface QuestState {
  status: 'active' | 'completed';
  /** Index of the current objective (= objectives.length once completed). */
  objective: number;
  /** Progress toward the current objective's count (collect objectives). */
  progress: number;
}

/** What changed, for toasts and tests. */
export type QuestChange =
  | { type: 'started'; quest: string }
  | { type: 'advanced'; quest: string; objective: string }
  | { type: 'completed'; quest: string };

/**
 * The player's quests (saved). Pure state; the rules live in the functions
 * below so the log stays a plain, validatable record.
 */
export class QuestLog {
  private readonly states = new Map<string, QuestState>();

  status(id: string): QuestStatus {
    return this.states.get(id)?.status ?? 'not-started';
  }

  get(id: string): QuestState | undefined {
    return this.states.get(id);
  }

  /** The id of the current objective, or null if the quest isn't active. */
  currentObjective(id: string): string | null {
    const s = this.states.get(id);
    if (!s || s.status !== 'active') return null;
    return QUESTS[id]?.objectives[s.objective]?.id ?? null;
  }

  entries(): [string, QuestState][] {
    return [...this.states.entries()];
  }

  /** Low-level write for loading saves (validated by the caller). */
  set(id: string, state: QuestState): void {
    this.states.set(id, { ...state });
  }

  clear(): void {
    this.states.clear();
  }
}

/** Is this objective already met by what the player has (checked on reaching it, so old progress counts)? */
function alreadyMet(o: ObjectiveDef, profile: PlayerProfile, progress: number): boolean {
  switch (o.type) {
    case 'enterRegion':
      return profile.world.visited.has(o.region);
    case 'activateCheckpoint':
      return profile.world.isActive(o.checkpoint);
    case 'collect':
      return progress >= o.count;
    case 'talk':
      return false;
  }
}

function matches(o: ObjectiveDef, e: QuestEvent): boolean {
  switch (o.type) {
    case 'enterRegion':
      return e.type === 'enterRegion' && e.region === o.region;
    case 'activateCheckpoint':
      return e.type === 'activateCheckpoint' && e.checkpoint === o.checkpoint;
    case 'talk':
      return e.type === 'talk' && e.npc === o.npc;
    case 'collect':
      return e.type === 'collect' && e.thing === o.thing;
  }
}

/** Move past every objective that is already met; complete the quest (once) at the end. */
function settle(profile: PlayerProfile, id: string, out: QuestChange[], moved = false): void {
  const quest = getQuest(id);
  const s = profile.quests.get(id)!;
  while (s.status === 'active' && s.objective < quest.objectives.length && alreadyMet(quest.objectives[s.objective]!, profile, s.progress)) {
    s.objective++;
    s.progress = 0;
    moved = true;
  }
  if (s.status === 'active' && s.objective >= quest.objectives.length) {
    // The one place a quest completes: status flips once, rewards are granted once.
    s.status = 'completed';
    if (quest.rewards) profile.wallet.add({ experience: quest.rewards.experience ?? 0, gold: quest.rewards.gold ?? 0, weaponXp: quest.rewards.weaponXp ?? 0 });
    out.push({ type: 'completed', quest: id });
    if (quest.next) startQuest(profile, quest.next, out);
  } else if (moved) {
    out.push({ type: 'advanced', quest: id, objective: quest.objectives[s.objective]!.id });
  }
}

/** Start a quest (no-op if it was already started or completed). Already-met objectives are skipped. */
export function startQuest(profile: PlayerProfile, id: string, out: QuestChange[] = []): QuestChange[] {
  getQuest(id);
  if (profile.quests.status(id) !== 'not-started') return out;
  profile.quests.set(id, { status: 'active', objective: 0, progress: 0 });
  out.push({ type: 'started', quest: id });
  settle(profile, id, out);
  profile.touch();
  return out;
}

/** Feed an event to every active quest's current objective (objectives are strictly ordered). */
export function questEvent(profile: PlayerProfile, event: QuestEvent): QuestChange[] {
  const out: QuestChange[] = [];
  for (const [id, s] of profile.quests.entries()) {
    if (s.status !== 'active') continue;
    const o = getQuest(id).objectives[s.objective];
    if (!o || !matches(o, event)) {
      // Not this objective's event, but state may have caught up with it (still strictly in order).
      settle(profile, id, out);
      continue;
    }
    if (o.type === 'collect') {
      s.progress++;
      if (s.progress < o.count) {
        out.push({ type: 'advanced', quest: id, objective: o.id });
        continue;
      }
    }
    s.objective++;
    s.progress = 0;
    // The event satisfied this objective; later ones may already be met.
    settle(profile, id, out, true);
  }
  if (out.length) profile.touch();
  return out;
}

/** Progress shown for an objective, e.g. "0/7" (null when it has no count). */
export function objectiveProgress(profile: PlayerProfile, questId: string, objective: ObjectiveDef): string | null {
  if (objective.type !== 'collect') return null;
  const s = profile.quests.get(questId);
  const done = s && getQuest(questId).objectives[s.objective]?.id === objective.id ? s.progress : s?.status === 'completed' ? objective.count : 0;
  return `${done}/${objective.count}`;
}
