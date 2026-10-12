import { describe, it, expect } from 'vitest';
import { genCode, normalizeCode } from '../../src/net/room';

describe('room codes', () => {
  it('generates WORD-1234 codes', () => {
    for (let i = 0; i < 200; i++) expect(genCode()).toMatch(/^[A-Z]{4}-\d{4}$/);
  });
  it('accepts the ways people type codes', () => {
    expect(normalizeCode('moss-4821')).toBe('MOSS-4821');
    expect(normalizeCode(' Moss 4821 ')).toBe('MOSS-4821');
    expect(normalizeCode('MOSS4821')).toBe('MOSS-4821');
  });
  it('rejects bad codes, including old 2-digit ones', () => {
    for (const c of ['MOSS-42', 'MOS-4821', 'MOSS-48211', '', '1234-MOSS']) expect(normalizeCode(c)).toBeNull();
  });
});
