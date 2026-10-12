import { describe, it, expect, beforeEach } from 'vitest';
import { PACKS, pickPrompt, dailyPrompt, dailySeed, dayKey, tiersFor, getPack, depthFor } from '../../src/data/prompts';

beforeEach(() => localStorage.clear());

describe('prompts', () => {
  it('has many more questions than before (was 36)', () => {
    const total = PACKS.reduce((n, p) => n + p.en.flat().length, 0);
    expect(total).toBeGreaterThanOrEqual(100);
  });

  it('Hindi translations line up with English so the daily question matches', () => {
    for (const p of PACKS) if (p.hi) p.hi.forEach((t, i) => expect(t.length).toBe(p.en[i].length));
  });

  it('never repeats a question until the whole tier has been seen', () => {
    const pool = tiersFor(getPack('everyday'), 'en')[0];
    const seen = new Set(pool.map(() => pickPrompt('everyday', 'en', 0)));
    expect(seen.size).toBe(pool.length);
  });

  it('falls back to English for packs without Hindi', () => {
    expect(pickPrompt('team', 'hi', 0)).toMatch(/[a-z]/i);
    expect(pickPrompt('exams', 'hi', 0)).toMatch(/[ऀ-ॿ]/);
  });

  it('daily question and layout are the same for everyone on a day and change between days', () => {
    expect(dailyPrompt('2026-10-12', 'en')).toBe(dailyPrompt('2026-10-12', 'en'));
    expect(dailySeed('2026-10-12')).toBe(dailySeed('2026-10-12'));
    const week = new Set(['10', '11', '12', '13', '14', '15', '16'].map((d) => dailyPrompt(`2026-10-${d}`, 'en')));
    expect(week.size).toBeGreaterThan(3);
  });

  it('daily question never comes from the deep tier', () => {
    const deep = new Set(getPack('everyday').en[2]);
    for (let d = 1; d <= 28; d++) expect(deep.has(dailyPrompt(`2026-02-${String(d).padStart(2, '0')}`, 'en'))).toBe(false);
  });

  it('dayKey formats local dates', () => expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05'));
  it('goes deeper gradually', () => expect([0, 1, 2, 3, 4, 9].map(depthFor)).toEqual([0, 0, 1, 1, 2, 2]));
});
