import { describe, it, expect } from 'vitest';
import { needsSupport } from '../../src/safety';

describe('crisis check', () => {
  it.each(['I want to die', 'thinking about suicide', 'I keep hurting myself', 'मैं मरना चाहता हूँ', 'aatmahatya', "I don't want to live anymore"])('offers help for "%s"', (t) => expect(needsSupport(t)).toBe(true));
  it.each(['dying my hair blue', 'this exam is killing me lol', 'sunlight', 'I want to dance'])('stays quiet for "%s"', (t) => expect(needsSupport(t)).toBe(false));
});
