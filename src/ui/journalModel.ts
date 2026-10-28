import { getLore, LORE } from '../data/lore';
import { getQuest, QUESTS } from '../data/quests';
import type { PlayerProfile } from '../rpg/Profile';
import { objectiveProgress, type QuestChange } from '../rpg/Quests';

export interface JournalObjective {
  text: string;
  done: boolean;
  /** e.g. "0/7" for counted objectives. */
  progress: string | null;
}

export interface JournalQuest {
  id: string;
  title: string;
  kind: 'main' | 'side';
  status: 'active' | 'completed';
  description: string;
  /** Finished objectives and the current one; later ones stay hidden (no spoilers). */
  objectives: JournalObjective[];
}

/** Started quests, active first (main before side), then completed. DOM-free, tested. */
export function journalQuests(profile: PlayerProfile): JournalQuest[] {
  const out: JournalQuest[] = [];
  for (const [id, s] of profile.quests.entries()) {
    const q = QUESTS[id];
    if (!q) continue;
    const shown = s.status === 'completed' ? q.objectives.length : s.objective + 1;
    out.push({
      id,
      title: q.title,
      kind: q.kind,
      status: s.status,
      description: s.status === 'completed' && q.completedText ? q.completedText : q.description,
      objectives: q.objectives.slice(0, shown).map((o, i) => ({ text: o.text, done: s.status === 'completed' || i < s.objective, progress: objectiveProgress(profile, id, o) })),
    });
  }
  const rank = (j: JournalQuest) => (j.status === 'active' ? 0 : 2) + (j.kind === 'main' ? 0 : 1);
  return out.sort((a, b) => rank(a) - rank(b));
}

/** The objective to show first: the current one of the first active main quest. */
export function currentObjective(profile: PlayerProfile): string | null {
  const q = journalQuests(profile).find((j) => j.status === 'active');
  const o = q?.objectives.find((x) => !x.done);
  return o ? `${o.text}${o.progress ? ` (${o.progress})` : ''}` : null;
}

export function journalLore(profile: PlayerProfile): { id: string; title: string; text: readonly string[] }[] {
  return Object.values(LORE).filter((l) => profile.lore.has(l.id));
}

/** Toast text for a quest change. */
export function questToast(change: QuestChange): string {
  const q = getQuest(change.quest);
  if (change.type === 'started') return `New quest: ${q.title}`;
  if (change.type === 'completed') return `Quest complete: ${q.title}`;
  const o = q.objectives.find((x) => x.id === change.objective);
  return o ? `${q.title}: ${o.text}` : q.title;
}

export { getLore };
