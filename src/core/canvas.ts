import { clamp } from './util';

export const cv = document.getElementById('c') as HTMLCanvasElement;
/** The context all drawing code uses. `withContext` swaps it to draw into another canvas (e.g. a share card). */
export let g = cv.getContext('2d')!;
export function withContext(ctx: CanvasRenderingContext2D, fn: () => void) {
  const old = g;
  g = ctx;
  try { fn(); } finally { g = old; }
}
export const view = { W: 0, H: 0, hudBottom: 0 };

export function resize() {
  const d = Math.min(devicePixelRatio || 1, 2);
  view.W = Math.round(innerWidth);
  view.H = Math.round(innerHeight);
  cv.width = view.W * d;
  cv.height = view.H * d;
  cv.style.width = view.W + 'px';
  cv.style.height = view.H + 'px';
  g.setTransform(d, 0, 0, d, 0, 0);
  measureHud();
}

export const safeTop = () => parseFloat(getComputedStyle(document.documentElement).paddingTop) || 0;

/** Bottom edge of the HUD in CSS px, so canvas text never sits underneath it. Cached; updated on resize. */
export function measureHud() {
  const h = document.getElementById('hud');
  view.hudBottom = h && h.style.display !== 'none' ? h.getBoundingClientRect().bottom : safeTop();
}

addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 200));
window.visualViewport?.addEventListener('resize', resize);
const hud = document.getElementById('hud');
if (hud && 'ResizeObserver' in window) new ResizeObserver(measureHud).observe(hud);
resize();

/** World scale for the climbing modes. */
export const sc = () => clamp(Math.min(view.W / 520, view.H / 640), 0.7, 1.6);

export const EF = (n: number) => `${n}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;

/** Centered toast drawn on the canvas, always below the HUD. */
export function toast(text: string, size = 24, yFrac = 0) {
  g.save();
  g.textAlign = 'center';
  g.shadowColor = 'rgba(47,58,43,.8)';
  g.shadowBlur = 5;
  g.fillStyle = '#FFF8EB';
  g.font = `700 ${size}px Fraunces,Georgia,serif`;
  const y = Math.max(view.hudBottom + size + 14, view.H * yFrac);
  wrapText(text, view.W / 2, y, view.W - 32, size * 1.2);
  g.restore();
}

export function wrapText(text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t;
  }
  g.fillText(line, x, yy);
}
