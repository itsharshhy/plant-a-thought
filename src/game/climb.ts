import { g, view, sc, EF, toast } from '../core/canvas';
import { clock } from '../core/clock';
import { clamp, hash, rng } from '../core/util';
import { sfx } from '../core/audio';
import { PROF, DISLIKES, makeBody, drawAnimal, drawShield, type Body } from '../draw/animal';
import { sky, mountains, island, flower, burst, crittersTick, drawCritters, critterCount, clearCritters, puff, trail, partsTick, drawParts, clearParts } from '../draw/scenery';
import { depthFor } from '../data/prompts';
import type { Look, Theme } from '../data/profile';
import { session, send, hooks } from './session';
import type { Msg } from '../net/room';

/**
 * calm:  the default. No crumbling, no hearts, no score. A question every 5 islands.
 * climb: the challenge. Islands crumble, flyers hurt, combos and missions. A question every 10 islands.
 * daily: calm, on today's shared layout, starting with today's question, finishing at island 15.
 */
export type Variant = 'calm' | 'climb' | 'daily';

export const GAP = 190;
export const DAILY_END = 15;
/**
 * Island centres (including movement) stay within this distance of the centre line. With the widest island (96)
 * the whole column spans ±216 world units, which fits the narrowest phone (320px shows ±229), so nothing is ever cut off.
 */
export const MAX_REACH = 120;
export const MAX_HALF_WIDTH = 96;

export interface Isl { x: number; bx: number; hw: number; y: number; r: number; m: number; sp: number; ph: number; dx: number }
interface Plant { w: string; s: number; j: number; mood: string | null; auto: boolean; seed: number; t0: number }
interface Haz { sp: number; ph: number; A: number; e: string }

export const promptEvery = (v: Variant) => (v === 'climb' ? 10 : 5);

/** Pure island generator, so layouts are identical for both players and testable. */
export function genIsland(seed: number, k: number, prevBx: number, every: number): Isl {
  const r = rng(seed + k * 977);
  const step = r(), hw = k ? 62 + r() * 34 : 90, rr = r(), mv = r();
  const m = k >= 6 && k % every !== 0 && mv < 0.3 ? 24 + r() * 26 : 0;
  const lim = MAX_REACH - m;
  const x = k ? clamp(prevBx + (step - 0.5) * 300, -lim, lim) : 0;
  return { x, bx: x, hw, y: -k * GAP, r: rr, m, sp: 0.8 + r() * 0.7, ph: r() * 6.28, dx: 0 };
}

const s = {
  variant: 'calm' as Variant, theme: 'meadow' as Theme, isl: [] as Isl[], me: makeBody({ name: 'Pip', color: '#9CC283', hat: 'none', kind: 'sprout' }),
  pb: null as Body | null, E: new Map<string, Plant>(), cam: 0, camX: 0, lives: 3, lMax: 3, ff: 0, ffGot: new Set<number>(), over: false, typing: false,
  combo: 0, lastLand: -9, lastIsl: -1, score: 0, maxCombo: 0, boostT: 0, puGot: new Set<number>(), hz: new Map<number, Haz | null>(),
  hintH: false, missions: [] as { t: string; f: () => boolean; d: boolean }[], msg: '', msgT: -9, thoughts: 0, lastTick: 0, lastHud: '',
};

const every = () => promptEvery(s.variant);
const challenge = () => s.variant === 'climb';

export function I(i: number): Isl {
  while (s.isl.length <= i) { const k = s.isl.length; s.isl.push(genIsland(session.seed, k, k ? s.isl[k - 1].bx : 0, every())); }
  return s.isl[i];
}

const crumbleTime = (j: number) => (j < 3 || !challenge() ? 9999 : Math.max(1.6, 4.5 - j * 0.04));
const hasFF = (j: number) => j > 0 && rng(session.seed + j * 31)() > 0.55;
const isPromptIsland = (j: number) => j % every() === 0 && (s.variant !== 'daily' || j <= DAILY_END);
const PUK = ['heart', 'shield', 'balloon', 'boost'] as const;
const PUE: Record<string, string> = { heart: '❤️', shield: '🛡️', balloon: '🎈', boost: '⚡' };
function puInfo(j: number): string | null {
  if (j < 4 || isPromptIsland(j)) return null;
  const r = rng(session.seed + j * 41);
  if (r() >= 0.14) return null;
  const p = PUK[Math.floor(r() * 4)];
  return challenge() || p === 'balloon' ? p : null;
}
const padOn = (j: number) => j >= 6 && !isPromptIsland(j) && !isPromptIsland(j + 1) && rng(session.seed + j * 67)() < 0.1;
function hzInfo(j: number): Haz | null {
  if (!challenge() || j < 5 || isPromptIsland(j) || isPromptIsland(j + 1)) return null;
  let h = s.hz.get(j);
  if (h === undefined) { const r = rng(session.seed + j * 71); h = r() < 0.22 ? { sp: 0.7 + r() * 0.5, ph: r() * 6.28, A: 130 + r() * 40, e: DISLIKES[s.me.look.kind].a[Math.floor(r() * 2)] } : null; s.hz.set(j, h); }
  return h;
}

const MT: [string, () => boolean][] = [
  ['Reach island 30', () => s.me.isl >= 30], ['Reach island 60', () => s.me.isl >= 60], ['Collect 15 fireflies', () => s.ff >= 15],
  ['Get a x4 combo', () => s.maxCombo >= 4], ['Score 1500', () => s.score >= 1500], ['Answer 2 questions', () => s.thoughts >= 2],
];

function say(m: string) { s.msg = m; s.msgT = clock.T; }

export function startClimb(variant: Variant, me: Look, partner: Look | null, theme: Theme) {
  const T = clock.T;
  Object.assign(s, {
    variant, theme, isl: [], E: new Map(), cam: 0, camX: 0, lMax: partner ? 5 : 3, ff: 0, ffGot: new Set(), over: false, typing: false,
    combo: 0, lastLand: -9, lastIsl: -1, score: 0, maxCombo: 0, boostT: 0, puGot: new Set(), hz: new Map(), hintH: false, msgT: -9, thoughts: 0, lastHud: '',
  });
  s.lives = s.lMax;
  if (challenge()) {
    const a = MT.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    s.missions = a.slice(0, 3).map((m) => ({ t: m[0], f: m[1], d: false }));
  } else s.missions = [];
  hooks.missions(challenge() ? s.missions : null);
  clearCritters(); clearParts();
  const off = (sl: number) => (sl === 1 ? -34 : 34);
  s.me = makeBody(me, I(0).x + off(session.slot));
  s.pb = partner ? makeBody(partner, I(0).x + off(3 - session.slot)) : null;
  session.lastPing = T;
  land(s.me);
}

export const climbTheme = (t: Theme) => { s.theme = t; };
export const isTyping = () => s.typing;

/** Called by the UI when the player submits a thought (or skips with an empty word). */
export function submitThought(word: string, mood: string | null, shareWithPartner: boolean) {
  const j = s.me.isl, sl = session.slot;
  const w = word.trim();
  plant(j, sl, w || ' ', mood, !w);
  if (w) { s.thoughts++; sfx.plant(); burst(s.me.x, s.me.y, 6); }
  send({ t: 'word', island: j, word: shareWithPartner ? w : '', mood: shareWithPartner ? mood : null });
  s.typing = false;
  if (s.variant === 'daily' && j >= DAILY_END) { finishDaily(); return; }
  say('Tap to hop on!');
  missionTick();
}

function finishDaily() {
  s.over = true;
  sfx.level();
  const mine = [...s.E.values()].filter((e) => e.s === session.slot && !e.auto);
  hooks.gameOver({ title: 'Today’s garden is planted 🌼', text: `${mine.length} thoughts across ${s.me.isl} islands. Come back tomorrow for a new question.`, share: { thoughts: mine.length, islands: s.me.isl, moods: mine.map((e) => e.mood) } });
}

function plant(j: number, sl: number, w: string, mood: string | null, auto: boolean) {
  const key = j + ':' + sl;
  if (s.E.has(key)) return;
  s.E.set(key, { w, s: sl, j, mood, auto, seed: hash(w.toLowerCase() + j + sl), t0: clock.T });
}

function land(b: Body) {
  if (b !== s.me) return;
  const T = clock.T, j = b.isl, key = j + ':' + session.slot;
  b.ct = j >= 3 && challenge() ? T + crumbleTime(j) : 0;
  if (isPromptIsland(j)) {
    if (!s.E.has(key)) { s.typing = true; hooks.openPrompt({ depth: depthFor(s.thoughts), daily: s.variant === 'daily' && j === 0, shared: !!s.pb }); }
  } else if (!s.E.has(key)) plant(j, session.slot, ' ', null, true);
  if (hasFF(j) && !s.ffGot.has(j)) {
    s.ffGot.add(j); s.ff++; sfx.coin();
    if (challenge() && s.ff % 8 === 0 && s.lives < 8) { s.lives++; send({ t: 'heal' }); say('Extra heart!'); sfx.power(); }
  }
  if (j === 3 && challenge()) say('Careful: islands crumble! Keep hopping!');
  afterLand(j);
  send({ t: 'land', island: j });
}

function afterLand(j: number) {
  const T = clock.T, b = s.me;
  puff(b.x, b.y, 10, '#CFE5B4');
  if (challenge() && j > s.lastIsl) {
    s.combo = T - s.lastLand < 2.4 && s.lastIsl >= 0 ? Math.min(5, s.combo + 1) : 1;
    s.score += 10 * s.combo * (s.boostT > T ? 2 : 1) + (j % 5 === 0 ? 25 : 0);
    s.maxCombo = Math.max(s.maxCombo, s.combo);
    if (s.combo >= 3) { say('Combo x' + s.combo + '!'); sfx.coin(); }
  }
  if (j > s.lastIsl) s.lastIsl = j;
  s.lastLand = T;
  const pu = puInfo(j);
  let auto = false;
  if (pu && !s.puGot.has(j)) {
    s.puGot.add(j);
    if (pu === 'heart') { if (s.lives < 8) { s.lives++; send({ t: 'heal' }); } say('Extra heart!'); }
    else if (pu === 'shield') { b.shield = 1; say('Shield ready!'); }
    else if (pu === 'boost') { s.boostT = T + 15; say('Score x2 for 15 seconds!'); }
    else { say('Balloon! Up we go!'); auto = true; setTimeout(() => { if (b.st === 'stand' && b.isl === j && !s.typing) launch(Math.min(5, nextPromptGap(j)), 2.2); }, 200); }
    sfx.power();
  } else if (!pu && padOn(j)) {
    auto = true; say('Spring pad!'); sfx.pop();
    setTimeout(() => { if (b.st === 'stand' && b.isl === j && !s.typing) launch(Math.min(3, nextPromptGap(j)), 1.5); }, 150);
  }
  if (!auto && b.buf && T - b.buf < 0.35) { b.buf = 0; setTimeout(hop, 40); }
  missionTick();
}

/** Never let a pad or balloon skip a question island. */
function nextPromptGap(j: number) { let n = 1; while (n < 6 && !isPromptIsland(j + n)) n++; return n; }

function missionTick() {
  s.missions.forEach((m) => { if (!m.d && m.f()) { m.d = true; say('Mission done: ' + m.t); sfx.level(); hooks.missions(s.missions); } });
}

function hop() {
  const b = s.me;
  if (b.st !== 'stand' || b.cr || s.typing || s.over) return;
  const P = PROF[b.look.kind];
  b.cr = { t: clock.T, d: P.pre * 0.6 };
  setTimeout(() => { b.cr = null; if (b !== s.me || b.st !== 'stand' || s.typing || s.over) return; launch(1, P.tf); }, P.pre * 600);
}

function launch(n: number, tf: number) {
  const b = s.me, T = clock.T, t = I(b.isl + n), gv = b.gv;
  const pt = t.m ? t.bx + t.m * Math.sin((T + tf) * t.sp + t.ph) : t.x;
  const x1 = pt + (session.slot === 1 ? -0.25 : 0.25) * t.hw, vx = (x1 - b.x) / tf, vy = (t.y - b.y - (gv / 2) * tf * tf) / tf;
  Object.assign(b, { vx, vy, st: 'air', face: vx < 0 ? -1 : 1, gv });
  puff(b.x, b.y, 8, '#FFF8EB'); burst(b.x, b.y); sfx.hop(PROF[b.look.kind]);
  send({ t: 'jump', x: b.x, y: b.y, vx, vy, isl: b.isl });
}

/** Tap or Space. While in the air the tap is remembered and used on landing. */
export function tapClimb() {
  if (s.typing || s.over) return;
  if (s.me.st === 'air') { s.me.buf = clock.T; return; }
  hop();
}

function step(b: Body, dt: number) {
  if (b.st !== 'air') { b.sq = Math.max(0, b.sq - dt * 3); return; }
  const py = b.y;
  b.vy += (b.gv || 1400) * dt; b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.vy > 0 && !b.fall) {
    for (let j = Math.max(0, b.isl - 1); j <= b.isl + 6; j++) {
      const t = I(j);
      if (py <= t.y + 1 && b.y >= t.y && Math.abs(b.x - t.x) <= t.hw) { Object.assign(b, { y: t.y, st: 'stand', isl: j, vx: 0, vy: 0, sq: PROF[b.look.kind].sq }); land(b); return; }
    }
  }
  if (b.y > I(b.isl).y + 380) { const t = I(b.isl); Object.assign(b, { x: t.x, y: t.y - 130, vx: 0, vy: 0, fall: 0 }); }
}

function hurt() {
  s.lives = Math.max(0, s.lives - 1); s.me.sq = 1.3; sfx.hit(); say('Ouch!'); send({ t: 'hurt' });
  if (s.lives <= 0) endClimb();
}

function crumbleTick(dt: number) {
  const b = s.me, T = clock.T;
  if (s.over || !b.ct) return;
  if (s.typing) { b.ct += dt; return; }
  if (b.st !== 'stand') return;
  if (T > b.ct) {
    b.ct = 0; b.cr = null; Object.assign(b, { st: 'air', vy: 0, vx: 0, fall: 1 });
    s.lives = Math.max(0, s.lives - 1); sfx.hit(); send({ t: 'fall' });
    if (s.lives <= 0) endClimb();
  } else if (b.ct - T < 1.5) { const q = Math.floor(T * 6); if (q !== s.lastTick) { s.lastTick = q; sfx.tick(); } }
}

function hazTick() {
  const b = s.me, T = clock.T;
  if (s.over || s.typing) return;
  if (!s.hintH && b.st === 'stand' && hzInfo(b.isl + 1)) { s.hintH = true; say('Time your hop: dodge the flyer!'); }
  if (b.st !== 'air' || b.inv > 0) return;
  for (let j = Math.max(1, b.isl); j <= b.isl + 6; j++) {
    const h = hzInfo(j);
    if (!h) continue;
    const hx = h.A * Math.sin(T * h.sp + h.ph), hy = -(j + 0.5) * GAP;
    if (Math.hypot(b.x - hx, b.y - 18 - hy) < 26) {
      if (b.shield) { b.shield = 0; b.inv = 0.8; sfx.pop(); say('Shield blocked it!'); } else { b.inv = 1.3; hurt(); }
      return;
    }
  }
}

function endClimb() {
  if (s.over) return;
  s.over = true; sfx.over();
  let best = 0;
  try { best = +(localStorage.getItem('pat-best-climb') || 0); if (s.score > best) { best = s.score; localStorage.setItem('pat-best-climb', String(best)); } } catch { best = Math.max(best, s.score); }
  const top = Math.max(s.me.isl, s.pb ? s.pb.isl : 0);
  hooks.gameOver({ title: 'Great climb! 🌙', text: `Island ${top} · score ${s.score} · best ${best} · missions ${s.missions.filter((m) => m.d).length}/3 · ${s.thoughts} thoughts.` });
}

function movers() {
  const T = clock.T, mx = Math.max(s.me.isl, s.pb ? s.pb.isl : 0) + 8;
  for (let j = Math.max(0, s.me.isl - 5); j <= mx; j++) {
    const t = I(j);
    if (t.m) { const nx = t.bx + t.m * Math.sin(T * t.sp + t.ph); t.dx = nx - t.x; t.x = nx; } else t.dx = 0;
  }
  if (s.me.st === 'stand') s.me.x += I(s.me.isl).dx || 0;
  if (s.pb && s.pb.st === 'stand') s.pb.x += I(s.pb.isl).dx || 0;
}

/** Horizontal camera target: the centre of the island column, nudged only if that would ever leave you off screen. */
export function cameraTarget(me: { x: number }, k: number, W: number): number {
  const half = W / 2 / k - 40;
  return clamp(0, me.x - half, me.x + half);
}

export function climbFrame(dt: number) {
  const T = clock.T, { W, H } = view, me = s.me, pb = s.pb;
  step(me, dt); if (pb) step(pb, dt);
  movers(); crumbleTick(dt); hazTick(); partsTick(dt); crittersTick(dt);
  if (me.inv > 0) me.inv -= dt;
  if (me.st === 'air' && Math.random() < 0.7) trail(me.x, me.y - 14);
  if (s.E.size && critterCount() < 14 && Math.random() < dt * 0.3) burst(me.x, me.y, 1);

  const k = sc(), my = pb ? (me.y + pb.y) / 2 : me.y;
  s.cam += (H * 0.62 - my * k - s.cam) * Math.min(1, dt * 3);
  s.camX += (cameraTarget(me, k, W) - s.camX) * Math.min(1, dt * 4);
  s.camX = clamp(s.camX, me.x - (W / 2 / k - 30), me.x + (W / 2 / k - 30));

  sky(s.theme, me.isl / 90, s.cam); mountains(s.cam);
  g.save(); g.translate(W / 2 - s.camX * k, s.cam); g.scale(k, k);
  drawCritters(true);
  const mx = Math.max(me.isl, pb ? pb.isl : 0);
  for (let i = Math.max(0, Math.min(me.isl, pb ? pb.isl : me.isl) - 4); i <= mx + 6; i++) {
    const t = I(i), sy = s.cam + t.y * k;
    if (sy < -160 || sy > H + 220) continue;
    drawIsland(t, i); drawExtras(t, i);
  }
  s.E.forEach((e) => {
    const t = I(e.j), sy = s.cam + t.y * k;
    if (sy < -200 || sy > H + 260) return;
    const fx = t.x + (e.s === 1 ? -1 : 1) * (t.hw * 0.2 + rng(e.seed)() * t.hw * 0.35);
    flower(fx, t.y, { seed: e.seed, word: e.w, mood: e.mood, size: e.auto ? 0.8 : isPromptIsland(e.j) ? 1.8 : 1, age: T - e.t0, label: !e.auto });
  });
  drawCritters(false);
  if (pb) {
    const d = Math.hypot(me.x - pb.x, me.y - pb.y), tight = d > 2 * GAP;
    g.strokeStyle = tight ? '#FFD27A' : 'rgba(63,90,58,.75)'; g.lineWidth = tight ? 3 : 2;
    g.beginPath(); g.moveTo(me.x, me.y - 16); g.quadraticCurveTo((me.x + pb.x) / 2, Math.max(me.y, pb.y) + Math.min(60, d * 0.2), pb.x, pb.y - 16); g.stroke();
    drawAnimal(pb);
  }
  g.save(); if (me.inv > 0 && Math.floor(T * 14) % 2) g.globalAlpha = 0.4; drawAnimal(me); g.restore();
  if (me.shield) drawShield(me.x, me.y - 24);
  drawParts();
  g.restore();

  if (T - s.msgT < 2.2) toast(s.msg, 22, 0.2);
  const toNext = every() - (me.isl % every());
  const stats = challenge()
    ? `${s.lives > 5 ? '❤️×' + s.lives : '❤️'.repeat(s.lives) + '🖤'.repeat(Math.max(0, s.lMax - s.lives))} ⛰️${me.isl} ⭐${s.score}${s.combo > 1 ? ' x' + s.combo : ''} 💭${toNext}`
    : `🌸${s.thoughts} ⛰️${me.isl}${s.variant === 'daily' ? '/' + DAILY_END : ''} ✨${s.ff} 💭${toNext}`;
  if (stats !== s.lastHud) { s.lastHud = stats; hooks.hud(stats); }
}

function drawIsland(t: Isl, i: number) {
  const T = clock.T, me = s.me, pb = s.pb;
  const near = (b: Body | null) => !!b && b.isl === i && !!b.ct && b.st === 'stand' && b.ct - T < 1.5 && b.ct > T;
  const shake = near(me) ? (1.5 - (me.ct! - T)) * 4 : near(pb) ? (1.5 - (pb!.ct! - T)) * 4 : 0;
  g.save();
  if (shake) g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake * 0.5);
  island(t);
  if (shake) { g.strokeStyle = 'rgba(47,58,43,.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(t.x - t.hw * 0.3, t.y + 4); g.lineTo(t.x - t.hw * 0.1, t.y + 22); g.lineTo(t.x + t.hw * 0.1, t.y + 14); g.lineTo(t.x + t.hw * 0.3, t.y + 34); g.stroke(); }
  g.restore();
  if (isPromptIsland(i) && !s.E.has(i + ':' + session.slot)) { g.font = EF(26); g.textAlign = 'center'; g.fillText('💭', t.x, t.y - 70 + Math.sin(T * 2 + i) * 4); }
  if (hasFF(i) && !s.ffGot.has(i)) {
    const x = t.x + Math.sin(T * 1.3 + i) * t.hw * 0.5, y = t.y - 46 + Math.sin(T * 2 + i) * 6, r = g.createRadialGradient(x, y, 0, x, y, 18);
    r.addColorStop(0, 'rgba(255,240,150,.95)'); r.addColorStop(1, 'rgba(255,240,150,0)'); g.fillStyle = r; g.beginPath(); g.arc(x, y, 18, 0, 7); g.fill();
  }
}

function drawExtras(t: Isl, i: number) {
  const T = clock.T;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (padOn(i)) { g.font = EF(34); g.fillText('🍄', t.x, t.y - 18 + Math.sin(T * 6 + i) * 2); }
  const pu = puInfo(i);
  if (pu && !s.puGot.has(i)) { g.font = EF(28); g.fillText(PUE[pu], t.x + t.hw * 0.35, t.y - 42 + Math.sin(T * 3 + i) * 5); }
  const hz = hzInfo(i);
  if (hz) {
    const hx = hz.A * Math.sin(T * hz.sp + hz.ph), hy = -(i + 0.5) * GAP;
    g.save(); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 2; g.setLineDash([4, 8]); g.beginPath(); g.moveTo(-hz.A, hy); g.lineTo(hz.A, hy); g.stroke(); g.restore();
    g.font = EF(30); g.fillText(hz.e, hx, hy);
  }
  g.textBaseline = 'alphabetic';
}

/** Messages from the other player. */
export function climbMsg(m: Msg) {
  const pb = s.pb, T = clock.T;
  if (!pb) return;
  const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);
  if (m.t === 'jump') { Object.assign(pb, { x: num(m.x), y: num(m.y), vx: num(m.vx), vy: num(m.vy), isl: Math.max(0, Math.floor(num(m.isl))), st: 'air', face: num(m.vx) < 0 ? -1 : 1 }); burst(pb.x, pb.y); sfx.hop(PROF[pb.look.kind]); }
  else if (m.t === 'land') { const j = Math.max(0, Math.floor(num(m.island))); Object.assign(pb, { isl: j, st: 'stand', vx: 0, vy: 0, y: I(j).y, fall: 0, ct: j >= 3 && challenge() ? T + crumbleTime(j) : 0 }); if (!isPromptIsland(j)) plant(j, 3 - session.slot, ' ', null, true); }
  else if (m.t === 'word') { const w = typeof m.word === 'string' ? m.word.slice(0, 280) : ''; plant(Math.max(0, Math.floor(num(m.island))), 3 - session.slot, w || ' ', typeof m.mood === 'string' ? m.mood : null, !w); }
  else if (!challenge()) return;
  else if (m.t === 'hurt') { s.lives = Math.max(0, s.lives - 1); if (s.lives <= 0) endClimb(); }
  else if (m.t === 'fall') { s.lives = Math.max(0, s.lives - 1); Object.assign(pb, { st: 'air', vy: 0, vx: 0, fall: 1, ct: 0 }); if (s.lives <= 0) endClimb(); }
  else if (m.t === 'heal') s.lives = Math.min(8, s.lives + 1);
}

/** Screen position of your animal, for tests and accessibility checks. */
export function playerOnScreen() {
  const k = sc();
  return { x: view.W / 2 + (s.me.x - s.camX) * k, y: s.cam + s.me.y * k, island: s.me.isl };
}

/** Leftmost and rightmost screen x of every island currently on screen (moving ones at their extremes). */
export function islandsOnScreen() {
  const k = sc(), toX = (x: number) => view.W / 2 + (x - s.camX) * k;
  let left = Infinity, right = -Infinity;
  for (let i = Math.max(0, s.me.isl - 2); i <= s.me.isl + 4; i++) {
    const t = I(i), sy = s.cam + t.y * k;
    if (sy < 0 || sy > view.H) continue;
    left = Math.min(left, toX(t.bx - t.m - t.hw));
    right = Math.max(right, toX(t.bx + t.m + t.hw));
  }
  return { left, right };
}

