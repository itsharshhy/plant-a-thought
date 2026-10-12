import { load, save } from './core/store';
import { randomHex } from './core/util';
import { dayKey } from './data/prompts';
import { isMood, type Mood } from './data/moods';

/** A thought you planted. Lives only on this device unless you plant it in a shared garden yourself. */
export interface Entry { id: string; ts: number; word: string; mood: Mood | null; note: string; prompt: string; mode: string }

const KEY = 'pat-journal';
let cache: Entry[] | null = null;

function valid(e: unknown): e is Entry {
  const o = e as Entry;
  return !!o && typeof o.id === 'string' && typeof o.ts === 'number' && typeof o.word === 'string';
}

export function entries(): Entry[] {
  if (!cache) cache = load<unknown[]>(KEY, []).filter(valid).map((e) => ({ ...e, mood: isMood(e.mood) ? e.mood : null, note: e.note || '', prompt: e.prompt || '', mode: e.mode || '' }));
  return cache;
}

export function addEntry(e: Omit<Entry, 'id' | 'ts'> & { ts?: number }): Entry {
  const full: Entry = { id: randomHex(8), ts: e.ts ?? Date.now(), word: e.word.slice(0, 280), mood: e.mood, note: e.note.slice(0, 2000), prompt: e.prompt, mode: e.mode };
  entries().push(full);
  persist();
  return full;
}

export function removeEntry(id: string) { cache = entries().filter((e) => e.id !== id); persist(); }
export function clearJournal() { cache = []; persist(); }
function persist() { if (!save(KEY, cache)) console.warn('Journal could not be saved (storage full or blocked).'); }

/** Consecutive days, ending today or yesterday, with at least one thought. */
export function streak(now = new Date()): number {
  const days = new Set(entries().map((e) => dayKey(new Date(e.ts))));
  const d = new Date(now);
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export function exportText(): string {
  return entries().slice().sort((a, b) => a.ts - b.ts).map((e) => {
    const when = new Date(e.ts).toLocaleString();
    return [`${when}${e.mood ? ' · ' + e.mood : ''}`, e.prompt && `Q: ${e.prompt}`, `A: ${e.word}`, e.note && `Note: ${e.note}`].filter(Boolean).join('\n');
  }).join('\n\n');
}

/** For tests. */
export function _resetCache() { cache = null; }
