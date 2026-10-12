import { g, view } from '../core/canvas';
import { clock } from '../core/clock';
import { mix, rng } from '../core/util';
import { sfx } from '../core/audio';
import type { Theme } from '../data/profile';
import { moodColor } from '../data/moods';

export const PETAL = ['#F29FB0', '#FFD27A', '#F0A04B', '#8FC7D9', '#E8B7F0', '#FFF4E0'];
const DAY = [['#F7C8D4', '#FBE3C8', '#FFF4E0'], ['#A9D8E8', '#D5EBE0', '#F6F1DC'], ['#F2A65A', '#F7C59F', '#FFE6C7'], ['#6C5B8E', '#D98A8A', '#F4B88A'], ['#1E2A4A', '#34406B', '#5A5F8F']];
const FIXED: Partial<Record<Theme, string[]>> = {
  night: ['#0B1030', '#1E2A4A', '#3B4A7A'], space: ['#05030F', '#150B2E', '#2A1450'],
  sunny: ['#6EC6F5', '#B8E4FA', '#FFF1B8'], clouds: ['#C9D9E8', '#E4ECF3', '#F7F4EE'],
};

/** Paint the sky. `progress` 0..1 moves the meadow theme from dawn to night. */
export function sky(theme: Theme, progress: number, cam: number) {
  const { W, H } = view, T = clock.T;
  const p = Math.min(Math.max(progress, 0), 1) * 4, i = Math.min(3, Math.floor(p)), t = p - i;
  const gr = g.createLinearGradient(0, 0, 0, H);
  [0, 0.5, 1].forEach((s, k) => gr.addColorStop(s, FIXED[theme] ? FIXED[theme]![k] : mix(DAY[i][k], DAY[i + 1][k], t)));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  themeFx(theme, cam);
  g.fillStyle = 'rgba(255,248,235,.22)';
  for (let k = 0; k < 7; k++) { const x = ((k * 173 + T * 6) % (W + 240)) - 120, y = (((k * 97 + cam * 0.15) % H) + H) % H; g.beginPath(); g.ellipse(x, y, 70 + k * 8, 16 + k * 2, 0, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(255,230,160,.5)';
  for (let k = 0; k < 26; k++) { const x = (k * 131 + Math.sin(T * 0.4 + k) * 20) % W, y = (((k * 67 - T * 10 + cam * 0.3) % H) + H) % H; g.fillRect(x, y, 2, 2); }
}

function themeFx(th: Theme, cam: number) {
  const { W, H } = view, T = clock.T;
  if (th === 'night' || th === 'space') { g.fillStyle = '#FFF8EB'; for (let k = 0; k < 70; k++) { g.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(T * 1.5 + k)); const s = k % 5 ? 1.5 : 2.5; g.fillRect((k * 97.3) % W, ((((k * 53.7 + cam * 0.04) % H) + H) % H), s, s); } g.globalAlpha = 1; }
  if (th === 'night') { g.fillStyle = '#FFF4D6'; g.beginPath(); g.arc(W * 0.8, 90, 28, 0, 7); g.fill(); g.fillStyle = '#24325c'; g.beginPath(); g.arc(W * 0.8 + 11, 84, 24, 0, 7); g.fill(); }
  if (th === 'space') {
    ([[0.25, 0.3, '200,100,255'], [0.75, 0.7, '80,200,220']] as const).forEach((n) => { const r = g.createRadialGradient(W * n[0], H * n[1], 0, W * n[0], H * n[1], Math.max(W, H) * 0.5); r.addColorStop(0, `rgba(${n[2]},.22)`); r.addColorStop(1, `rgba(${n[2]},0)`); g.fillStyle = r; g.fillRect(0, 0, W, H); });
    g.fillStyle = '#E8B7F0'; g.beginPath(); g.arc(W * 0.8, 110, 32, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,248,235,.7)'; g.lineWidth = 3; g.beginPath(); g.ellipse(W * 0.8, 110, 56, 12, -0.35, 0, 7); g.stroke();
  }
  if (th === 'sunny') { const x = W * 0.2, y = 110, r = g.createRadialGradient(x, y, 10, x, y, 170); r.addColorStop(0, 'rgba(255,240,170,.8)'); r.addColorStop(1, 'rgba(255,240,170,0)'); g.fillStyle = r; g.fillRect(0, 0, W, H); g.fillStyle = '#FFE08A'; g.beginPath(); g.arc(x, y, 34, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,224,138,.7)'; g.lineWidth = 3; for (let k = 0; k < 12; k++) { const a = (k / 12) * 6.283 + T * 0.1; g.beginPath(); g.moveTo(x + Math.cos(a) * 46, y + Math.sin(a) * 46); g.lineTo(x + Math.cos(a) * 62, y + Math.sin(a) * 62); g.stroke(); } }
  if (th === 'clouds') { g.fillStyle = 'rgba(255,255,255,.6)'; for (let k = 0; k < 5; k++) { const x = ((k * 230 + T * 10) % (W + 400)) - 200, y = ((((k * 150 + cam * 0.25) % (H + 200)) + H + 200) % (H + 200)) - 60; [[0, 0, 38], [34, -10, 30], [-34, 6, 28], [62, 8, 24]].forEach((c) => { g.beginPath(); g.arc(x + c[0], y + c[1], c[2], 0, 7); g.fill(); }); } }
}

export function mountains(cam: number) {
  const { W, H } = view;
  ([[0.8, 'rgba(63,90,58,.28)', 70, 0.012, 0.1], [0.92, 'rgba(47,70,45,.36)', 45, 0.02, 0.18]] as const).forEach((l) => {
    const yy = H * l[0] + Math.max(0, cam) * l[4];
    if (yy > H + l[2] * 2) return;
    g.fillStyle = l[1]; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W + 20; x += 20) g.lineTo(x, yy - Math.abs(Math.sin(x * l[3] * 3 + l[0] * 9)) * l[2] - Math.sin(x * l[3]) * l[2] * 0.5);
    g.lineTo(W, H); g.fill();
  });
}

export interface IslandShape { x: number; y: number; hw: number; r: number }
export function island(s: IslandShape) {
  g.beginPath(); g.moveTo(s.x - s.hw, s.y);
  g.quadraticCurveTo(s.x - s.hw * 0.9, s.y + 34, s.x - s.hw * 0.2, s.y + 58 + s.r * 20);
  g.quadraticCurveTo(s.x, s.y + 74, s.x + s.hw * 0.25, s.y + 56);
  g.quadraticCurveTo(s.x + s.hw * 0.95, s.y + 32, s.x + s.hw, s.y); g.closePath();
  const gr = g.createLinearGradient(0, s.y, 0, s.y + 70); gr.addColorStop(0, '#8C867E'); gr.addColorStop(1, '#5E5A57'); g.fillStyle = gr; g.fill();
  g.fillStyle = '#6B8F5A'; g.beginPath(); g.moveTo(s.x - s.hw, s.y); g.quadraticCurveTo(s.x, s.y - 14, s.x + s.hw, s.y); g.quadraticCurveTo(s.x, s.y + 14, s.x - s.hw, s.y); g.fill();
}

export interface FlowerOpts { seed: number; word: string; mood?: string | null; size?: number; age?: number; label?: boolean | 'always'; glow?: boolean }

/** A flower grown from a word: longer words grow bigger blooms; mood sets the petal color. */
export function flower(x: number, y: number, o: FlowerOpts) {
  const T = clock.T, r = rng(o.seed), age = o.age ?? 99, k = Math.min(1, age / 1.6), ek = 1 - Math.pow(1 - k, 3), M = o.size ?? 1, w = o.word;
  const mr = Math.min(70, 14 + w.length * 1.6) * ek * Math.min(M, 1.4);
  g.fillStyle = 'rgba(156,194,131,.8)'; g.beginPath(); g.ellipse(x, y + 1, mr, 4 * ek, 0, 0, 7); g.fill();
  const h = (16 + r() * 20) * ek * M, n = 5 + Math.floor(r() * 4), pr = (5 + r() * 4 + Math.min(w.length, 10) * 0.4) * ek * M;
  const pc = PETAL[Math.floor(r() * PETAL.length)], col = moodColor(o.mood) || pc, sw = Math.sin(T * 1.5 + o.seed) * 2.5;
  g.strokeStyle = '#3F5A3A'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + sw * 0.5, y - h * 0.5, x + sw, y - h); g.stroke();
  if (o.glow !== false) { const gl = g.createRadialGradient(x + sw, y - h, 0, x + sw, y - h, pr * 3.4); gl.addColorStop(0, 'rgba(255,210,122,.45)'); gl.addColorStop(1, 'rgba(255,210,122,0)'); g.fillStyle = gl; g.beginPath(); g.arc(x + sw, y - h, pr * 3.4, 0, 7); g.fill(); }
  g.fillStyle = col;
  for (let q = 0; q < n; q++) { const a = (q / n) * 6.283 + T * 0.2; g.beginPath(); g.ellipse(x + sw + Math.cos(a) * pr * 0.8, y - h + Math.sin(a) * pr * 0.8, pr * 0.6, pr * 0.6, 0, 0, 7); g.fill(); }
  g.fillStyle = '#FFD27A'; g.beginPath(); g.arc(x + sw, y - h, pr * 0.45, 0, 7); g.fill();
  if (w.length >= 7) { g.fillStyle = '#B9B2A6'; g.beginPath(); g.ellipse(x + 14, y - 2, 6 * ek, 4 * ek, 0, 0, 7); g.fill(); }
  const showLabel = o.label === 'always' || (o.label && age < 5.5);
  if (showLabel && w.trim()) {
    const a = o.label === 'always' ? 1 : Math.min(1, 5.5 - age) * Math.min(1, age * 2);
    const text = w.length > 40 ? w.slice(0, 38) + '…' : w;
    g.globalAlpha = a; g.font = '600 ' + Math.max(13, 20 - Math.max(0, text.length - 12) * 0.35) + 'px Caveat,cursive';
    g.textAlign = 'center'; g.fillStyle = '#FFF8EB'; g.shadowColor = 'rgba(47,58,43,.7)'; g.shadowBlur = 4;
    g.fillText(text, x + sw, y - h - pr - 10 - (o.label === 'always' ? 0 : age * 3)); g.shadowBlur = 0; g.globalAlpha = 1;
  }
  return { tipX: x + sw, tipY: y - h, r: pr };
}

/** Birds and butterflies that drift up when you land or plant. */
interface Critter { bird: boolean; x: number; y: number; vx: number; vy: number; ph: number; col: string; age: number; life: number; s: number }
const crit: Critter[] = [];

export function burst(x: number, y: number, n = 5) {
  if (n > 1) sfx.spark();
  for (let q = 0; q < n; q++) {
    const bird = Math.random() < 0.4, dir = Math.random() < 0.5 ? -1 : 1;
    crit.push({ bird, x: x + (Math.random() - 0.5) * 160, y: y - 40 - Math.random() * 120, vx: bird ? dir * (110 + Math.random() * 80) : (Math.random() - 0.5) * 50, vy: bird ? -10 - Math.random() * 30 : -20 - Math.random() * 25, ph: Math.random() * 6, col: PETAL[Math.floor(Math.random() * PETAL.length)], age: 0, life: 6 + Math.random() * 4, s: 0.8 + Math.random() * 0.6 });
  }
  if (crit.length > 40) crit.splice(0, crit.length - 40);
}

export function crittersTick(dt: number) {
  const T = clock.T;
  for (let i = crit.length - 1; i >= 0; i--) {
    const c = crit[i]; c.age += dt;
    c.x += c.vx * dt + (c.bird ? 0 : Math.cos(T * 3 + c.ph) * 30 * dt);
    c.y += c.vy * dt + (c.bird ? Math.sin(T * 2 + c.ph) * 8 * dt : Math.sin(T * 5 + c.ph) * 40 * dt);
    if (c.age > c.life) crit.splice(i, 1);
  }
}

export const critterCount = () => crit.length;
export const clearCritters = () => { crit.length = 0; };

export function drawCritters(bird: boolean) {
  const T = clock.T;
  for (const c of crit) {
    if (c.bird !== bird) continue;
    const a = Math.min(1, c.age * 1.5, (c.life - c.age) * 0.7);
    g.save(); g.globalAlpha = Math.max(0, a) * (bird ? 0.75 : 1); g.translate(c.x, c.y); g.scale(c.s * (bird && c.vx < 0 ? -1 : 1), c.s);
    if (bird) { const w = Math.sin(T * 12 + c.ph) * 6; g.strokeStyle = '#2F3A2B'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(-10, w); g.quadraticCurveTo(-4, -5 + w / 2, 0, 0); g.quadraticCurveTo(4, -5 + w / 2, 10, w); g.stroke(); }
    else { const f = Math.abs(Math.sin(T * 13 + c.ph)); g.fillStyle = c.col; g.beginPath(); g.ellipse(-5 * f, -2, 6 * f + 1, 7, -0.3, 0, 7); g.ellipse(5 * f, -2, 6 * f + 1, 7, 0.3, 0, 7); g.fill(); g.strokeStyle = '#3F5A3A'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -6); g.lineTo(0, 6); g.stroke(); }
    g.restore();
  }
}

/** Small reusable puff particles. */
interface Part { x: number; y: number; vx: number; vy: number; l: number; c: string }
const parts: Part[] = [];
export function puff(x: number, y: number, n: number, c: string) { for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 120, l: 0.6 + Math.random() * 0.4, c }); }
export function trail(x: number, y: number) { parts.push({ x, y, vx: 0, vy: 20, l: 0.45, c: PETAL[Math.floor(Math.random() * 6)] }); }
export function partsTick(dt: number) { for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.l -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; if (p.l <= 0) parts.splice(i, 1); } }
export function drawParts() { parts.forEach((p) => { g.globalAlpha = Math.max(0, Math.min(1, p.l / 0.5)); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, 3, 0, 7); g.fill(); }); g.globalAlpha = 1; }
export const clearParts = () => { parts.length = 0; };
