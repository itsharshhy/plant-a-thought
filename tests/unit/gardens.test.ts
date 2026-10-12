import { describe, it, expect } from 'vitest';
import { slugFrom } from '../../src/ui/gardens';
import { cellSize } from '../../src/garden/render';

describe('garden links', () => {
  it('reads slugs from links or bare slugs', () => {
    expect(slugFrom('https://plant.example/?g=Aeuy1mrNQTD1')).toBe('Aeuy1mrNQTD1');
    expect(slugFrom('Aeuy1mrNQTD1')).toBe('Aeuy1mrNQTD1');
    expect(slugFrom('not a link')).toBeNull();
    expect(slugFrom('https://x/?g=<script>')).toBeNull();
  });
  it('shrinks flowers as a garden fills, within limits', () => {
    expect(cellSize(1, 390, 500)).toBe(130);
    expect(cellSize(300, 390, 500)).toBe(50);
  });
});
