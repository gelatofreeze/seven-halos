/**
 * Readable lore: inscriptions, books and records placed in the world with a
 * `lore` marker. Reading one records it (saved) and adds it to the journal,
 * where it can be reread. Writing stays within approved lore: it hints, it
 * never explains the war, the Halos or any restoration.
 */
export interface LoreEntry {
  id: string;
  title: string;
  /** Paragraphs, plain text. */
  text: readonly string[];
  region: string;
}

export const LORE: Record<string, LoreEntry> = {
  'lore.waystone': {
    id: 'lore.waystone',
    title: 'The Waystone on the Sanctuary Road',
    region: 'sanctuary-outskirts',
    text: [
      'Carved deep, and worn almost smooth by rain:',
      '“Seven walked this road before any pilgrim. They had no need of roads. They walked it anyway, together, so that the road would learn the way.”',
      'Beneath it, scratched much later and in a shakier hand: “They stopped walking it. The road still remembers.”',
    ],
  },
  'lore.sealed-gate': {
    id: 'lore.sealed-gate',
    title: 'A Note at the Sealed Gate',
    region: 'forest-road',
    text: [
      'The gate does not answer to hands. Whoever sealed it did so from the other side, and the seal has outlasted them.',
      'A pilgrim’s note is pinned to the stone with a rusted nail: “Not yet. Whatever waits beyond is not ready for us. Or we are not ready for it.”',
    ],
  },
  'lore.hollow-ledge': {
    id: 'lore.hollow-ledge',
    title: 'Words on the High Ledge',
    region: 'root-hollow',
    text: [
      'Cut into the worked stone of the ledge, where no one standing below could read it:',
      '“We kept the old rings here, the ones the air still listens to. One for each keeper of this place. Only one keeper came back for theirs.”',
      'Beneath it, smaller: “If you are reading this, you climbed what we could not without one. Keep it. The air remembers whoever asks.”',
    ],
  },
};

export function getLore(id: string): LoreEntry {
  const l = LORE[id];
  if (!l) throw new Error(`Unknown lore: ${id}`);
  return l;
}
