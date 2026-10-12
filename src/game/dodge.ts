import { g, view, EF, toast } from '../core/canvas';
import { clock } from '../core/clock';
import { rng } from '../core/util';
import { sfx, vib } from '../core/audio';
import { PROF, DISLIKES, makeBody, drawAnimal, drawShield, type Body } from '../draw/animal';
import { sky, PETAL } from '../draw/scenery';
import type { Kind, Look, Theme } from '../data/profile';
import { session, send, hooks } from './session';
import type { Msg } from '../net/room';

/**
 * Distances are in world units, not pixels. The screen always shows VIS units ahead of the player,
 * so an obstacle takes the same time to arrive on a 320px phone as on a 1440px monitor.
 */
export const VIS = 760;
export const TOP_SPEED = 560;
export const dist = (t: number) => (t < 53 ? 240 * t + 3 * t * t : 240 * 53 + 3 * 53 * 53 + TOP_SPEED * (t - 53));
/** Units per second at time t. */
export const speed = (t: number) => (t < 53 ? 240 + 6 * t : TOP_SPEED);
export const playerX = (W: number) => W * 0.24;
export const unit = (W: number) => (W - playerX(W)) / VIS;
/** Seconds an obstacle is visible before it reaches you at top speed (fast ones move 1.45× faster). */
export const reactionTime = (fast = false) => VIS / (TOP_SPEED * (fast ? 1.45 : 1));

const PH = 52;
const JUMP: Record<Kind, { h: number; t: number }> = { sprout: { h: 85, t: 0.65 }, bunny: { h: 80, t: 0.55 }, cat: { h: 95, t: 0.7 }, dog: { h: 80, t: 0.65 }, frog: { h: 115, t: 0.8 }, fox: { h: 90, t: 0.62 }, duck: { h: 70, t: 0.95 }, bear: { h: 65, t: 0.6 } };
const PMSG: Record<string, string> = { heart: 'Extra heart!', wings: 'Magnet: stars fly to you!', shield: 'Shield ready!', boots: 'Spring boots: hop higher and faster!' };

interface Ob { t: number; air: boolean; fast: boolean }
interface Pl { t: number; w: number }
interface Pk { t: number; y: number; kind: string }

const d = {
  theme: 'meadow' as Theme, OB: [] as Ob[], PL: [] as Pl[], PK: [] as Pk[], got: new Set<number>(), seen: new Set<string>(), hits: new Set<string>(),
  stars: 0, bonus: 0, rand: rng(1), dT: 0, over: false, hmax: 3, dLast: 2.5, me: null as unknown as Body, pb: null as Body | null,
  shake: 0, lv: 1, lvT: -9, msg: '', msgT: -9, lastHud: '',
};

export function startDodge(me: Look, partner: Look | null, theme: Theme) {
  Object.assign(d, { theme, OB: [], PL: [], PK: [], got: new Set(), seen: new Set(), hits: new Set(), stars: 0, bonus: 0, rand: rng(session.seed * 7 + 13), dT: 0, over: false, hmax: partner ? 5 : 3, dLast: 2.5, shake: 0, lv: 1, lvT: -9, msgT: -9, lastHud: '' });
  d.me = makeBody(me); d.pb = partner ? makeBody(partner) : null;
  session.lastPing = clock.T;
  hooks.missions(null);
}

export const dodgeScore = () => Math.floor(dist(d.dT) / 40) + d.stars * 10;
const ox = (o: Ob, dd: number) => (dist(o.t) - dd) * (o.fast ? 1.45 : 1);

function gen(up: number) {
  const R = d.rand;
  while (d.dLast < up) {
    const t = d.dLast, gap = Math.max(0.9, 1.8 - t * 0.012) * (0.85 + 0.5 * R());
    if (t > 8 && R() < Math.min(0.3, (t - 8) / 60)) {
      const w = 200 + R() * 100;
      d.PL.push({ t, w });
      if (R() < 0.55) d.OB.push({ t, air: false, fast: false });
      const sp = R() < 0.4 ? ['heart', 'wings', 'shield', 'boots'][Math.floor(R() * 4)] : 'star';
      for (let q = -1; q <= 1; q++) d.PK.push({ t: t + q * 0.16, y: PH + 26, kind: q === 0 ? sp : 'star' });
      d.dLast = t + w / 2 / speed(t) + gap + 0.5;
    } else {
      const air = t > 15 && R() < Math.min(0.45, (t - 15) / 80), fast = !air && t > 30 && R() < Math.min(0.4, (t - 30) / 90);
      d.OB.push({ t, air, fast });
      if (!air && R() < 0.5) d.PK.push({ t, y: 75, kind: 'star' });
      d.dLast = t + gap;
    }
  }
}

function floorAt(dd: number) {
  for (const p of d.PL) { const xc = dist(p.t) - dd; if (xc > p.w) break; if (Math.abs(xc) < p.w / 2) return PH; }
  return 0;
}

function jump(b: Body) {
  const J = JUMP[b.look.kind], bo = b.boots > clock.T, h = J.h * (bo ? 1.25 : 1) * 1.15, t = J.t * (bo ? 0.85 : 1);
  b.gv = (8 * h) / (t * t); b.vy = ((-4 * h) / t) * (b.st === 'stand' ? 1 : 0.8); b.st = 'air';
}

function stepBody(b: Body, dt: number, maxH: number) {
  const fl = floorAt(dist(d.dT));
  if (b.st === 'air') {
    const ph = b.h;
    b.vy += b.gv * dt; b.h -= b.vy * dt;
    if (b.h > maxH) { b.h = maxH; if (b.vy < 0) b.vy = 0; }
    if (b.vy > 0 && ph >= fl && b.h <= fl) { b.h = fl; b.st = 'stand'; b.vy = 0; b.sq = PROF[b.look.kind].sq * 0.8; }
  } else { if (b.h > fl) { b.st = 'air'; b.vy = 0; } b.sq = Math.max(0, b.sq - dt * 3); }
  if (b.inv > 0) b.inv -= dt;
}

/** Tap, Space or ↑. Tapping in the air flaps for a little more height. */
export function tapDodge() {
  if (d.over) return;
  const was = d.me.st;
  jump(d.me);
  if (was === 'stand') sfx.hop(PROF[d.me.look.kind]); else sfx.flap();
  vib(10); send({ t: 'dj' });
}

function take(i: number, b: Body | null, local: boolean) {
  const p = d.PK[i];
  if (!p || d.got.has(i)) return;
  d.got.add(i);
  if (p.kind === 'star') { d.stars++; sfx.coin(); }
  else {
    if (p.kind === 'heart') { if (d.hmax + d.bonus - d.hits.size < 8) d.bonus++; }
    else if (b) { const T = clock.T; if (p.kind === 'wings') b.wings = T + 10; if (p.kind === 'shield') b.shield = 1; if (p.kind === 'boots') b.boots = T + 10; }
    if (local) { d.msg = PMSG[p.kind]; d.msgT = clock.T; }
    sfx.power();
  }
  if (local) send({ t: 'pk', i });
}

function check(U: number) {
  const dd = dist(d.dT), b = d.me, T = clock.T;
  for (let i = 0; i < d.PK.length; i++) {
    if (d.got.has(i)) continue;
    const p = d.PK[i], dx = (dist(p.t) - dd) * U, R = b.wings > T ? 130 : 26;
    if (Math.abs(dx) < R && Math.abs(p.y - (18 + b.h)) < R + 6) take(i, b, true);
  }
  if (b.inv > 0) return;
  for (let k = 0; k < d.OB.length; k++) {
    const o = d.OB[k], dx = ox(o, dd) * U;
    if (Math.abs(dx) > 60) continue;
    const key = k + ':' + session.slot;
    if (d.seen.has(key)) continue;
    if (o.air ? Math.hypot(dx, 18 + b.h - 72) < 28 : Math.hypot(dx, 2 + b.h) < 28) {
      d.seen.add(key);
      if (b.shield) { b.shield = 0; b.inv = 0.8; send({ t: 'hit', k, sh: 1 }); sfx.pop(); return; }
      d.hits.add(key); b.inv = 1.3; d.shake = 0.25; send({ t: 'hit', k }); sfx.hit(); return;
    }
  }
}

function endDodge() {
  d.over = true; sfx.over();
  const m = dodgeScore();
  let best = 0;
  try { best = +(localStorage.getItem('pat-best') || 0); if (m > best) { best = m; localStorage.setItem('pat-best', String(best)); } } catch { best = Math.max(best, m); }
  hooks.gameOver({ title: 'Nice hopping!', text: `Score ${m} (${d.stars} stars). Best: ${best}.` });
}

function lane(b: Body, gy: number, U: number) {
  const { W } = view, T = clock.T, dd = dist(d.dT), sk = DISLIKES[b.look.kind], X = playerX(W), px = dd * U;
  g.fillStyle = 'rgba(107,143,90,.35)'; g.beginPath(); g.moveTo(0, gy);
  for (let x = 0; x <= W + 20; x += 20) g.lineTo(x, gy - 34 - Math.sin((x + px * 0.1) / 90) * 20);
  g.lineTo(W, gy); g.fill();
  g.fillStyle = '#6B8F5A'; g.fillRect(0, gy, W, 10);
  const gr = g.createLinearGradient(0, gy + 10, 0, gy + 46); gr.addColorStop(0, '#8C867E'); gr.addColorStop(1, '#5E5A57'); g.fillStyle = gr; g.fillRect(0, gy + 10, W, 36);
  for (let i = 0; i < W / 55 + 2; i++) { const x = (((i * 55 - px) % (W + 110)) + W + 110) % (W + 110) - 40; g.fillStyle = '#9CC283'; g.beginPath(); g.ellipse(x, gy, 9, 5, 0, Math.PI, 0); g.fill(); if (i % 3 === 0) { g.fillStyle = PETAL[i % PETAL.length]; g.beginPath(); g.arc(x + 4, gy - 8, 3, 0, 7); g.fill(); } }
  for (const p of d.PL) {
    const xc = X + (dist(p.t) - dd) * U, w = p.w * U;
    if (xc < -w || xc > W + w) continue;
    g.fillStyle = 'rgba(0,0,0,.1)'; g.beginPath(); g.ellipse(xc, gy + 2, w / 2, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#8C867E'; g.beginPath(); if (g.roundRect) g.roundRect(xc - w / 2, gy - PH, w, 14, 6); else g.rect(xc - w / 2, gy - PH, w, 14); g.fill();
    g.fillStyle = '#6B8F5A'; g.fillRect(xc - w / 2, gy - PH, w, 5);
  }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < d.OB.length; i++) {
    const o = d.OB[i], x = X + ox(o, dd) * U;
    if (x < -40 || x > W + 60) continue;
    const set = o.air ? sk.a : sk.g;
    g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.ellipse(x, gy + 2, 16, 4, 0, 0, 7); g.fill();
    if (o.fast) { g.strokeStyle = 'rgba(255,248,235,.7)'; g.lineWidth = 2; for (let q = 0; q < 3; q++) { g.beginPath(); g.moveTo(x + 20, gy - 8 - q * 8); g.lineTo(x + 40 + q * 6, gy - 8 - q * 8); g.stroke(); } }
    g.font = EF(32); g.fillText(set[i % set.length], x, o.air ? gy - 72 + Math.sin(T * 4 + i) * 5 : gy - 16);
  }
  for (let i = 0; i < d.PK.length; i++) {
    if (d.got.has(i)) continue;
    const q = d.PK[i], x = X + (dist(q.t) - dd) * U;
    if (x < -30 || x > W + 30) continue;
    const y = gy - q.y + Math.sin(T * 4 + i) * 3;
    if (q.kind !== 'star') { const r = g.createRadialGradient(x, y, 2, x, y, 26); r.addColorStop(0, 'rgba(255,230,150,.7)'); r.addColorStop(1, 'rgba(255,230,150,0)'); g.fillStyle = r; g.beginPath(); g.arc(x, y, 26, 0, 7); g.fill(); }
    g.font = EF(q.kind === 'star' ? 22 : 30); g.fillText(({ star: '⭐', heart: '❤️', wings: '🧲', shield: '🛡️', boots: '⚡' } as Record<string, string>)[q.kind], x, y);
  }
  g.textBaseline = 'alphabetic';
  g.save(); g.translate(X, gy); g.scale(1.25, 1.25); g.translate(-X, -gy);
  if (b.inv > 0 && Math.floor(T * 14) % 2) g.globalAlpha = 0.4;
  b.x = X; b.y = gy - b.h / 1.25; drawAnimal(b); g.restore();
  if (b.shield) drawShield(X, gy - b.h - 22, 32);
  if (b.wings > T) { g.font = EF(22); g.textAlign = 'center'; g.fillText('🧲', X, gy - b.h - 64); }
}

/** Lane ground lines. Two lanes in 2-player; the top lane always sits clear of the HUD. */
export function laneLayout(H: number, hudBottom: number, twoPlayer: boolean) {
  if (!twoPlayer) { const gy = H * 0.78; return { mine: gy, theirs: 0, maxMine: Math.min(H * 0.5, gy - hudBottom - 80), maxTheirs: 0 }; }
  const top = Math.max(H * 0.42, hudBottom + 150), bottom = Math.max(H * 0.84, top + 140);
  return { mine: bottom, theirs: top, maxMine: bottom - top - 110, maxTheirs: top - hudBottom - 80 };
}

export function dodgeFrame(dt: number) {
  const { W, H, hudBottom } = view, T = clock.T, U = unit(W), L = laneLayout(H, hudBottom, !!d.pb);
  if (!d.over) { d.dT += dt; gen(d.dT + 4); }
  stepBody(d.me, dt, L.maxMine); if (d.pb) stepBody(d.pb, dt, L.maxTheirs);
  if (!d.over) check(U);
  const hearts = Math.max(0, d.hmax + d.bonus - d.hits.size);
  if (hearts <= 0 && !d.over) endDodge();
  const sh = d.shake > 0 ? (Math.random() - 0.5) * d.shake * 40 : 0;
  d.shake = Math.max(0, d.shake - dt);
  g.save(); g.translate(sh, 0);
  sky(d.theme, (d.dT * 0.4) / 36, 0);
  if (d.pb) lane(d.pb, L.theirs, U);
  lane(d.me, L.mine, U);
  g.restore();
  const lv = 1 + Math.floor(d.dT / 15);
  if (lv !== d.lv && !d.over) { d.lv = lv; d.lvT = T; sfx.level(); }
  if (T - d.lvT < 1.6) toast('Level ' + d.lv + ': faster!', 24, 0.2);
  else if (T - d.msgT < 1.8) toast(d.msg, 24, 0.2);
  else if (d.dT < 3 && !d.over) toast('Tap to hop. Tap more to fly!', 22, 0.2);
  let pw = '';
  if (d.me.wings > T) pw += ' 🧲' + Math.ceil(d.me.wings - T);
  if (d.me.boots > T) pw += ' ⚡' + Math.ceil(d.me.boots - T);
  if (d.me.shield) pw += ' 🛡️';
  if (pw) { g.textAlign = 'left'; g.font = EF(20); g.fillText(pw, 12, hudBottom + 28); }
  const stats = '❤️'.repeat(hearts) + '🖤'.repeat(Math.max(0, d.hmax - hearts)) + ' ' + Math.floor(dist(d.dT) / 40) + 'm ⭐' + d.stars + ' Lv' + lv;
  if (stats !== d.lastHud) { d.lastHud = stats; hooks.hud(stats); }
}

export function dodgeMsg(m: Msg) {
  const pb = d.pb;
  if (m.t === 'dj' && pb) jump(pb);
  else if (m.t === 'hit') { if (m.sh) { if (pb) { pb.shield = 0; pb.inv = 0.8; } } else { d.hits.add(String(m.k) + ':' + String(m.p)); if (pb) pb.inv = 1.3; } }
  else if (m.t === 'pk' && typeof m.i === 'number') take(m.i, pb, false);
}
