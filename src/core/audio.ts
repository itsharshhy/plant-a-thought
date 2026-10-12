import { load, save } from './store';

let AC: AudioContext | null = null;
export const audio = { muted: load<boolean>('pat-muted', false) };

export function setMuted(m: boolean) { audio.muted = m; save('pat-muted', m); }

function ac(): AudioContext | null {
  if (!AC) {
    try { AC = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { /* no audio */ }
  }
  if (AC && AC.state === 'suspended') AC.resume();
  return AC;
}
addEventListener('pointerdown', () => ac(), { passive: true });

interface ToneOpts { at?: number; to?: number; v?: number; type?: OscillatorType; att?: number }
export function tone(f: number, d: number, o: ToneOpts = {}) {
  const a = ac();
  if (!a || audio.muted) return;
  const t = a.currentTime + (o.at || 0), os = a.createOscillator(), gn = a.createGain();
  os.type = o.type || 'sine';
  os.frequency.setValueAtTime(f, t);
  if (o.to) os.frequency.exponentialRampToValueAtTime(o.to, t + d);
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(o.v || 0.08, t + (o.att || 0.01));
  gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
  os.connect(gn); gn.connect(a.destination);
  os.start(t); os.stop(t + d + 0.05);
}

function noise(d: number, f: number, v: number) {
  const a = ac();
  if (!a || audio.muted) return;
  const n = Math.floor(a.sampleRate * d), b = a.createBuffer(1, n, a.sampleRate), x = b.getChannelData(0);
  for (let i = 0; i < n; i++) x[i] = Math.random() * 2 - 1;
  const sr = a.createBufferSource(), fl = a.createBiquadFilter(), gn = a.createGain(), t = a.currentTime;
  sr.buffer = b; fl.type = 'lowpass'; fl.frequency.value = f;
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(v, t + d * 0.45);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
  sr.connect(fl); fl.connect(gn); gn.connect(a.destination); sr.start();
}

export interface Voice { f: number; to: number; d: number; ty: OscillatorType }

export const sfx = {
  hop(p: Voice) {
    const soft = p.ty === 'sine' || p.ty === 'triangle';
    tone(p.f, p.d, { to: p.to, v: soft ? 0.1 : 0.04, type: p.ty });
    tone(p.to * 1.5, 0.1, { at: 0.07, to: p.to * 2, v: 0.04, type: 'triangle' });
  },
  plant() { tone(660, 0.25, { v: 0.07, type: 'triangle' }); tone(990, 0.3, { at: 0.08, v: 0.04 }); },
  spark() { const N = [1319, 1568, 1760, 2093, 2349, 2637]; for (let i = 0; i < 6; i++) tone(N[Math.floor(Math.random() * N.length)], 0.3, { at: i * 0.07 + Math.random() * 0.04, v: 0.03, att: 0.004 }); },
  hit() { tone(180, 0.28, { to: 80, v: 0.12, type: 'sawtooth' }); vib(60); },
  level() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.4, { at: i * 0.09, v: 0.06, type: 'triangle' })); },
  over() { [392, 330, 262].forEach((f, i) => tone(f, 0.9, { at: i * 0.25, v: 0.06, att: 0.05 })); },
  coin() { tone(1568, 0.12, { v: 0.05, att: 0.003 }); tone(2093, 0.15, { at: 0.06, v: 0.04, att: 0.003 }); },
  power() { [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.35, { at: i * 0.07, v: 0.06, type: 'triangle' })); },
  pop() { tone(900, 0.15, { to: 300, v: 0.08 }); },
  flap() { tone(900, 0.06, { to: 1300, v: 0.04 }); },
  tick() { tone(90, 0.1, { v: 0.05, type: 'triangle' }); },
  water() { tone(1200, 0.12, { to: 600, v: 0.05 }); tone(1500, 0.1, { at: 0.08, to: 900, v: 0.03 }); },
};

export const moodMusic: Record<string, () => void> = {
  happy() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 1.1, { at: i * 0.16, v: 0.06, type: 'triangle' })); },
  sad() { [220, 262, 330].forEach((f, i) => tone(f, 3.5, { at: i * 0.4, v: 0.05, att: 0.6 })); noise(4, 500, 0.015); },
  angry() { noise(5, 420, 0.05); tone(98, 5, { v: 0.06, att: 1.5 }); tone(147, 5, { v: 0.04, att: 1.8 }); },
  anxious() { [0, 3.2].forEach((a) => { tone(174, 3, { at: a, v: 0.07, att: 1.4 }); tone(261, 3, { at: a, v: 0.03, att: 1.4 }); }); tone(523, 2, { at: 6.4, v: 0.03 }); },
  calm() { [392, 440, 523, 587, 659].forEach((f, i) => tone(f, 2.5, { at: i * 0.7, v: 0.05, att: 0.05 })); },
};

export function vib(n: number) { try { navigator.vibrate?.(n); } catch { /* unsupported */ } }
