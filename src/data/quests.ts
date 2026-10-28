import type { Rewards } from './enemies';

/**
 * Quests are data. Objectives are completed strictly in order; each is one
 * of a few typed kinds that the quest engine (rpg/Quests.ts) knows how to
 * satisfy, either from an event as it happens or, on reaching the objective,
 * from state the player already has (a shrine lit before the quest began).
 * New objective kinds (deliveries, kill counts, materials) are a new union
 * member plus a case in the engine.
 */
export type ObjectiveDef =
  | { id: string; text: string; type: 'enterRegion'; region: string }
  | { id: string; text: string; type: 'activateCheckpoint'; checkpoint: string }
  | { id: string; text: string; type: 'talk'; npc: string }
  /** A count of something gathered; `thing` names what (only Halos exist so far, and none can be found yet). */
  | { id: string; text: string; type: 'collect'; thing: 'halo'; count: number };

export interface QuestDef {
  id: string;
  kind: 'main' | 'side';
  title: string;
  description: string;
  objectives: readonly ObjectiveDef[];
  /** Granted once, when the quest completes. */
  rewards?: Partial<Rewards>;
  /** Shown in the journal once completed. */
  completedText?: string;
  /** Quest started automatically when this one completes. */
  next?: string;
}

export const QUESTS: Record<string, QuestDef> = {
  'first-omen': {
    id: 'first-omen',
    kind: 'main',
    title: 'The First Omen',
    description: 'The Oracle in the sanctuary has seen something in you. She asked you to walk the old road east and see what remains of the world.',
    objectives: [
      { id: 'leave', text: 'Venture beyond the sanctuary', type: 'enterRegion', region: 'forest-road' },
      { id: 'shrine', text: 'Find the shrine on the forest road', type: 'activateCheckpoint', checkpoint: 'forest.shrine' },
      { id: 'report', text: 'Return to the Oracle', type: 'talk', npc: 'oracle' },
    ],
    rewards: { experience: 100 },
    completedText: 'The forest shrine still burns. The Oracle took it as a sign that the road ahead is not yet closed.',
    next: 'seven-halos',
  },
  'seven-halos': {
    id: 'seven-halos',
    kind: 'main',
    title: 'The Seven Halos',
    description: 'The Seven are dead, but their Halos were not destroyed. The Oracle believes they can be found, and that what was lost might yet be restored. No one has found one yet.',
    objectives: [{ id: 'halos', text: 'Recover the Seven Halos', type: 'collect', thing: 'halo', count: 7 }],
  },
};

export function getQuest(id: string): QuestDef {
  const q = QUESTS[id];
  if (!q) throw new Error(`Unknown quest: ${id}`);
  return q;
}
