import { DIALOGUES, type Condition, type DialogueDef, type Outcome } from '../data/dialogue';
import { LORE, type LoreEntry } from '../data/lore';
import { NPCS, type NpcDef } from '../data/npcs';
import { QUESTS, type QuestDef } from '../data/quests';
import { rectsOverlap } from '../core/Rect';
import { allCheckpoints, getRegion, hasRegion } from './regions';

export interface Narrative {
  npcs: Record<string, NpcDef>;
  dialogues: Record<string, DialogueDef>;
  quests: Record<string, QuestDef>;
  lore: Record<string, LoreEntry>;
}

export const GAME_NARRATIVE: Narrative = { npcs: NPCS, dialogues: DIALOGUES, quests: QUESTS, lore: LORE };

/**
 * Cross-checks NPCs, dialogue, quests and lore against each other and the
 * world; returns one message per problem. Run by tests/narrative.test.ts.
 */
export function validateNarrative(n: Narrative = GAME_NARRATIVE): string[] {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);
  const checkpoints = new Set(allCheckpoints().map((c) => c.id));
  const keyMatchesId = (kind: string, table: Record<string, { id: string }>) => {
    for (const [k, v] of Object.entries(table)) if (v.id !== k) err(`${kind} "${k}" has id "${v.id}"`);
  };
  keyMatchesId('npc', n.npcs);
  keyMatchesId('dialogue', n.dialogues);
  keyMatchesId('quest', n.quests);
  keyMatchesId('lore', n.lore);

  for (const npc of Object.values(n.npcs)) {
    if (!hasRegion(npc.region)) {
      err(`npc "${npc.id}": unknown region "${npc.region}"`);
      continue;
    }
    const level = getRegion(npc.region);
    const a = level.anchors[npc.anchor];
    if (!a) err(`npc "${npc.id}": no anchor "${npc.anchor}" in "${npc.region}"`);
    if (!n.dialogues[npc.dialogue]) err(`npc "${npc.id}": unknown dialogue "${npc.dialogue}"`);
    if (a) {
      const reach = npc.reach ?? { w: 36, h: 44 };
      const zone = { x: a.x - reach.w / 2, y: a.y - reach.h, w: reach.w, h: reach.h };
      // An NPC must never stand in the way of a shrine (or share its interaction zone).
      for (const o of level.objects) if (o.kind === 'checkpoint' && rectsOverlap(zone, o.zone)) err(`npc "${npc.id}" crowds shrine "${o.id}"`);
    }
  }

  const condition = (where: string, c: Condition) => {
    if ('quest' in c) {
      const q = n.quests[c.quest];
      if (!q) err(`${where}: unknown quest "${c.quest}"`);
      else if (c.objective && !q.objectives.some((o) => o.id === c.objective)) err(`${where}: quest "${c.quest}" has no objective "${c.objective}"`);
    } else if (!checkpoints.has(c.checkpoint)) err(`${where}: unknown checkpoint "${c.checkpoint}"`);
  };
  const outcome = (where: string, o: Outcome | undefined) => {
    if (o && !n.quests[o.startQuest]) err(`${where}: outcome starts unknown quest "${o.startQuest}"`);
  };
  for (const d of Object.values(n.dialogues)) {
    const where = `dialogue "${d.id}"`;
    if (d.entries.length === 0 || d.entries[d.entries.length - 1]!.when) err(`${where}: the last entry must have no conditions (a default)`);
    const reachable = new Set<string>();
    const visit = (id: string | undefined, from: string) => {
      if (!id) return;
      if (!d.nodes[id]) {
        err(`${where}: "${from}" leads to missing node "${id}"`);
        return;
      }
      if (reachable.has(id)) return;
      reachable.add(id);
      const node = d.nodes[id]!;
      outcome(`${where} node "${id}"`, node.outcome);
      visit(node.next, id);
      for (const c of node.choices ?? []) {
        outcome(`${where} node "${id}"`, c.outcome);
        visit(c.next, id);
      }
    };
    for (const e of d.entries) {
      for (const c of e.when ?? []) condition(where, c);
      visit(e.start, 'entry');
    }
    for (const id of Object.keys(d.nodes)) if (!reachable.has(id)) err(`${where}: node "${id}" can never be reached`);
  }

  for (const q of Object.values(n.quests)) {
    const where = `quest "${q.id}"`;
    if (q.objectives.length === 0) err(`${where}: has no objectives`);
    const ids = new Set<string>();
    for (const o of q.objectives) {
      if (ids.has(o.id)) err(`${where}: duplicate objective "${o.id}"`);
      ids.add(o.id);
      if (o.type === 'enterRegion' && !hasRegion(o.region)) err(`${where}: objective "${o.id}" names unknown region "${o.region}"`);
      if (o.type === 'activateCheckpoint' && !checkpoints.has(o.checkpoint)) err(`${where}: objective "${o.id}" names unknown checkpoint "${o.checkpoint}"`);
      if (o.type === 'talk' && !n.npcs[o.npc]) err(`${where}: objective "${o.id}" names unknown npc "${o.npc}"`);
      if (o.type === 'collect' && !(Number.isInteger(o.count) && o.count > 0)) err(`${where}: objective "${o.id}" needs a positive count`);
    }
    if (q.next && !n.quests[q.next]) err(`${where}: next quest "${q.next}" does not exist`);
  }

  for (const l of Object.values(n.lore)) {
    if (!hasRegion(l.region)) {
      err(`lore "${l.id}": unknown region "${l.region}"`);
      continue;
    }
    const placed = getRegion(l.region).objects.filter((o) => o.kind === 'lore' && o.id === l.id).length;
    if (placed !== 1) err(`lore "${l.id}": placed ${placed} times in "${l.region}" (expected once)`);
    if (l.text.length === 0) err(`lore "${l.id}": has no text`);
  }
  return errors;
}
