import { describe, it, expect, beforeEach } from 'vitest';
import { addEntry, entries, removeEntry, clearJournal, streak, exportText, _resetCache } from '../../src/journal';

beforeEach(() => { localStorage.clear(); _resetCache(); });
const base = { mood: null, note: '', prompt: 'Q?', mode: 'calm' } as const;

describe('journal', () => {
  it('survives a reload (the old game wiped it every round)', () => {
    addEntry({ ...base, word: 'sunlight' });
    _resetCache();
    expect(entries().map((e) => e.word)).toEqual(['sunlight']);
  });
  it('deletes one or all', () => {
    const a = addEntry({ ...base, word: 'a' });
    addEntry({ ...base, word: 'b' });
    removeEntry(a.id);
    expect(entries().map((e) => e.word)).toEqual(['b']);
    clearJournal();
    expect(entries()).toEqual([]);
  });
  it('counts a gentle streak ending today or yesterday', () => {
    const now = new Date(2026, 9, 12, 12);
    const day = (n: number) => new Date(2026, 9, 12 - n, 10).getTime();
    [1, 2, 3, 5].forEach((n) => addEntry({ ...base, word: 'x', ts: day(n) }));
    expect(streak(now)).toBe(3);
    addEntry({ ...base, word: 'x', ts: day(0) });
    expect(streak(now)).toBe(4);
  });
  it('exports readable text including private notes', () => {
    addEntry({ ...base, word: 'tea', note: 'with mum', mood: 'calm' });
    expect(exportText()).toMatch(/Q: Q\?\nA: tea\nNote: with mum/);
  });
  it('ignores corrupted storage instead of crashing', () => {
    localStorage.setItem('pat-journal', '[{"bad":1}, null, 5]');
    _resetCache();
    expect(entries()).toEqual([]);
  });
});
