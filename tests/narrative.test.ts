import { describe, expect, it } from 'vitest';
import { PLAYER_COMBAT } from '../src/config/player';
import { DIALOGUES } from '../src/data/dialogue';
import { QUESTS } from '../src/data/quests';
import { applySave, migrationBackupKey, SAVE_KEY, SAVE_VERSION, SaveManager, serializeProfile } from '../src/persistence/SaveGame';
import { MemoryStorage } from '../src/persistence/Storage';
import { Conversation, startNode } from '../src/rpg/Dialogue';
import { PlayerProfile } from '../src/rpg/Profile';
import { questEvent, startQuest } from '../src/rpg/Quests';
import { currentObjective, journalLore, journalQuests, questToast } from '../src/ui/journalModel';
import { promptLabel } from '../src/ui/worldModel';
import { GameWorld } from '../src/world/GameWorld';
import type { WorldObject } from '../src/world/Level';
import { getRegion, REGIONS } from '../src/world/regions';
import type { SimEvent } from '../src/world/SimEvents';
import { GAME_NARRATIVE, validateNarrative, type Narrative } from '../src/world/validateNarrative';
import { validateWorld } from '../src/world/validateWorld';
import { DT, ScriptedInput } from './helpers';

function newWorld(profile = new PlayerProfile()) {
  const world = new GameWorld(profile);
  world.start();
  return { world, profile, input: new ScriptedInput(), events: [] as SimEvent[] };
}
type W = ReturnType<typeof newWorld>;

function step(w: W, n = 1): void {
  for (let i = 0; i < n; i++) {
    w.world.sim.step(DT, w.input);
    w.world.sim.events.drain((e) => w.events.push(e));
    if (w.world.sim.pendingTravel) {
      w.world.completeTravel();
      w.world.sim.events.drain((e) => w.events.push(e));
    }
  }
}

function object(w: W, id: string): WorldObject {
  const o = w.world.sim.objects.find((x) => x.id === id);
  if (!o) throw new Error(`no ${id} in ${w.world.sim.level.id}`);
  return o;
}

function standAt(w: W, id: string): void {
  const o = object(w, id);
  w.world.sim.player.body.teleport(o.x, o.y);
  step(w, 3);
}

function interact(w: W): void {
  w.input.frame.interactPressed = true;
  step(w, 2);
}

function travel(w: W, region: string, anchor: string): void {
  w.world.sim.requestTravelOut({ reason: 'exit', to: { region, anchor } });
  step(w, 1);
}

/** Walk up to the Oracle, press interact, and run the conversation picking choices by text. */
function talkToOracle(w: W, picks: string[] = []): { lines: string[]; conversation: Conversation } {
  if (w.world.sim.level.id !== 'sanctuary-outskirts') travel(w, 'sanctuary-outskirts', 'npc.oracle');
  standAt(w, 'oracle');
  w.events.length = 0;
  interact(w);
  const talk = w.events.find((e) => e.type === 'talk');
  expect(talk).toBeDefined();
  const c = w.world.sim.startConversation('oracle')!;
  const lines: string[] = [];
  for (let guard = 0; guard < 40 && !c.finished; guard++) {
    lines.push(c.node!.text);
    if (c.choices.length) {
      const want = picks.shift();
      const i = want ? c.choices.findIndex((x) => x.text === want) : 0;
      expect(i, `choice "${want}" in "${c.nodeId}"`).toBeGreaterThanOrEqual(0);
      c.choose(i);
    } else c.advance();
  }
  expect(c.finished).toBe(true);
  w.world.sim.finishConversation('oracle');
  w.world.sim.events.drain((e) => w.events.push(e));
  return { lines, conversation: c };
}

function reload(w: W): W {
  const raw = JSON.stringify(serializeProfile(w.profile));
  const profile = new PlayerProfile();
  expect(applySave(raw, profile)).toBe('loaded');
  return newWorld(profile);
}

function killPlayer(w: W): void {
  const p = w.world.sim.player;
  p.health.current = 0;
  p.fsm.transition('dead');
  step(w, Math.ceil(PLAYER_COMBAT.respawnDelay / DT) + 3);
}

const lightForestShrine = (w: W) => {
  travel(w, 'forest-road', 'from-sanctuary');
  standAt(w, 'forest.shrine');
  interact(w);
  expect(w.profile.world.isActive('forest.shrine')).toBe(true);
};

describe('Narrative content', () => {
  it('NPCs, dialogue, quests and lore are valid and consistent with the world', () => {
    expect(validateNarrative()).toEqual([]);
    expect(validateWorld()).toEqual([]);
  });

  it('the validator catches broken references', () => {
    const n = structuredClone(GAME_NARRATIVE) as Narrative;
    n.npcs.oracle!.anchor = 'nowhere';
    n.dialogues.oracle = { ...n.dialogues.oracle!, nodes: { ...n.dialogues.oracle!.nodes, greet: { speaker: 'npc', text: 'x', next: 'missing' } } };
    n.quests['first-omen'] = { ...n.quests['first-omen']!, next: 'no-such-quest', objectives: [{ id: 'a', text: 'a', type: 'talk', npc: 'ghost' }] };
    n.lore['lore.unplaced'] = { id: 'lore.unplaced', title: 't', region: 'forest-road', text: ['t'] };
    const errors = validateNarrative(n).join('\n');
    expect(errors).toMatch(/no anchor "nowhere"/);
    expect(errors).toMatch(/missing node "missing"/);
    expect(errors).toMatch(/next quest "no-such-quest"/);
    expect(errors).toMatch(/unknown npc "ghost"/);
    expect(errors).toMatch(/placed 0 times/);
    expect(errors).toMatch(/unknown objective|has no objective "report"/);
  });

  it('every dialogue node can be reached and each conversation has a default opening', () => {
    for (const d of Object.values(DIALOGUES)) expect(d.entries.at(-1)!.when).toBeUndefined();
  });
});

describe('NPCs and interaction focus', () => {
  it('the Oracle stands at her reserved anchor in the sanctuary, off the shrine, and nowhere else', () => {
    const w = newWorld();
    const oracle = object(w, 'oracle');
    const anchor = getRegion('sanctuary-outskirts').anchors['npc.oracle']!;
    expect([oracle.x, oracle.y]).toEqual([anchor.x, anchor.y]);
    const shrine = object(w, 'sanctuary.shrine');
    expect(Math.abs(oracle.x - shrine.x)).toBeGreaterThanOrEqual(64);
    travel(w, 'forest-road', 'from-sanctuary');
    expect(w.world.sim.objects.some((o) => o.kind === 'npc')).toBe(false);
  });

  it('the prompt invites talking; an NPC takes focus over an overlapping shrine or text', () => {
    const w = newWorld();
    standAt(w, 'oracle');
    expect(promptLabel(w.world.sim.focus, w.profile.world)).toBe('Talk · The Oracle');
    // Put a shrine and a lore stone right on top of her: talking still wins, and only one thing happens.
    const oracle = object(w, 'oracle');
    const sim = w.world.sim;
    sim.objects.push({ kind: 'checkpoint', id: 'sanctuary.shrine', name: 'x', x: oracle.x, y: oracle.y, zone: { ...oracle.zone } });
    sim.objects.push({ kind: 'lore', id: 'lore.waystone', x: oracle.x, y: oracle.y, zone: { ...oracle.zone } });
    step(w, 1);
    expect(sim.focus?.kind).toBe('npc');
    w.events.length = 0;
    interact(w);
    expect(w.events.filter((e) => e.type === 'talk' || e.type === 'shrine' || e.type === 'lore').map((e) => e.type)).toEqual(['talk']);
    expect(w.profile.world.isActive('sanctuary.shrine')).toBe(false);
  });
});

describe('Dialogue', () => {
  it('advances node by node, offers choices, and finishes', () => {
    const p = new PlayerProfile();
    const applied: unknown[] = [];
    const c = new Conversation('oracle', p, (o) => applied.push(o));
    expect(c.nodeId).toBe('greet');
    c.choose(0); // no choices here: ignored
    expect(c.nodeId).toBe('greet');
    while (!c.choices.length) c.advance();
    expect(c.choices.map((x) => x.text)).toEqual(['Why me?', 'What would you have me do?']);
    c.choose(0);
    expect(c.nodeId).toBe('why');
    c.advance();
    expect(c.nodeId).toBe('ask');
    c.choose(1); // Not yet.
    expect(applied).toEqual([]);
    expect(c.nodeId).toBe('later');
    c.advance();
    expect(c.finished).toBe(true);
  });

  it('what the Oracle says follows the quest', () => {
    const p = new PlayerProfile();
    const d = DIALOGUES.oracle!;
    expect(startNode(d, p)).toBe('greet');
    startQuest(p, 'first-omen');
    expect(startNode(d, p)).toBe('reminder');
    p.world.visited.add('forest-road');
    p.world.activate('forest.shrine');
    questEvent(p, { type: 'activateCheckpoint', checkpoint: 'forest.shrine' });
    expect(startNode(d, p)).toBe('report');
    questEvent(p, { type: 'talk', npc: 'oracle' });
    expect(startNode(d, p)).toBe('after');
  });

  it('the opening establishes the Seven, their Halos and the first task without explaining everything', () => {
    const w = newWorld();
    const { lines } = talkToOracle(w, ['What would you have me do?', 'I will go.']);
    const all = lines.join(' ');
    expect(all).toMatch(/The Seven are dead/);
    expect(all).toMatch(/Halos were not destroyed/);
    expect(all).toMatch(/Go beyond the sanctuary/);
    expect(lines.length).toBeLessThanOrEqual(9);
    expect(w.profile.quests.status('first-omen')).toBe('active');
  });
});

describe('The First Omen', () => {
  it('runs in order: leave the sanctuary, light the forest shrine, return to the Oracle', () => {
    const w = newWorld();
    talkToOracle(w, ['What would you have me do?', 'I will go.']);
    expect(w.profile.quests.currentObjective('first-omen')).toBe('leave');
    expect(currentObjective(w.profile)).toBe('Venture beyond the sanctuary');
    // Talking to her again early doesn't skip ahead.
    talkToOracle(w);
    expect(w.profile.quests.currentObjective('first-omen')).toBe('leave');
    travel(w, 'forest-road', 'from-sanctuary');
    expect(w.profile.quests.currentObjective('first-omen')).toBe('shrine');
    standAt(w, 'forest.shrine');
    interact(w);
    expect(w.profile.quests.currentObjective('first-omen')).toBe('report');
    const xp = w.profile.wallet.experience;
    w.events.length = 0;
    const { lines } = talkToOracle(w);
    expect(lines[0]).toMatch(/You came back/);
    expect(w.profile.quests.status('first-omen')).toBe('completed');
    expect(w.profile.wallet.experience).toBe(xp + QUESTS['first-omen']!.rewards!.experience!);
    // The main quest is now under way, at 0 of 7 Halos.
    expect(w.profile.quests.status('seven-halos')).toBe('active');
    const main = journalQuests(w.profile).find((q) => q.id === 'seven-halos')!;
    expect(main.objectives).toEqual([{ text: 'Recover the Seven Halos', done: false, progress: '0/7' }]);
    const toasts = w.events.filter((e) => e.type === 'quest').map((e) => questToast((e as Extract<SimEvent, { type: 'quest' }>).change));
    expect(toasts).toEqual(['Quest complete: The First Omen', 'New quest: The Seven Halos']);
  });

  it('completes and rewards exactly once', () => {
    const p = new PlayerProfile();
    p.world.visited.add('forest-road');
    p.world.activate('forest.shrine');
    startQuest(p, 'first-omen');
    expect(p.quests.currentObjective('first-omen')).toBe('report');
    expect(questEvent(p, { type: 'talk', npc: 'oracle' }).map((c) => c.type)).toEqual(['completed', 'started']);
    const xp = p.wallet.experience;
    expect(questEvent(p, { type: 'talk', npc: 'oracle' })).toEqual([]);
    expect(startQuest(p, 'first-omen')).toEqual([]);
    expect(startQuest(p, 'seven-halos')).toEqual([]);
    expect(p.wallet.experience).toBe(xp);
  });

  it('a player who already lit the forest shrine is credited instead of sent back', () => {
    const w = newWorld();
    lightForestShrine(w);
    const { lines } = talkToOracle(w, ['It stands. It burns.']);
    expect(lines[0]).toMatch(/already walked the forest road/);
    expect(w.profile.quests.status('first-omen')).toBe('completed');
    expect(w.profile.quests.status('seven-halos')).toBe('active');
  });

  it('quest progress survives rest, fast travel, death and reload', () => {
    let w = newWorld();
    talkToOracle(w, ['What would you have me do?', 'I will go.']);
    lightForestShrine(w);
    expect(w.world.sim.requestRest()).toBe('ok');
    step(w, 1);
    expect(w.profile.quests.currentObjective('first-omen')).toBe('report');
    standAt(w, 'forest.shrine');
    expect(w.world.sim.requestFastTravel('forest.shrine')).toBe('ok');
    step(w, 1);
    killPlayer(w);
    expect(w.profile.quests.currentObjective('first-omen')).toBe('report');
    w = reload(w);
    expect(w.profile.quests.currentObjective('first-omen')).toBe('report');
    talkToOracle(w);
    expect(w.profile.quests.status('first-omen')).toBe('completed');
    w = reload(w);
    expect(w.profile.quests.status('first-omen')).toBe('completed');
    expect(startNode(DIALOGUES.oracle!, w.profile)).toBe('after');
  });
});

describe('Lore', () => {
  it('reading an inscription records it once; it stays in the journal after reload', () => {
    let w = newWorld();
    standAt(w, 'lore.waystone');
    expect(promptLabel(w.world.sim.focus, w.profile.world)).toBe('Read');
    w.events.length = 0;
    interact(w);
    interact(w);
    const reads = w.events.filter((e) => e.type === 'lore') as Extract<SimEvent, { type: 'lore' }>[];
    expect(reads.map((e) => e.firstTime)).toEqual([true, false]);
    const gold = w.profile.wallet.gold;
    w = reload(w);
    expect(journalLore(w.profile).map((l) => l.id)).toEqual(['lore.waystone']);
    expect(w.profile.wallet.gold).toBe(gold);
  });

  it('every lore entry stands in its region', () => {
    for (const r of REGIONS) for (const o of getRegion(r.id).objects) if (o.kind === 'lore') expect(GAME_NARRATIVE.lore[o.id]!.region).toBe(r.id);
  });
});

describe('Save v4', () => {
  /** What 2C.1a wrote: v3 with the forest shrine lit and the cache opened. */
  const REAL_V3 = {
    version: 3,
    savedAt: '2026-10-28T23:40:00.000Z',
    currencies: { experience: 640, gold: 252, weaponXp: 85 },
    inventory: { nextUid: 6, items: [{ uid: 1, itemId: 'pilgrim-sword', quantity: 1, upgradeLevel: 1 }, { uid: 4, itemId: 'grave-dust', quantity: 5, upgradeLevel: 0 }, { uid: 5, itemId: 'mourning-crescent', quantity: 1, upgradeLevel: 2 }] },
    equipment: { mainHand: 5 },
    world: { location: { region: 'forest-road', anchor: 'forest.shrine' }, respawn: { region: 'forest-road', anchor: 'forest.shrine' }, checkpoints: ['sanctuary.shrine', 'forest.shrine'], flags: ['forest.cache.canopy'] },
  };

  it('migrates v3 → v4: everything kept, backed up first, visited regions reconstructed', () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify(REAL_V3);
    storage.save(SAVE_KEY, raw);
    const profile = new PlayerProfile();
    const save = new SaveManager(storage, profile);
    expect(save.load()).toBe('migrated');
    expect(storage.load(migrationBackupKey(3))).toBe(raw);
    expect(profile.inventory.all.map((i) => [i.uid, i.upgradeLevel])).toEqual([[1, 1], [4, 0], [5, 2]]);
    expect(profile.loadout.get('mainHand')).toBe(5);
    expect([profile.wallet.experience, profile.wallet.gold, profile.wallet.weaponXp]).toEqual([640, 252, 85]);
    expect([...profile.world.checkpoints]).toEqual(['sanctuary.shrine', 'forest.shrine']);
    expect(profile.world.hasFlag('forest.cache.canopy')).toBe(true);
    expect([...profile.world.visited].sort()).toEqual(['forest-road', 'sanctuary-outskirts']);
    const stored = JSON.parse(storage.load(SAVE_KEY)!);
    expect(stored.version).toBe(SAVE_VERSION);
    expect([stored.quests, stored.lore]).toEqual([{}, []]);
    // And the first quest credits that old progress.
    startQuest(profile, 'first-omen');
    expect(profile.quests.currentObjective('first-omen')).toBe('report');
  });

  it('drops unknown quests and lore, and clamps malformed progress', () => {
    const p = new PlayerProfile();
    applySave(
      JSON.stringify({
        ...serializeProfile(p),
        quests: { 'first-omen': { status: 'active', objective: 99, progress: -3 }, 'seven-halos': { status: 'active', objective: 0, progress: 50 }, made: { status: 'active', objective: 0 }, broken: 7 },
        lore: ['lore.waystone', 'lore.fake', 3],
      }),
      p,
    );
    expect(p.quests.entries().map(([id]) => id).sort()).toEqual(['first-omen', 'seven-halos']);
    expect(p.quests.currentObjective('first-omen')).toBe('report');
    expect(p.quests.get('seven-halos')!.progress).toBe(6);
    expect([...p.lore]).toEqual(['lore.waystone']);
  });
});
