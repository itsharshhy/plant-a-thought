import { $, esc, show } from '../core/util';
import { view } from '../core/canvas';
import { sfx } from '../core/audio';
import { api, knownGardens, rememberGarden, forgetGarden, hiddenTags, hideTag, gardenChannel, type Garden, type GPlant } from '../garden/api';
import { setGarden, resetGarden, setBounds, gardenFrame, gardenPointer, selectBloom, type Bloom } from '../garden/render';
import { online } from '../net/supabase';
import { allPacks, dailyPrompt, dayKey, pickPrompt, getPack } from '../data/prompts';
import { MOODS, moodEmoji } from '../data/moods';
import { entries, removeEntry, addEntry } from '../journal';
import { needsSupport } from '../safety';
import { shareLink } from '../share';
import type { Cfg } from '../data/profile';

export interface GardenCtx {
  cfg: () => Cfg;
  enter: () => void;
  leave: () => void;
  toast: (t: string) => void;
  help: () => void;
  isActive: () => boolean;
}

let ctx: GardenCtx;
let cur: Garden | null = null;
let local = false;
let question = '';
let mood: string | null = null;
let live: { ping: () => void; close: () => void } | null = null;
let poll = 0, refreshTimer = 0;
let picked: GPlant | null = null;
let pickedLocal: string | null = null;
let kind: 'friends' | 'circle' = 'friends';
let pending: { word: string; mood: string | null; prompt: string } | null = null;

const origin = () => location.origin;
export const gardenUrl = (slug: string) => `${origin()}/?g=${encodeURIComponent(slug)}`;

/** Accepts a full link, a ?g= query, or a bare slug. */
export function slugFrom(input: string): string | null {
  const t = input.trim();
  const m = /[?&]g=([A-Za-z0-9_-]{8,32})/.exec(t) || /^([A-Za-z0-9_-]{8,32})$/.exec(t);
  return m ? decodeURIComponent(m[1]) : null;
}

export function initGardens(c: GardenCtx) {
  ctx = c;
  gardenPointer(() => ctx.isActive() && $('#gsheet').classList.contains('hide') && $('#gadminp').classList.contains('hide'));
  $('#gkind').onclick = (e) => {
    const k = (e.target as HTMLElement).closest<HTMLElement>('[data-k]')?.dataset.k as 'friends' | 'circle' | undefined;
    if (!k) return;
    kind = k;
    [...$('#gkind').children].forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.k === k));
    kindText();
  };
  $('#gcreate').onclick = create;
  $('#gopen').onclick = () => { const s = slugFrom($<HTMLInputElement>('#glink').value); if (s) openGarden(s); else $('#gmsg').textContent = 'That doesn’t look like a garden link.'; };
  $('#gback').onclick = () => { show('#glist', false); ctx.leave(); };
  $('#gx').onclick = closeView;
  $('#ginvite').onclick = invite;
  $('#gplant').onclick = plant;
  $<HTMLInputElement>('#gword').onkeydown = (e) => { if (e.key === 'Enter') plant(); };
  $('#ganother').onclick = () => { if (cur) { question = pickPrompt(cur.pack, cur.lang, Math.floor(Math.random() * 2)); $('#gq').textContent = question; } };
  $('#gmoods').onclick = (e) => { const m = (e.target as HTMLElement).closest<HTMLElement>('[data-m]')?.dataset.m; if (m) { mood = mood === m ? null : m; drawMoods(); } };
  $('#gsclose').onclick = closeSheet;
  $('#gswater').onclick = water;
  $('#gsreport').onclick = report;
  $('#gshide').onclick = hidePerson;
  $('#gsdel').onclick = del;
  $('#gadmin').onclick = () => { if (cur?.is_host) { fillAdmin(); show('#gadminp'); } };
  $('#gadone').onclick = () => show('#gadminp', false);
  $('#ganext').onclick = () => cur && hostUpdate({ prompt: pickPrompt(cur.pack, cur.lang, Math.floor(Math.random() * 2)) });
  $('#gaclear').onclick = () => hostUpdate({ prompt: null });
  $('#gaset').onclick = () => { const v = $<HTMLInputElement>('#gacustom').value.trim(); if (v) { hostUpdate({ prompt: v }); $<HTMLInputElement>('#gacustom').value = ''; } };
  $<HTMLInputElement>('#gaanon').onchange = (e) => hostUpdate({ anonymous: (e.target as HTMLInputElement).checked });
  $<HTMLInputElement>('#galock').onchange = (e) => hostUpdate({ locked: (e.target as HTMLInputElement).checked });
  $('#gaclose').onclick = closeGarden;
  // Live nudges use websockets; if those are blocked (some school or office networks), polling and focus refreshes keep the garden fresh.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
}

function kindText() {
  $('#gkindtxt').textContent = kind === 'circle'
    ? 'For a class, team or group. You choose the question everyone answers, can make it anonymous, pause it, or close it. Up to 30 people.'
    : 'For friends, family or a partner. Everyone answers whatever question they like, whenever they like. Up to 30 people.';
}

/** The list of your gardens plus the "new garden" form. */
export function showGardenList(withPending?: { word: string; mood: string | null; prompt: string }) {
  if (withPending) pending = withPending;
  $('#gmsg').textContent = online ? '' : 'Shared gardens need the online version of the app.';
  ($('#gcreate') as HTMLButtonElement).disabled = !online;
  const sel = $<HTMLSelectElement>('#gpack');
  sel.innerHTML = allPacks().map((p) => `<option value="${p.id}">${p.emoji} ${esc(p.name)}</option>`).join('');
  sel.value = ctx.cfg().pack;
  kindText();
  const list = knownGardens();
  $('#gknown').innerHTML = list.length
    ? list.map((g) => `<div class="gk"><button class="open" data-s="${esc(g.slug)}">${g.kind === 'circle' ? '🎤' : '🫶'} ${esc(g.name)}${g.host ? ' <small>(host)</small>' : ''}</button><button class="tb" data-f="${esc(g.slug)}" aria-label="Forget ${esc(g.name)}">✕</button></div>`).join('')
    : '<p class="small">No gardens yet. Make one and send the link to your people.</p>';
  $('#gknown').onclick = (e) => {
    const t = e.target as HTMLElement, s = t.closest<HTMLElement>('[data-s]')?.dataset.s, f = t.closest<HTMLElement>('[data-f]')?.dataset.f;
    if (s) openGarden(s);
    if (f) { forgetGarden(f); showGardenList(); }
  };
  show('#glist');
}

async function create() {
  const name = $<HTMLInputElement>('#gname').value.trim();
  if (!name) { $('#gmsg').textContent = 'Give your garden a name first.'; return; }
  const btn = $<HTMLButtonElement>('#gcreate');
  btn.disabled = true; $('#gmsg').textContent = 'Planting your garden…';
  try {
    const pack = $<HTMLSelectElement>('#gpack').value;
    const { slug } = await api.create(name, kind, pack, ctx.cfg().lang, $<HTMLInputElement>('#ganon').checked);
    $<HTMLInputElement>('#gname').value = '';
    await openGarden(slug);
    if (cur) invite();
  } catch (e) { $('#gmsg').textContent = (e as Error).message; }
  finally { btn.disabled = false; }
}

export async function openGarden(slug: string) {
  if (!online) { showGardenList(); return; }
  $('#gmsg').textContent = 'Opening garden…';
  try {
    const g = await api.get(slug);
    local = false; cur = g; question = '';
    rememberGarden(g);
    show('#glist', false);
    ctx.enter();
    resetGarden();
    show('#gtop'); show('#gbar');
    mood = null; drawMoods();
    if (pending) { $<HTMLInputElement>('#gword').value = pending.word; mood = pending.mood; question = pending.prompt; drawMoods(); pending = null; }
    render();
    live?.close();
    gardenChannel(slug, scheduleRefresh).then((c) => { if (cur?.slug === slug) live = c; else c.close(); }).catch(() => {});
    clearInterval(poll);
    poll = window.setInterval(() => { if (!document.hidden) refresh(); }, 15000);
    $('#gmsg').textContent = '';
    history.replaceState(null, '', '/?g=' + encodeURIComponent(slug));
  } catch (e) {
    $('#gmsg').textContent = (e as Error).message;
    if ((e as Error).message.includes('doesn’t exist')) forgetGarden(slug);
    show('#glist');
  }
}

/** Your journal, drawn as a garden. Never leaves the device. */
export function openLocalGarden() {
  local = true; cur = null;
  ctx.enter();
  resetGarden();
  show('#gtop'); show('#gbar', false);
  $('#gtitle').textContent = 'Your garden';
  show('#ginvite', false); show('#gadmin', false);
  const list = entries();
  $('#gsub').textContent = `${list.length} thought${list.length === 1 ? '' : 's'} · only on this device`;
  setGarden(list.map((e) => ({ id: e.id, word: e.word, mood: e.mood, waters: 0, mine: true })), (b) => openLocalSheet(b.id));
}

function scheduleRefresh() { clearTimeout(refreshTimer); refreshTimer = window.setTimeout(refresh, 300); }

async function refresh() {
  if (!cur || local) return;
  try { cur = await api.get(cur.slug); render(); }
  catch (e) { if ((e as Error).message.includes('doesn’t exist')) { ctx.toast('This garden was closed by its host.'); forgetGarden(cur.slug); closeView(); } }
}

function render() {
  if (!cur) return;
  const g = cur;
  $('#gtitle').textContent = (g.kind === 'circle' ? '🎤 ' : '🫶 ') + g.name;
  const bits = [g.kind === 'circle' ? 'Circle' : 'Friends garden', `${g.members} ${g.members === 1 ? 'person' : 'people'}`, `${g.plants.length} thoughts`];
  if (g.anonymous) bits.push('anonymous');
  if (g.locked) bits.push('planting paused');
  $('#gsub').textContent = bits.join(' · ');
  show('#ginvite'); show('#gadmin', g.is_host);
  if (g.prompt) { question = g.prompt; $('#gq').textContent = (g.kind === 'circle' ? 'The host asks: ' : '') + g.prompt; show('#ganother', false); }
  else { if (!question) question = dailyPrompt(dayKey(), g.lang); $('#gq').textContent = question; show('#ganother'); }
  const locked = g.locked && !g.is_host;
  ($('#gplant') as HTMLButtonElement).disabled = locked;
  ($('#gword') as HTMLInputElement).disabled = locked;
  $('#gnote').textContent = locked ? 'The host has paused planting.' : g.anonymous ? 'Anonymous garden: your name is not shown or stored.' : `Planting as ${ctx.cfg().name}. Everyone with the link can read it.`;
  const hidden = hiddenTags(g.slug);
  const visible = g.plants.filter((p) => !hidden.has(p.author_tag));
  setGarden(visible.map((p) => ({ id: p.id, word: p.word, mood: p.mood, waters: p.waters, mine: p.mine })), (b: Bloom) => openSheet(b.id));
  if (picked) { picked = g.plants.find((p) => p.id === picked!.id) || null; if (picked) fillSheet(picked); else closeSheet(); }
}

/** The flower field sits between the top bar and the planting bar. Measured every frame (cheap: no layout writes). */
function bounds() {
  const top = $('#gtop').getBoundingClientRect().bottom + 12;
  const bar = $('#gbar');
  const bottom = bar.classList.contains('hide') ? view.H - 16 : bar.getBoundingClientRect().top - 8;
  setBounds(top, Math.max(top + 120, bottom));
}

export function gardenTick() {
  bounds();
  gardenFrame(ctx.cfg().theme, local ? 'Your journal is empty. Plant a thought in Calm walk and it grows here.' : 'No flowers yet. Plant the first thought.');
}

function drawMoods() {
  $('#gmoods').innerHTML = MOODS.map((m) => `<button class="hat ${m[0] === mood ? 'on' : ''}" data-m="${m[0]}" aria-pressed="${m[0] === mood}">${m[1]} ${m[2]}</button>`).join('');
}

async function plant() {
  if (!cur) return;
  const input = $<HTMLInputElement>('#gword'), word = input.value.trim();
  if (!word) { input.focus(); return; }
  const btn = $<HTMLButtonElement>('#gplant');
  btn.disabled = true;
  try {
    const q = cur.prompt || question;
    await api.plant(cur.slug, ctx.cfg().name, word, mood, q);
    addEntry({ word, mood: mood as never, note: '', prompt: q, mode: 'garden: ' + cur.name });
    sfx.plant();
    input.value = ''; mood = null; drawMoods();
    live?.ping();
    await refresh();
    if (needsSupport(word)) ctx.help();
  } catch (e) { ctx.toast((e as Error).message); }
  finally { btn.disabled = false; }
}

function openSheet(id: string) {
  picked = cur?.plants.find((p) => p.id === id) || null;
  if (!picked) return;
  fillSheet(picked);
  show('#gsheet');
}

function fillSheet(p: GPlant) {
  pickedLocal = null;
  $('#gsq').textContent = p.prompt || '';
  $('#gsw').textContent = p.word;
  const who = p.mine ? 'You' : p.name || (cur?.anonymous ? 'Someone (anonymous)' : 'Someone');
  $('#gsby').textContent = `${who}${p.mood ? ' · ' + moodEmoji(p.mood) : ''} · ${new Date(p.created_at).toLocaleDateString()}`;
  const w = $<HTMLButtonElement>('#gswater');
  show('#gswater');
  w.disabled = p.mine || p.watered;
  w.textContent = p.mine ? `💧 ${p.waters} waters` : p.watered ? `💧 Watered (${p.waters})` : `💧 Water (${p.waters})`;
  show('#gsreport', !p.mine); show('#gshide', !p.mine);
  show('#gsdel', p.mine || !!cur?.is_host);
}

function openLocalSheet(id: string) {
  const e = entries().find((x) => x.id === id);
  if (!e) return;
  picked = null; pickedLocal = id;
  $('#gsq').textContent = e.prompt;
  $('#gsw').textContent = e.word;
  $('#gsby').textContent = `${new Date(e.ts).toLocaleString()}${e.mood ? ' · ' + moodEmoji(e.mood) : ''}${e.note ? '\n' + e.note : ''}`;
  show('#gswater', false); show('#gsreport', false); show('#gshide', false); show('#gsdel');
  show('#gsheet');
}

function closeSheet() { picked = null; pickedLocal = null; selectBloom(''); show('#gsheet', false); }

async function water() {
  if (!cur || !picked) return;
  try { await api.water(cur.slug, picked.id); sfx.water(); live?.ping(); await refresh(); }
  catch (e) { ctx.toast((e as Error).message); }
}

async function report() {
  if (!cur || !picked) return;
  const reason = prompt('What’s wrong with this thought? (optional)\nThree reports hide it for everyone. A report from the host hides it straight away.');
  if (reason === null) return;
  try {
    await api.report(cur.slug, picked.id, reason);
    hideTag(cur.slug, picked.author_tag);
    ctx.toast('Thanks. Reported, and hidden for you.');
    closeSheet(); render();
  } catch (e) { ctx.toast((e as Error).message); }
}

function hidePerson() {
  if (!cur || !picked) return;
  hideTag(cur.slug, picked.author_tag);
  ctx.toast('Hidden. You won’t see their thoughts in this garden on this device.');
  closeSheet(); render();
}

async function del() {
  if (pickedLocal) {
    if (!confirm('Delete this thought from your journal?')) return;
    removeEntry(pickedLocal); closeSheet(); openLocalGarden(); return;
  }
  if (!cur || !picked) return;
  if (!confirm(picked.mine ? 'Delete your thought from this garden?' : 'Remove this thought from the garden for everyone?')) return;
  try { await api.remove(cur.slug, picked.id); live?.ping(); closeSheet(); await refresh(); }
  catch (e) { ctx.toast((e as Error).message); }
}

function fillAdmin() {
  if (!cur) return;
  $('#gacur').textContent = cur.prompt || 'Everyone picks their own question.';
  $<HTMLInputElement>('#gaanon').checked = cur.anonymous;
  $<HTMLInputElement>('#galock').checked = cur.locked;
}

async function hostUpdate(ch: { prompt?: string | null; anonymous?: boolean; locked?: boolean }) {
  if (!cur) return;
  const next = { prompt: 'prompt' in ch ? ch.prompt ?? null : cur.prompt, anonymous: ch.anonymous ?? cur.anonymous, locked: ch.locked ?? cur.locked };
  try { await api.update(cur.slug, next.prompt, next.anonymous, next.locked); live?.ping(); await refresh(); fillAdmin(); }
  catch (e) { ctx.toast((e as Error).message); }
}

async function closeGarden() {
  if (!cur) return;
  if (!confirm(`Close “${cur.name}”? Every thought in it will be erased for everyone, and the link will stop working. This can’t be undone.`)) return;
  try { await api.close(cur.slug); forgetGarden(cur.slug); show('#gadminp', false); ctx.toast('Garden closed and erased.'); closeView(); }
  catch (e) { ctx.toast((e as Error).message); }
}

async function invite() {
  if (!cur) return;
  const r = await shareLink('Plant a Thought', `Come plant thoughts with me in “${cur.name}” 🌱`, gardenUrl(cur.slug));
  if (r === 'copied') ctx.toast('Invite link copied. Paste it in WhatsApp or anywhere.');
  else if (r === 'failed') ctx.toast('Couldn’t share. Link: ' + gardenUrl(cur.slug));
}

export function closeView() {
  live?.close(); live = null;
  clearInterval(poll);
  cur = null; local = false; picked = null;
  ['#gtop', '#gbar', '#gsheet', '#gadminp'].forEach((s) => show(s, false));
  if (location.search) history.replaceState(null, '', '/');
  ctx.leave();
}

/** Refresh the pack list (e.g. after community questions load). */
export const packName = (id: string) => getPack(id).name;
