/**
 * Dialogue is data: nodes of speaker + text, linked by `next` or by a few
 * choices. A conversation starts at the first entry whose conditions hold,
 * so what an NPC says follows quest and world state without any code in the
 * NPC. Outcomes are a small validated set, never free-form script.
 */
export type QuestStatus = 'not-started' | 'active' | 'completed';

export type Condition =
  /** A quest's status, and optionally its current objective. */
  | { quest: string; status: QuestStatus; objective?: string }
  | { checkpoint: string; lit: boolean };

export type Outcome = { startQuest: string };

export interface DialogueChoice {
  text: string;
  /** Node to go to; omitted = the conversation ends after this choice. */
  next?: string;
  outcome?: Outcome;
}

export interface DialogueNode {
  /** 'npc' = the NPC you are talking to; 'you' = the player. */
  speaker: 'npc' | 'you';
  text: string;
  next?: string;
  choices?: readonly DialogueChoice[];
  /** Applied when the node is shown. */
  outcome?: Outcome;
}

export interface DialogueDef {
  id: string;
  /** Checked in order; the first whose `when` all hold picks the start node. The last should have no `when`. */
  entries: readonly { when?: readonly Condition[]; start: string }[];
  nodes: Readonly<Record<string, DialogueNode>>;
}

/**
 * The Oracle. Intent: wise, unsure, worried for the world, sparing with
 * answers. It establishes only what the opening needs (the Seven are dead,
 * the world is failing, their Halos remain, she has seen the player) and
 * leaves the war, the Halos' nature and any restoration unexplained.
 */
const ORACLE: DialogueDef = {
  id: 'oracle',
  entries: [
    { when: [{ quest: 'first-omen', status: 'completed' }], start: 'after' },
    { when: [{ quest: 'first-omen', status: 'active', objective: 'report' }], start: 'report' },
    { when: [{ quest: 'first-omen', status: 'active' }], start: 'reminder' },
    { when: [{ checkpoint: 'forest.shrine', lit: true }], start: 'traveled' },
    { start: 'greet' },
  ],
  nodes: {
    greet: { speaker: 'npc', text: 'Footsteps. Not a pilgrim’s. The pilgrims stopped coming a long time ago.', next: 'closer' },
    closer: { speaker: 'npc', text: 'Come closer. My eyes have been dark for years, but I still see. Some things. Not always the ones I would choose.', next: 'seven' },
    seven: { speaker: 'npc', text: 'The Seven are dead. The ones who shaped this world and kept it, all of them, gone, and by one another’s hands.', next: 'decay' },
    decay: { speaker: 'npc', text: 'Without them the world is coming undone, slowly. The flowers still grow over the stones. For now.', next: 'halos' },
    halos: { speaker: 'npc', text: 'But their Halos were not destroyed. I see seven lights, scattered and waiting. And every time I see them burn again, someone is standing near them.', next: 'you' },
    you: {
      speaker: 'npc',
      text: 'Someone like you. I cannot tell you whether that is a promise or a warning.',
      choices: [
        { text: 'Why me?', next: 'why' },
        { text: 'What would you have me do?', next: 'ask' },
      ],
    },
    why: { speaker: 'npc', text: 'I do not know. Visions do not explain themselves. They only refuse to leave.', next: 'ask' },
    ask: {
      speaker: 'npc',
      text: 'Go beyond the sanctuary. Walk the old road east and see what is left of the world. There was a shrine in the forest once. Find it, if it still stands, and come back and tell me.',
      choices: [
        { text: 'I will go.', next: 'farewell', outcome: { startQuest: 'first-omen' } },
        { text: 'Not yet.', next: 'later' },
      ],
    },
    farewell: { speaker: 'npc', text: 'Then go carefully. The road remembers more than it should.' },
    later: { speaker: 'npc', text: 'The road will wait. So will I. Waiting is the one thing I have become good at.' },

    traveled: { speaker: 'npc', text: 'You smell of pine and cold stone. You have already walked the forest road, haven’t you?', next: 'closer2' },
    closer2: { speaker: 'npc', text: 'Then perhaps you are the one I have been seeing. Sit with me a moment.', next: 'seven2' },
    seven2: { speaker: 'npc', text: 'The Seven are dead, all of them, by one another’s hands. Without them the world is coming undone. But their Halos remain, scattered, and in my visions someone stands near them when they burn again.', next: 'ask2' },
    ask2: {
      speaker: 'npc',
      text: 'I would have asked you to find the old shrine in the forest. Tell me: does it still stand?',
      choices: [{ text: 'It stands. It burns.', next: 'omen', outcome: { startQuest: 'first-omen' } }],
    },

    reminder: { speaker: 'npc', text: 'The old road runs east, past the waymarker by the gate. Somewhere in the forest there was a shrine. Find it, and come back to me.' },

    report: {
      speaker: 'npc',
      text: 'You came back. Tell me what you found.',
      choices: [{ text: 'The shrine on the forest road still burns.', next: 'omen' }],
    },
    omen: { speaker: 'npc', text: 'Still burning, after all this time. Then the old roads are not yet lost. That is more than I dared to hope.', next: 'mission' },
    mission: { speaker: 'npc', text: 'Seven Halos. A road to each of them, perhaps. I cannot see where they end, only that they begin here, with you.' },

    after: { speaker: 'npc', text: 'Seven lights, scattered. You have found none of them yet, and still I see them nearer than before.' },
  },
};

export const DIALOGUES: Record<string, DialogueDef> = { oracle: ORACLE };

export function getDialogue(id: string): DialogueDef {
  const d = DIALOGUES[id];
  if (!d) throw new Error(`Unknown dialogue: ${id}`);
  return d;
}
