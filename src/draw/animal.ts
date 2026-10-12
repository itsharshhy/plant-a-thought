import { g } from '../core/canvas';
import { clock } from '../core/clock';
import type { Voice } from '../core/audio';
import type { Kind, Look } from '../data/profile';

/** Per-animal hop feel and voice. pre: crouch time, tf: flight time, gv: gravity, sq: squash, air: stretch style. */
export interface Prof extends Voice { pre: number; tf: number; gv: number; sq: number; air: 'v' | 'h' | 'f' }
export const PROF: Record<Kind, Prof> = {
  sprout: { pre: 0.25, tf: 1, gv: 1400, sq: 1, air: 'v', f: 420, to: 900, d: 0.16, ty: 'sine' },
  bunny: { pre: 0.18, tf: 0.8, gv: 1500, sq: 0.9, air: 'v', f: 520, to: 1000, d: 0.12, ty: 'sine' },
  cat: { pre: 0.45, tf: 1.05, gv: 1300, sq: 0.5, air: 'h', f: 700, to: 1100, d: 0.2, ty: 'triangle' },
  dog: { pre: 0.2, tf: 0.95, gv: 1400, sq: 1, air: 'h', f: 300, to: 620, d: 0.16, ty: 'square' },
  frog: { pre: 0.5, tf: 1.15, gv: 1400, sq: 1.3, air: 'v', f: 190, to: 480, d: 0.24, ty: 'sine' },
  fox: { pre: 0.35, tf: 1, gv: 1400, sq: 0.7, air: 'h', f: 620, to: 1250, d: 0.15, ty: 'triangle' },
  duck: { pre: 0.2, tf: 1.4, gv: 650, sq: 0.6, air: 'f', f: 420, to: 300, d: 0.2, ty: 'sawtooth' },
  bear: { pre: 0.4, tf: 0.9, gv: 1500, sq: 1.5, air: 'v', f: 140, to: 300, d: 0.26, ty: 'sine' },
};

/** Things each animal dislikes: g = ground obstacles, a = air obstacles. */
export const DISLIKES: Record<Kind, { g: string[]; a: string[] }> = {
  sprout: { g: ['🐌', '✂️'], a: ['🐛', '☀️'] }, bunny: { g: ['🦊', '🐍'], a: ['🦅', '🔊'] },
  cat: { g: ['💦', '🥒'], a: ['🐕', '🎈'] }, dog: { g: ['🛁', '🧹'], a: ['🎆', '📮'] },
  frog: { g: ['🐍', '🔥'], a: ['🦅', '🦩'] }, fox: { g: ['🪤', '🐕'], a: ['🦅', '🔊'] },
  duck: { g: ['🦊', '🐈'], a: ['🦅', '🌩️'] }, bear: { g: ['🔥', '🪤'], a: ['🐝', '⛈️'] },
};

export interface Body {
  x: number; y: number; vx: number; vy: number; st: 'stand' | 'air'; sq: number; look: Look; face: number; gv: number;
  isl: number; inv: number; shield: number; cr?: { t: number; d: number } | null; fall?: number; ct?: number; buf?: number;
  h: number; wings: number; boots: number;
}

export function makeBody(look: Look, x = 0, y = 0): Body {
  return { x, y, vx: 0, vy: 0, st: 'stand', sq: 0, look, face: 1, gv: PROF[look.kind].gv, isl: 0, inv: 0, shield: 0, h: 0, wings: 0, boots: 0 };
}

function ears(b: Body) {
  const T = clock.T, k = b.look.kind, c = b.look.color, air = b.st === 'air', w = Math.sin(T * 10) * 0.35;
  if (k === 'bunny') { g.fillStyle = c; g.beginPath(); g.ellipse(-6, -38, 4.5, 12, -0.12, 0, 7); g.ellipse(6, -38, 4.5, 12, 0.12, 0, 7); g.fill(); g.fillStyle = 'rgba(242,159,176,.7)'; g.beginPath(); g.ellipse(-6, -38, 2, 8, -0.12, 0, 7); g.ellipse(6, -38, 2, 8, 0.12, 0, 7); g.fill(); }
  else if (k === 'cat') { g.fillStyle = c; g.beginPath(); g.moveTo(-14, -22); g.lineTo(-10, -39); g.lineTo(-2, -29); g.moveTo(14, -22); g.lineTo(10, -39); g.lineTo(2, -29); g.fill(); g.strokeStyle = c; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-14, -8); g.quadraticCurveTo(-26, -12, -24 + w * 8, -26); g.stroke(); }
  else if (k === 'dog') { g.fillStyle = c; g.beginPath(); g.ellipse(-15, -20, 5, 10, 0.35, 0, 7); g.ellipse(15, -20, 5, 10, -0.35, 0, 7); g.fill(); g.fillStyle = 'rgba(60,40,20,.28)'; g.beginPath(); g.ellipse(-15, -20, 5, 10, 0.35, 0, 7); g.ellipse(15, -20, 5, 10, -0.35, 0, 7); g.fill(); g.fillStyle = c; g.save(); g.translate(-15, -9); g.rotate(-0.7 + w); g.beginPath(); g.ellipse(0, -5, 3, 7, 0, 0, 7); g.fill(); g.restore(); }
  else if (k === 'fox') { g.fillStyle = c; g.beginPath(); g.moveTo(-14, -22); g.lineTo(-10, -43); g.lineTo(-1, -30); g.moveTo(14, -22); g.lineTo(10, -43); g.lineTo(1, -30); g.fill(); g.fillStyle = '#3F2A1E'; g.beginPath(); g.moveTo(-11.5, -37); g.lineTo(-10, -43); g.lineTo(-7, -36); g.moveTo(11.5, -37); g.lineTo(10, -43); g.lineTo(7, -36); g.fill(); g.save(); g.translate(-17, -9); g.rotate(-0.7 + w * 0.5); g.fillStyle = c; g.beginPath(); g.ellipse(-6, 0, 10, 5, 0, 0, 7); g.fill(); g.fillStyle = '#FFF8EB'; g.beginPath(); g.ellipse(-14, 0, 4, 3.5, 0, 0, 7); g.fill(); g.restore(); }
  else if (k === 'frog') { g.fillStyle = c; g.beginPath(); g.arc(-7, -30, 6, 0, 7); g.arc(7, -30, 6, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(-7, -32, 4.2, 0, 7); g.arc(7, -32, 4.2, 0, 7); g.fill(); g.fillStyle = '#2F3A2B'; g.beginPath(); g.arc(-7, -32, 2, 0, 7); g.arc(7, -32, 2, 0, 7); g.fill(); }
  else if (k === 'duck') { const a = air ? Math.sin(T * 22) * 0.9 : -0.2; g.fillStyle = c; [-1, 1].forEach((d) => { g.save(); g.translate(d * 14, -15); g.rotate(d * (0.5 + a)); g.beginPath(); g.ellipse(d * 5, 0, 8, 4, 0, 0, 7); g.fill(); g.restore(); }); g.beginPath(); g.arc(0, -32, 3, 0, 7); g.fill(); }
  else if (k === 'bear') { g.fillStyle = c; g.beginPath(); g.arc(-11, -28, 6, 0, 7); g.arc(11, -28, 6, 0, 7); g.fill(); }
  else { g.fillStyle = '#6B8F5A'; g.beginPath(); g.ellipse(-5, -35, 6, 3.5, -0.6, 0, 7); g.ellipse(6, -36, 6, 3.5, 0.6, 0, 7); g.fill(); }
}

function features(b: Body) {
  const k = b.look.kind;
  g.fillStyle = '#2F3A2B';
  if (k === 'cat' || k === 'dog' || k === 'fox' || k === 'bear') { g.beginPath(); g.ellipse(0, -11, 2.4, 1.7, 0, 0, 7); g.fill(); }
  if (k === 'cat' || k === 'fox') { g.strokeStyle = 'rgba(47,58,43,.6)'; g.lineWidth = 1; [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach((q) => { g.beginPath(); g.moveTo(q[0] * 7, -10 + q[1]); g.lineTo(q[0] * 15, -10 + q[1] * 3); g.stroke(); }); }
  if (k === 'duck') { g.fillStyle = '#F0A04B'; g.beginPath(); g.ellipse(9, -10, 7, 3.5, 0, 0, 7); g.fill(); }
  if (k === 'frog') { g.strokeStyle = '#2F3A2B'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, -12, 8, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
}

export function drawAnimal(b: Body) {
  const T = clock.T, k = b.look.kind, P = PROF[k], air = b.st === 'air';
  const cr = b.cr ? Math.min(1, (T - b.cr.t) / b.cr.d) : 0, bob = air || b.cr ? 0 : Math.sin(T * 3 + b.look.name.length) * 1.5;
  let sx = 1 + 0.25 * b.sq, sy = 1 - 0.25 * b.sq;
  if (b.cr) { const c = Math.sin(cr * 1.5708); sx = 1 + 0.3 * c; sy = 1 - 0.38 * c; }
  else if (air) { const v = Math.min(1, Math.abs(b.vy) / 1100); if (P.air === 'h') { sx = 1 + 0.22 * v; sy = 1 - 0.16 * v; } else if (P.air === 'f') { sx = 1.05; sy = 0.97; } else { sx = 1 - 0.12 * v; sy = 1 + 0.3 * v; } }
  g.save(); g.translate(b.x, b.y + bob);
  g.fillStyle = 'rgba(0,0,0,.14)'; g.beginPath(); g.ellipse(0, 1, 13 * sx, 3, 0, 0, 7); g.fill(); g.translate(0, -1);
  g.scale(b.face || 1, 1);
  if (air && P.air === 'h') { g.translate(0, -15); g.rotate(Math.max(-0.5, Math.min(0.5, b.vy / 1800))); g.translate(0, 15); }
  g.scale(sx, sy);
  if (air && (k === 'frog' || k === 'bunny')) { g.fillStyle = b.look.color; g.beginPath(); g.ellipse(-6, 3, 3.5, 6, 0, 0, 7); g.ellipse(6, 4, 3.5, 6, 0, 0, 7); g.fill(); }
  ears(b);
  g.fillStyle = b.look.color; g.beginPath(); g.ellipse(0, -15, 15, 16, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-5, -22, 4, 6, -0.5, 0, 7); g.fill();
  const bl = Math.sin(T * 0.9) > 0.97 ? 1 : 4;
  g.fillStyle = '#2F3A2B'; g.beginPath(); g.ellipse(-5, -16, 2.2, bl, 0, 0, 7); g.ellipse(5, -16, 2.2, bl, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(242,159,176,.55)'; g.beginPath(); g.ellipse(-9, -11, 3, 2, 0, 0, 7); g.ellipse(9, -11, 3, 2, 0, 0, 7); g.fill();
  features(b);
  const h = b.look.hat;
  if (h === 'acorn') { g.fillStyle = '#8B5E3C'; g.beginPath(); g.ellipse(0, -29, 12, 7, 0, Math.PI, 0); g.fill(); g.fillRect(-1.5, -39, 3, 5); }
  if (h === 'crown') { g.fillStyle = '#F29FB0'; [-8, 0, 8].forEach((x) => { g.beginPath(); g.arc(x, -30 + Math.abs(x) / 4, 3.4, 0, 7); g.fill(); }); }
  if (h === 'umbrella') { g.strokeStyle = '#3F5A3A'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -14); g.lineTo(0, -46); g.stroke(); g.fillStyle = '#9CC283'; g.beginPath(); g.ellipse(0, -46, 22, 9, 0, Math.PI, 0); g.fill(); }
  g.restore();
  g.font = '700 11px Nunito,sans-serif'; g.textAlign = 'center'; g.fillStyle = '#FFF8EB';
  g.shadowColor = 'rgba(47,58,43,.8)'; g.shadowBlur = 3; g.fillText(b.look.name, b.x, b.y - 58); g.shadowBlur = 0;
}

export function drawShield(x: number, y: number, r = 34) {
  g.strokeStyle = 'rgba(143,199,217,.9)'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
}
