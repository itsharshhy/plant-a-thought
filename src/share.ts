import { withContext, g } from './core/canvas';
import { hash } from './core/util';
import { flower } from './draw/scenery';

export type ShareResult = 'shared' | 'copied' | 'downloaded' | 'cancelled' | 'failed';

/** Native share sheet when available (WhatsApp, Instagram…), otherwise copy to clipboard. */
export async function shareLink(title: string, text: string, url: string): Promise<ShareResult> {
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return 'shared'; }
    catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled'; }
  }
  try { await navigator.clipboard.writeText(`${text} ${url}`); return 'copied'; } catch { return 'failed'; }
}

const MOOD_FLOWER: Record<string, string> = { happy: '🌼', sad: '🪻', angry: '🌺', anxious: '🌸', calm: '🌿' };
export const moodFlowers = (moods: (string | null)[]) => moods.map((m) => (m && MOOD_FLOWER[m]) || '🌷').join('');

export interface DailyResult { day: string; thoughts: number; islands: number; moods: (string | null)[]; words: string[] }

export function dailyText(r: DailyResult, includeWords: boolean, url: string) {
  const date = new Date(r.day + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const lines = [`🌱 Plant a Thought · ${date}`, `${moodFlowers(r.moods)} ${r.thoughts} thoughts, ${r.islands} islands`];
  if (includeWords && r.words.length) lines.push(r.words.map((w) => `“${w}”`).join(' · '));
  lines.push(`Today’s question is waiting: ${url}`);
  return lines.join('\n');
}

/** A 1080×1350 card with one flower per thought. Words only appear if you choose to include them. */
export function dailyCard(r: DailyResult, includeWords: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1350;
  const ctx = c.getContext('2d')!;
  withContext(ctx, () => {
    const gr = g.createLinearGradient(0, 0, 0, 1350);
    gr.addColorStop(0, '#F7C8D4'); gr.addColorStop(0.55, '#FBE3C8'); gr.addColorStop(1, '#A9D8E8');
    g.fillStyle = gr; g.fillRect(0, 0, 1080, 1350);
    g.fillStyle = 'rgba(107,143,90,.85)'; g.beginPath(); g.moveTo(0, 1000);
    for (let x = 0; x <= 1080; x += 40) g.lineTo(x, 960 - Math.sin(x / 140) * 30);
    g.lineTo(1080, 1350); g.lineTo(0, 1350); g.fill();
    g.fillStyle = '#2F3A2B'; g.textAlign = 'center';
    g.font = '600 72px Fraunces,Georgia,serif'; g.fillText('Plant a Thought', 540, 150);
    const date = new Date(r.day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    g.font = '700 38px Nunito,sans-serif'; g.fillText(date, 540, 215);
    const n = Math.max(1, r.moods.length);
    r.moods.forEach((m, i) => {
      const x = 540 + (i - (n - 1) / 2) * Math.min(220, 900 / n), y = 980;
      g.save(); g.translate(x, y); g.scale(3.2, 3.2);
      const w = includeWords ? r.words[i] || 'thought' : 'thought'.repeat(1 + (hash(r.day + i) % 2));
      flower(0, 0, { seed: hash(r.day + ':' + i), word: w, mood: m, size: 1.6, glow: true, label: false });
      g.restore();
      if (includeWords && r.words[i]) {
        g.save(); g.font = '600 40px Caveat,cursive'; g.fillStyle = '#2F3A2B';
        const t = r.words[i].length > 22 ? r.words[i].slice(0, 20) + '…' : r.words[i];
        g.translate(x, 600 + (i % 2) * 60); g.fillText(t, 0, 0); g.restore();
      }
    });
    g.fillStyle = '#FFF8EB'; g.font = '700 44px Nunito,sans-serif';
    g.fillText(`${r.thoughts} thoughts · ${r.islands} islands`, 540, 1150);
    g.font = '700 32px Nunito,sans-serif'; g.fillText('Plant yours today', 540, 1230);
  });
  return c;
}

/** Share the card as an image if the browser supports it; otherwise download it and copy the text. */
export async function shareDaily(r: DailyResult, includeWords: boolean, url: string): Promise<ShareResult> {
  const text = dailyText(r, includeWords, url);
  const blob = await new Promise<Blob | null>((ok) => dailyCard(r, includeWords).toBlob(ok, 'image/png'));
  const file = blob ? new File([blob], `plant-a-thought-${r.day}.png`, { type: 'image/png' }) : null;
  if (file && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return 'shared'; }
    catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled'; }
  }
  if (blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `plant-a-thought-${r.day}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked */ }
  return blob ? 'downloaded' : 'failed';
}
