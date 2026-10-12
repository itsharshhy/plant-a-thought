import { cv, g, view, wrapText } from '../core/canvas';
import { clock } from '../core/clock';
import { clamp, hash, rng } from '../core/util';
import { sky, flower } from '../draw/scenery';
import type { Theme } from '../data/profile';

export interface Bloom { id: string; word: string; mood: string | null; waters: number; mine?: boolean }

/** A meadow of flowers, one per thought, in planting order. Scrolls when there are many. */
const st = { drawn: 0, items: [] as Bloom[], top: 0, bottom: 0, scroll: 0, maxScroll: 0, selected: '', born: new Map<string, number>(), drag: null as null | { y: number; s: number; moved: boolean }, onPick: (_b: Bloom) => {} };

export function setGarden(items: Bloom[], onPick: (b: Bloom) => void) {
  const T = clock.T;
  const first = st.born.size === 0;
  for (const b of items) if (!st.born.has(b.id)) st.born.set(b.id, first ? T - 10 : T);
  st.items = items;
  st.onPick = onPick;
}
export const resetGarden = () => { st.items = []; st.scroll = 0; st.selected = ''; st.born.clear(); };
export const selectBloom = (id: string) => { st.selected = id; };
export function setBounds(top: number, bottom: number) { st.top = top; st.bottom = bottom; }
/** How many flowers were drawn inside the visible field last frame (used by tests). */
export const drawnCount = () => st.drawn;

/** Grid cell size for n flowers in the visible area. */
export function cellSize(n: number, W: number, h: number) { return clamp(Math.sqrt((W * h) / Math.max(1, n)), 50, 130); }

function layout() {
  const W = view.W, h = Math.max(120, st.bottom - st.top), n = st.items.length;
  const c = cellSize(n, W, h), cols = Math.max(1, Math.floor(W / c)), rows = Math.ceil(n / cols), padX = (W - cols * c) / 2;
  st.maxScroll = Math.max(0, rows * c + 20 - h);
  st.scroll = clamp(st.scroll, 0, st.maxScroll);
  const padY = Math.max(0, (h - rows * c) / 2);
  return st.items.map((b, i) => {
    const r = rng(hash(b.id)), col = i % cols, row = Math.floor(i / cols);
    return { b, c, x: padX + col * c + c / 2 + (r() - 0.5) * c * 0.3, y: st.top + padY + row * c + c * 0.85 + (r() - 0.5) * c * 0.15 - st.scroll };
  });
}

export function gardenFrame(theme: Theme, emptyText: string) {
  const { W, H } = view, T = clock.T;
  sky(theme, 0.2, 0);
  const gr = g.createLinearGradient(0, st.top, 0, H);
  gr.addColorStop(0, 'rgba(156,194,131,.0)'); gr.addColorStop(0.08, 'rgba(156,194,131,.55)'); gr.addColorStop(1, 'rgba(107,143,90,.85)');
  g.fillStyle = gr; g.fillRect(0, st.top, W, H - st.top);
  const L = layout(), many = L.length > 60;
  st.drawn = 0;
  g.save(); g.beginPath(); g.rect(0, st.top - 40, W, st.bottom - st.top + 40); g.clip();
  for (const p of L) {
    if (p.y < st.top - p.c || p.y > st.bottom + p.c) continue;
    if (p.y > st.top - 10 && p.y < st.bottom + 10) st.drawn++;
    const sel = p.b.id === st.selected, size = clamp(p.c / 75, 0.55, 1.5) * (1 + Math.min(p.b.waters, 10) * 0.05);
    const tip = flower(p.x, p.y, { seed: hash(p.b.id), word: p.b.word, mood: p.b.mood, size, age: T - (st.born.get(p.b.id) ?? T - 10), glow: !many || sel, label: sel || p.c >= 95 ? 'always' : false });
    if (p.b.waters) { g.font = '700 11px Nunito,sans-serif'; g.textAlign = 'center'; g.fillStyle = '#FFF8EB'; g.fillText('💧' + p.b.waters, p.x, p.y + 16); }
    if (sel) { g.strokeStyle = 'rgba(255,248,235,.9)'; g.lineWidth = 2; g.beginPath(); g.arc(tip.tipX, tip.tipY, tip.r * 1.8 + 6, 0, 7); g.stroke(); }
  }
  g.restore();
  if (!L.length) {
    g.save(); g.textAlign = 'center'; g.fillStyle = '#FFF8EB'; g.shadowColor = 'rgba(47,58,43,.7)'; g.shadowBlur = 4; g.font = '600 26px Caveat,cursive';
    wrapText(emptyText, W / 2, (st.top + st.bottom) / 2, W - 48, 30); g.restore();
  }
  if (st.maxScroll > 0) { const hh = st.bottom - st.top, bar = Math.max(30, (hh * hh) / (hh + st.maxScroll)); g.fillStyle = 'rgba(255,248,235,.5)'; g.fillRect(W - 5, st.top + (hh - bar) * (st.scroll / st.maxScroll), 3, bar); }
}

function pick(x: number, y: number) {
  let best: { b: Bloom; d: number } | null = null;
  for (const p of layout()) {
    const d = Math.hypot(p.x - x, p.y - p.c * 0.35 - y);
    if (d < p.c * 0.6 && (!best || d < best.d)) best = { b: p.b, d };
  }
  if (best) { st.selected = best.b.id; st.onPick(best.b); }
}

export function gardenPointer(active: () => boolean) {
  cv.addEventListener('pointerdown', (e) => { if (active()) st.drag = { y: e.clientY, s: st.scroll, moved: false }; });
  cv.addEventListener('pointermove', (e) => { if (!st.drag || !active()) return; const dy = e.clientY - st.drag.y; if (Math.abs(dy) > 6) st.drag.moved = true; st.scroll = clamp(st.drag.s - dy, 0, st.maxScroll); });
  addEventListener('pointerup', (e) => { if (st.drag && active() && !st.drag.moved) pick(e.clientX, e.clientY); st.drag = null; });
  cv.addEventListener('wheel', (e) => { if (active()) st.scroll = clamp(st.scroll + e.deltaY, 0, st.maxScroll); }, { passive: true });
}
