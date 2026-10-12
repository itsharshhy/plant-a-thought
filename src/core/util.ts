export const $ = <T extends HTMLElement = HTMLElement>(s: string): T => document.querySelector(s) as T;

/** FNV-1a string hash. */
export function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Deterministic PRNG (mulberry32). */
export function rng(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const hx = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
export function mix(a: string, b: string, t: number): string {
  const x = hx(a), y = hx(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t))})`;
}

export const esc = (x: string) =>
  x.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function randomHex(bytes = 16): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const show = (sel: string, on = true) => document.querySelector(sel)?.classList.toggle('hide', !on);
