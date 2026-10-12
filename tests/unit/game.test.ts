import { describe, it, expect } from 'vitest';
import { genIsland, MAX_REACH, MAX_HALF_WIDTH, promptEvery } from '../../src/game/climb';
import { unit, playerX, VIS, reactionTime, laneLayout } from '../../src/game/dodge';
import { cleanLook } from '../../src/data/profile';

describe('Thought-mode islands', () => {
  it('stay within reach, so they fit on screen once the camera follows you', () => {
    for (const seed of [1, 42, 999, 123456, 987654321]) {
      let prev = 0;
      for (let k = 0; k < 400; k++) {
        const s = genIsland(seed, k, prev, 5);
        prev = s.bx;
        expect(Math.abs(s.bx) + s.m).toBeLessThanOrEqual(MAX_REACH + 1e-9);
        expect(s.hw).toBeLessThanOrEqual(MAX_HALF_WIDTH);
      }
    }
  });
  it('fit entirely on the narrowest phone (320px at the minimum zoom of 0.7)', () => {
    expect(MAX_REACH + MAX_HALF_WIDTH).toBeLessThanOrEqual(320 / 2 / 0.7);
  });
  it('never move on question islands', () => {
    for (let k = 0; k < 200; k += promptEvery('calm')) expect(genIsland(7, k, 0, 5).m).toBe(0);
  });
  it('are identical for both players with the same seed', () => expect(genIsland(5, 30, 10, 5)).toEqual(genIsland(5, 30, 10, 5)));
});

describe('Dodge fairness', () => {
  it('gives the same reaction time on every screen width', () => {
    for (const W of [320, 390, 768, 1440, 2560]) expect((W - playerX(W)) / unit(W)).toBeCloseTo(VIS);
    expect(reactionTime()).toBeGreaterThan(1.3);
    expect(reactionTime(true)).toBeGreaterThan(0.9);
  });
  it('keeps the top lane and jumps clear of the HUD', () => {
    const L = laneLayout(568, 90, true);
    expect(L.theirs - L.maxTheirs).toBeGreaterThanOrEqual(90 + 60);
    expect(L.mine - L.maxMine).toBeGreaterThan(L.theirs);
    const S = laneLayout(568, 90, false);
    expect(S.mine - S.maxMine).toBeGreaterThanOrEqual(90 + 60);
  });
});

describe('network input', () => {
  it('cleans a partner look from the network', () => {
    expect(cleanLook({ name: 'x'.repeat(99), color: 'red;evil', hat: 'bomb', kind: 'kitty' })).toEqual({ name: 'x'.repeat(16), color: '#9CC283', hat: 'none', kind: 'cat' });
    expect(cleanLook(null).name).toBe('Pip');
  });
});
