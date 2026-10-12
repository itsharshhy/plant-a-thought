import '@fontsource/nunito/500.css';
import '@fontsource/nunito/700.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/caveat/600.css';
import './styles.css';

import { $, esc, show } from './core/util';
import { cv, view, measureHud, resize } from './core/canvas';
import { clock } from './core/clock';
import { audio, setMuted, moodMusic } from './core/audio';
import { load, save } from './core/store';
import { loadCfg, saveCfg, lookOf, cleanLook, cleanName, COLS, HATS, KINDS, KE, THEMES, THEME_SWATCH, type Cfg, type Look } from './data/profile';
import { MOODS, moodEmoji, isMood } from './data/moods';
import { allPacks, community, dailyPrompt, dailySeed, dayKey, pickPrompt, PACKS } from './data/prompts';
import { sky } from './draw/scenery';
import { session, send, hooks, type PromptRequest, type OverInfo } from './game/session';
import { startClimb, climbFrame, climbMsg, tapClimb, submitThought, climbTheme, playerOnScreen, islandsOnScreen, type Variant } from './game/climb';
import { drawnCount } from './garden/render';
import { startDodge, dodgeFrame, dodgeMsg, tapDodge, unit, reactionTime } from './game/dodge';
import { openRoom, genCode, normalizeCode, type Msg } from './net/room';
import { online } from './net/supabase';
import { entries, addEntry, removeEntry, clearJournal, streak, exportText } from './journal';
import { needsSupport, HELPLINES } from './safety';
import { shareLink, shareDaily } from './share';
import { initGardens, showGardenList, openGarden, openLocalGarden, gardenTick, slugFrom } from './ui/gardens';
import { api } from './garden/api';

type Mode = 'home' | 'lobby' | 'calm' | 'climb' | 'daily' | 'dodge' | 'garden';
type GameMode = 'calm' | 'climb' | 'dodge';

let mode: Mode = 'home';
let gm: GameMode = (['calm', 'climb', 'dodge'] as const).includes(load<GameMode>('pat-gm', 'calm')) ? load<GameMode>('pat-gm', 'calm') : 'calm';
let cfg: Cfg = loadCfg();
let joining = 0;
let prompt = { text: '', depth: 0, daily: false };
let curMood: string | null = null;
let daily = { words: [] as string[], moods: [] as (string | null)[], thoughts: 0, islands: 0 };
const today = dayKey();
const isGame = (m: Mode) => m === 'calm' || m === 'climb' || m === 'daily' || m === 'dodge';
const PANELS = ['#home', '#custom', '#lobby', '#over', '#jpanel', '#glist', '#gsheet', '#gadminp', '#helpp', '#privp', '#suggp'];
const only = (sel?: string) => PANELS.forEach((p) => show(p, p === sel));

let toastTimer = 0;
function toast(t: string) {
  const el = $('#toast');
  el.textContent = t; show('#toast');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => show('#toast', false), 3200);
}

function setHud(on: boolean) { $('#hud').style.display = on ? 'flex' : 'none'; measureHud(); }

/* ---------- game lifecycle ---------- */

function startGame(kind: Exclude<Mode, 'home' | 'lobby' | 'garden'>, partner: Look | null) {
  mode = kind;
  only();
  show('#typeBox', false);
  setHud(true);
  show('#jr', kind !== 'dodge');
  daily = { words: [], moods: [], thoughts: 0, islands: 0 };
  if (kind === 'dodge') startDodge(lookOf(cfg), partner, cfg.theme);
  else startClimb(kind as Variant, lookOf(cfg), partner, cfg.theme);
  updateWho();
}

function goHome() {
  closeRoom();
  mode = 'home';
  session.partner = null;
  show('#typeBox', false);
  setHud(false);
  ['#gtop', '#gbar'].forEach((s) => show(s, false));
  only('#home');
  $('#msg').textContent = '';
  refreshHome();
  if (location.search) history.replaceState(null, '', '/');
}

function closeRoom() { session.room?.close(); session.room = null; clearTimeout(joining); joining = 0; }

hooks.hud = (t) => { $('#stats').textContent = t; };
hooks.missions = (m) => {
  const el = $('#missions');
  if (!m) { show('#missions', false); return; }
  el.innerHTML = m.map((x) => `<li class="${x.d ? 'd' : ''}">${x.d ? '✓' : '○'} ${esc(x.t)}</li>`).join('');
  show('#missions');
  requestAnimationFrame(measureHud);
};
hooks.openPrompt = openPrompt;
hooks.gameOver = showOver;

function updateWho() {
  const p = session.partner;
  const txt = !p ? '' : clock.T - session.lastPing > 7 ? `${p.name} is away` : `${p.name} is here`;
  if ($('#who').textContent !== txt) $('#who').textContent = txt;
  show('#who', !!p);
}

/* ---------- planting a thought in a game ---------- */

function openPrompt(r: PromptRequest) {
  prompt = { text: r.daily ? dailyPrompt(today, cfg.lang) : pickPrompt(cfg.pack, cfg.lang, r.depth), depth: r.depth, daily: r.daily };
  $('#prompt').textContent = prompt.text;
  show('#another', !r.daily);
  curMood = null; drawMoods();
  $<HTMLTextAreaElement>('#note').value = '';
  $<HTMLInputElement>('#word').value = '';
  show('#shareRow', r.shared);
  if (r.shared) {
    const deep = cfg.pack === 'everyday' && r.depth >= 2;
    $<HTMLInputElement>('#shareWord').checked = !deep;
    $('#shareTxt').textContent = deep ? `Show my words to ${session.partner?.name} (deep questions stay private unless you tick this)` : `Show my words to ${session.partner?.name}`;
  }
  show('#typeBox');
  setTimeout(() => $('#word').focus({ preventScroll: true }), 250);
}

function drawMoods() {
  $('#moods').innerHTML = MOODS.map((m) => `<button class="hat ${m[0] === curMood ? 'on' : ''}" data-m="${m[0]}" aria-pressed="${m[0] === curMood}">${m[1]} ${m[2]}</button>`).join('');
}
$('#moods').onclick = (e) => {
  const m = (e.target as HTMLElement).closest<HTMLElement>('[data-m]')?.dataset.m;
  if (!m) return;
  curMood = curMood === m ? null : m;
  drawMoods();
  if (curMood) moodMusic[curMood]?.();
};
$('#another').onclick = () => { prompt.text = pickPrompt(cfg.pack, cfg.lang, prompt.depth); $('#prompt').textContent = prompt.text; };

function submit(skip = false) {
  const word = skip ? '' : $<HTMLInputElement>('#word').value.trim();
  const note = $<HTMLTextAreaElement>('#note').value.trim();
  if (!skip && !word) {
    const b = $('#typeBox'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
    $('#word').focus(); return;
  }
  if (word) {
    addEntry({ word, mood: isMood(curMood) ? curMood : null, note, prompt: prompt.text, mode });
    if (mode === 'daily') { daily.words.push(word); daily.moods.push(curMood); }
  }
  show('#typeBox', false);
  $<HTMLInputElement>('#word').blur();
  submitThought(word, curMood, !session.partner || $<HTMLInputElement>('#shareWord').checked);
  if (needsSupport(word + ' ' + note)) openHelp();
}
$('#plant').onclick = () => submit();
$<HTMLInputElement>('#word').onkeydown = (e) => { if (e.key === 'Enter') submit(); };
$('#skip').onclick = () => submit(true);

function showOver(o: OverInfo) {
  $('#otitle').textContent = o.title;
  $('#oscore').textContent = o.text;
  show('#oshare', !!o.share);
  if (o.share) { daily.thoughts = o.share.thoughts; daily.islands = o.share.islands; daily.moods = o.share.moods; }
  show('#oplantG', !!o.share && online && daily.words.length > 0);
  show('#typeBox', false);
  only('#over');
  refreshHome();
}

$('#oshareBtn').onclick = async () => {
  const r = await shareDaily({ day: today, thoughts: daily.thoughts, islands: daily.islands, moods: daily.moods, words: daily.words }, $<HTMLInputElement>('#owords').checked, location.origin + '/?daily');
  if (r === 'downloaded') toast('Card saved and text copied. Share it anywhere.');
  else if (r === 'failed') toast('Couldn’t share on this device.');
};
$('#oplantG').onclick = () => {
  const w = daily.words[0];
  if (!w) return;
  only(); mode = 'home'; setHud(false);
  showGardenList({ word: w, mood: daily.moods[0], prompt: dailyPrompt(today, cfg.lang) });
};

$('#again').onclick = () => {
  const kind = mode === 'home' ? gm : mode;
  if (kind === 'daily') { session.seed = dailySeed(today); startGame('daily', null); return; }
  session.seed = 1 + Math.floor(Math.random() * 1e9);
  if (session.room && session.partner) send({ t: 'again', seed: session.seed, gm: kind });
  startGame(kind as Variant | 'dodge', session.partner);
};
$('#omenu').onclick = goHome;
$('#menu').onclick = goHome;

/* ---------- live rooms ---------- */

function onMsg(m: Msg) {
  if (!m || typeof m.t !== 'string' || m.p === session.slot) return;
  if (m.t === 'join' && mode === 'lobby') {
    session.partner = cleanLook(m.look);
    send({ t: 'welcome', seed: session.seed, look: lookOf(cfg), gm });
    startGame(gm, session.partner);
  } else if (m.t === 'welcome' && joining) {
    clearTimeout(joining); joining = 0;
    session.seed = typeof m.seed === 'number' ? m.seed : 1;
    session.partner = cleanLook(m.look);
    const g = (['calm', 'climb', 'dodge'] as const).includes(m.gm as GameMode) ? (m.gm as GameMode) : 'calm';
    startGame(g, session.partner);
  } else if (m.t === 'ping') session.lastPing = clock.T;
  else if (m.t === 'leave') { session.lastPing = -99; if (session.partner) toast(`${session.partner.name} left the game.`); }
  else if (m.t === 'again' && session.partner && typeof m.seed === 'number') {
    session.seed = m.seed;
    const g = m.gm === 'dodge' ? 'dodge' : m.gm === 'climb' ? 'climb' : 'calm';
    startGame(g, session.partner);
  } else if (mode === 'dodge') dodgeMsg(m);
  else if (mode === 'calm' || mode === 'climb') climbMsg(m);
}
setInterval(() => { if (isGame(mode) && session.room) send({ t: 'ping' }); }, 2000);
addEventListener('pagehide', closeRoom);

$('#host').onclick = () => {
  saveName();
  closeRoom();
  session.slot = 1;
  session.seed = 1 + Math.floor(Math.random() * 1e9);
  const code = genCode();
  $('#msg').textContent = online ? 'Opening a room…' : '';
  session.room = openRoom(code, 1, onMsg, (st, why) => {
    if (st === 'ready' && mode === 'home') {
      mode = 'lobby'; only('#lobby');
      $('#big').textContent = code;
      $('#lobbytxt').textContent = session.room?.crossDevice ? `Waiting for your friend… (${modeName(gm)})` : 'This build has no online server, so only another tab on this device can join.';
      $('#msg').textContent = '';
    } else if (st !== 'ready') { $('#msg').textContent = why || ''; closeRoom(); if (mode === 'lobby') goHome(); }
  });
};
const modeName = (g: GameMode) => ({ calm: 'Calm walk', climb: 'Climb', dodge: 'Dodge' })[g];
$('#lshare').onclick = async () => {
  const code = $('#big').textContent || '';
  const r = await shareLink('Plant a Thought', `Play Plant a Thought with me! Room ${code} 🌱`, `${location.origin}/?room=${code}`);
  if (r === 'copied') toast('Invite link copied.');
};
$('#back').onclick = goHome;

function join(input: string) {
  saveName();
  const code = normalizeCode(input);
  if (!code) { $('#msg').textContent = 'Codes look like MOSS-4821: four letters, four numbers.'; return; }
  closeRoom();
  session.slot = 2;
  $('#msg').textContent = 'Looking for that room…';
  session.room = openRoom(code, 2, onMsg, (st, why) => {
    if (st === 'ready') {
      send({ t: 'join', look: lookOf(cfg) });
      joining = window.setTimeout(() => {
        if (!joining) return;
        closeRoom();
        $('#msg').textContent = online ? 'No room is open with that code. Check it with your friend and try again.' : 'This build has no online server, so rooms only work between tabs on one device.';
      }, 6000);
    } else { $('#msg').textContent = why || ''; closeRoom(); }
  });
}
$('#join').onclick = () => join($<HTMLInputElement>('#code').value);
$<HTMLInputElement>('#code').onkeydown = (e) => { if (e.key === 'Enter') join($<HTMLInputElement>('#code').value); };

/* ---------- home ---------- */

function refreshHome() {
  $('#dq').textContent = dailyPrompt(today, cfg.lang);
  const doneToday = entries().some((e) => e.mode === 'daily' && dayKey(new Date(e.ts)) === today);
  $('#dplay').textContent = doneToday ? '🌼 Play today’s garden again' : '🌼 Answer today’s question';
  const s = streak(), n = entries().length;
  $('#streak').textContent = n ? `Your garden has ${n} flower${n === 1 ? '' : 's'}${s > 1 ? ` · ${s}-day streak 🌱` : ''}` : 'Everyone gets the same question today.';
  [...$('#modes').children].forEach((b) => { const on = (b as HTMLElement).dataset.gm === gm; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
  $('#solo').textContent = `Play ${modeName(gm)} solo`;
  $('#cust').textContent = `${KE[cfg.kind]} Customize`;
  $('#cust').setAttribute('aria-label', `Customize ${cfg.name}`);
}
$('#modes').onclick = (e) => {
  const g = (e.target as HTMLElement).closest<HTMLElement>('[data-gm]')?.dataset.gm as GameMode | undefined;
  if (!g) return;
  gm = g; save('pat-gm', g); refreshHome();
};
$('#solo').onclick = () => { saveName(); closeRoom(); session.slot = 1; session.partner = null; session.seed = 1 + Math.floor(Math.random() * 1e9); startGame(gm, null); };
$('#dplay').onclick = () => { saveName(); closeRoom(); session.slot = 1; session.partner = null; session.seed = dailySeed(today); startGame('daily', null); };
$('#gardens').onclick = () => { only(); showGardenList(); };

function saveName() { cfg.name = cleanName($<HTMLInputElement>('#nm').value); saveCfg(cfg); }

/* ---------- customize ---------- */

function drawPick() {
  $('#cols').innerHTML = COLS.map((c) => `<button class="sw ${c === cfg.color ? 'on' : ''}" data-c="${c}" style="background:${c}" aria-label="Color ${c}" aria-pressed="${c === cfg.color}"></button>`).join('');
  $('#hats').innerHTML = HATS.map((h) => `<button class="hat ${h === cfg.hat ? 'on' : ''}" data-h="${h}" aria-pressed="${h === cfg.hat}">${h}</button>`).join('');
  $('#kinds').innerHTML = KINDS.map((k) => `<button class="hat ${k === cfg.kind ? 'on' : ''}" data-k="${k}" aria-pressed="${k === cfg.kind}">${KE[k]} ${k}</button>`).join('');
  $('#themes').innerHTML = THEMES.map((t) => { const [a, b, dark] = THEME_SWATCH[t]; return `<button class="hat ${t === cfg.theme ? 'on' : ''}" data-t="${t}" style="background:linear-gradient(${a},${b});color:${dark ? '#fff' : '#2F3A2B'};padding:14px 16px">${t}</button>`; }).join('');
  $('#packs').innerHTML = allPacks().map((p) => `<button class="mode ${p.id === cfg.pack ? 'on' : ''}" role="radio" aria-checked="${p.id === cfg.pack}" data-p="${p.id}"><b>${p.emoji} ${esc(p.name)}${p.hi ? ' · हिन्दी' : ''}</b><span>${esc(p.desc)}</span></button>`).join('');
  [...$('#langs').children].forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.l === cfg.lang));
}
$('#custom').onclick = (e) => {
  const d = (e.target as HTMLElement).closest<HTMLElement>('button')?.dataset;
  if (!d) return;
  if (d.c) cfg.color = d.c;
  else if (d.h) cfg.hat = d.h as Cfg['hat'];
  else if (d.k) cfg.kind = d.k as Cfg['kind'];
  else if (d.t) cfg.theme = d.t as Cfg['theme'];
  else if (d.p) cfg.pack = d.p;
  else if (d.l) cfg.lang = d.l === 'hi' ? 'hi' : 'en';
  else if (d.tab) {
    [...$('#tabs').children].forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.tab === d.tab));
    show('#tabYou', d.tab === 'you'); show('#tabTheme', d.tab === 'theme'); show('#tabQs', d.tab === 'qs');
    return;
  } else return;
  saveCfg(cfg); drawPick();
};
$('#cust').onclick = () => { drawPick(); only('#custom'); };
$('#cdone').onclick = () => { saveName(); saveCfg(cfg); refreshHome(); only('#home'); loadCommunity(); };

/* ---------- HUD tools ---------- */

$('#snd').textContent = audio.muted ? '🔇' : '🔊';
$('#snd').onclick = () => { setMuted(!audio.muted); $('#snd').textContent = audio.muted ? '🔇' : '🔊'; };
$('#th').onclick = () => { cfg.theme = THEMES[(THEMES.indexOf(cfg.theme) + 1) % THEMES.length]; climbTheme(cfg.theme); saveCfg(cfg); };

/* ---------- journal ---------- */

function openJournal() {
  const list = entries().slice().sort((a, b) => b.ts - a.ts);
  const s = streak();
  $('#jmeta').textContent = list.length ? `${list.length} thought${list.length === 1 ? '' : 's'}${s > 1 ? ` · ${s}-day streak` : ''}` : '';
  let lastDay = '';
  $('#jlist').innerHTML = list.length ? list.map((e) => {
    const d = new Date(e.ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const head = d !== lastDay ? `<p class="jday">${d}</p>` : '';
    lastDay = d;
    return `${head}<div class="jent">${e.prompt ? `<p class="jq">${esc(e.prompt)}</p>` : ''}<p class="jw">${esc(e.word)} ${moodEmoji(e.mood)}</p>${e.note ? `<p class="jn">${esc(e.note)}</p>` : ''}<button class="jx" data-x="${e.id}" aria-label="Delete this thought">✕</button></div>`;
  }).join('') : '<p>Nothing planted yet. Answer a question in any mode and it will be kept here.</p>';
  show('#jgarden', list.length > 0); show('#jexport', list.length > 0); show('#jclear', list.length > 0);
  show('#jpanel');
}
$('#jlist').onclick = (e) => {
  const id = (e.target as HTMLElement).closest<HTMLElement>('[data-x]')?.dataset.x;
  if (id && confirm('Delete this thought?')) { removeEntry(id); openJournal(); refreshHome(); }
};
$('#jr').onclick = openJournal;
$('#jrHome').onclick = () => { only(); openJournal(); };
$('#jclose').onclick = () => { show('#jpanel', false); if (mode === 'home') only('#home'); };
$('#jexport').onclick = () => {
  const blob = new Blob([exportText()], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `plant-a-thought-journal-${today}.txt`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};
$('#jclear').onclick = () => { if (confirm('Delete every thought in your journal? This can’t be undone.')) { clearJournal(); openJournal(); refreshHome(); } };
$('#jgarden').onclick = () => { show('#jpanel', false); if (isGame(mode)) goHome(); only(); openLocalGarden(); };

/* ---------- gardens ---------- */

initGardens({
  cfg: () => cfg,
  enter: () => { closeRoom(); mode = 'garden'; only(); setHud(false); show('#typeBox', false); },
  leave: () => goHome(),
  toast,
  help: openHelp,
  isActive: () => mode === 'garden',
});

/* ---------- help, privacy, suggestions ---------- */

function openHelp() {
  $('#lines').innerHTML = HELPLINES.map(([where, name, href]) => `<li><a href="${href}" ${href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${esc(name)}<small>${esc(where)} · ${esc(href.replace(/^tel:|^https:\/\//, ''))}</small></a></li>`).join('');
  show('#helpp');
}
$('#help').onclick = openHelp;
$('#helpclose').onclick = () => show('#helpp', false);
$('#privacy').onclick = () => show('#privp');
$('#privclose').onclick = () => show('#privp', false);
let sugLang: 'en' | 'hi' = 'en';
$('#suggest').onclick = () => {
  $('#sugmsg').textContent = online ? '' : 'Suggestions need the online version of the app.';
  ($('#sugsend') as HTMLButtonElement).disabled = !online;
  show('#suggp');
};
$('#suglang').onclick = (e) => {
  const l = (e.target as HTMLElement).closest<HTMLElement>('[data-l]')?.dataset.l;
  if (!l) return;
  sugLang = l === 'hi' ? 'hi' : 'en';
  [...$('#suglang').children].forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.l === sugLang));
};
$('#sugsend').onclick = async () => {
  const t = $<HTMLTextAreaElement>('#sugtext').value.trim();
  if (t.length < 5) { $('#sugmsg').textContent = 'A little longer, please.'; return; }
  try { await api.suggest(t, sugLang); $<HTMLTextAreaElement>('#sugtext').value = ''; $('#sugmsg').textContent = 'Thank you! It will appear in the Community pack once approved.'; }
  catch (e) { $('#sugmsg').textContent = (e as Error).message; }
};
$('#sugclose').onclick = () => show('#suggp', false);

async function loadCommunity() {
  for (const l of ['en', 'hi'] as const) community[l] = load<string[]>('pat-community-' + l, []);
  if (!online) return;
  try {
    for (const l of ['en', 'hi'] as const) { community[l] = await api.prompts(l); save('pat-community-' + l, community[l]); }
  } catch { /* keep cached */ }
  if (cfg.pack === 'community' && !community[cfg.lang].length && !community.en.length) cfg.pack = 'everyday';
}

/* ---------- input & frame loop ---------- */

cv.addEventListener('pointerdown', () => {
  if (mode === 'dodge') tapDodge();
  else if (mode === 'calm' || mode === 'climb' || mode === 'daily') tapClimb();
});
addEventListener('keydown', (e) => {
  if (!(e.code === 'Space' || e.key === 'ArrowUp')) return;
  if ((e.target as HTMLElement).closest('input,textarea,button,select')) return;
  if (mode === 'dodge') { e.preventDefault(); tapDodge(); }
  else if (mode === 'calm' || mode === 'climb' || mode === 'daily') { e.preventDefault(); tapClimb(); }
});

let last = 0, whoT = 0;
function frame(t: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (t - last) / 1000 || 0);
  last = t;
  clock.T += dt;
  if (mode === 'dodge') dodgeFrame(dt);
  else if (mode === 'calm' || mode === 'climb' || mode === 'daily') climbFrame(dt);
  else if (mode === 'garden') gardenTick();
  else sky(cfg.theme, 0.25, clock.T * 8);
  if (isGame(mode) && clock.T - whoT > 0.5) { whoT = clock.T; updateWho(); }
}
requestAnimationFrame(frame);

/* keyboard: lift the answer box above the on-screen keyboard */
function kbLift() {
  const v = window.visualViewport;
  if (!v) return;
  const k = Math.max(0, innerHeight - v.height - v.offsetTop);
  for (const s of ['#typeBox', '#gbar']) $(s).style.bottom = k > 50 ? k + 10 + 'px' : '';
}
window.visualViewport?.addEventListener('resize', kbLift);
window.visualViewport?.addEventListener('scroll', kbLift);

/* ---------- install & offline ---------- */

const installed = () => matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installEv: (Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> }) | null = null;
if (import.meta.env.PROD && 'serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
if (isIOS && !installed()) show('#getapp');
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEv = e as typeof installEv; show('#getapp'); });
addEventListener('appinstalled', () => { installEv = null; show('#getapp', false); });
$('#getapp').onclick = async () => {
  if (installEv) { installEv.prompt(); const r = await installEv.userChoice; installEv = null; if (r.outcome === 'accepted') show('#getapp', false); return; }
  $('#msg').textContent = isIOS ? 'In Safari, tap the Share button ⬆ then “Add to Home Screen”.' : 'Open your browser menu and choose “Install app” or “Add to Home screen”.';
};

/* ---------- boot ---------- */

$<HTMLInputElement>('#nm').value = cfg.name;
if (!PACKS.some((p) => p.id === cfg.pack) && cfg.pack !== 'community') cfg.pack = 'everyday';
refreshHome();
loadCommunity();
resize();

const params = new URLSearchParams(location.search);
const roomParam = params.get('room'), gardenParam = params.get('g');
if (gardenParam && slugFrom(gardenParam)) { only(); openGarden(slugFrom(gardenParam)!); }
else if (roomParam && normalizeCode(roomParam)) {
  const code = normalizeCode(roomParam)!;
  $<HTMLInputElement>('#code').value = code;
  $('#invtxt').textContent = `You’re invited to play in room ${code}. Pick your animal in Customize first if you like.`;
  show('#invite');
  $('#invjoin').onclick = () => { show('#invite', false); join(code); };
}

/** Read-only hooks used by the end-to-end tests. */
(window as unknown as { __pat: unknown }).__pat = {
  mode: () => mode,
  player: playerOnScreen,
  islands: islandsOnScreen,
  flowers: drawnCount,
  dodge: () => ({ unit: unit(view.W), reaction: reactionTime(), fastReaction: reactionTime(true) }),
};
