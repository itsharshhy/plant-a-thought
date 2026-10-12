import { load, save } from '../core/store';

export const COLS = ['#9CC283', '#F29FB0', '#FFD27A', '#8FC7D9', '#E8B7F0', '#F0A04B'];
export const HATS = ['none', 'acorn', 'crown', 'umbrella'] as const;
export const KINDS = ['sprout', 'bunny', 'cat', 'dog', 'frog', 'fox', 'duck', 'bear'] as const;
export const KE: Record<Kind, string> = { sprout: '🌱', bunny: '🐰', cat: '🐱', dog: '🐶', frog: '🐸', fox: '🦊', duck: '🦆', bear: '🐻' };
export const THEMES = ['meadow', 'night', 'space', 'sunny', 'clouds'] as const;
export const THEME_SWATCH: Record<Theme, [string, string, boolean]> = {
  meadow: ['#A9D8E8', '#F6F1DC', false], night: ['#0B1030', '#3B4A7A', true], space: ['#05030F', '#2A1450', true],
  sunny: ['#6EC6F5', '#FFF1B8', false], clouds: ['#C9D9E8', '#F7F4EE', false],
};

export type Kind = (typeof KINDS)[number];
export type Hat = (typeof HATS)[number];
export type Theme = (typeof THEMES)[number];
export type Lang = 'en' | 'hi';

/** What other players can see about you. */
export interface Look { name: string; color: string; hat: Hat; kind: Kind }
export interface Cfg extends Look { theme: Theme; lang: Lang; pack: string }

const pick = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);

/** Clean a name for display: trims, strips control characters, caps length. */
export const cleanName = (v: unknown) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 16) : '') || 'Pip';

/** Validate an appearance that came from another player over the network. */
export function cleanLook(v: unknown): Look {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    name: cleanName(o.name),
    color: typeof o.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.color) ? o.color : COLS[0],
    hat: pick(o.hat, HATS, 'none'),
    kind: pick(o.kind === 'kitty' ? 'cat' : o.kind, KINDS, 'sprout'),
  };
}

export function loadCfg(): Cfg {
  const s = load<Record<string, unknown>>('pat', {});
  return {
    ...cleanLook(s),
    theme: pick(s.theme, THEMES, 'meadow'),
    lang: pick(s.lang, ['en', 'hi'] as const, 'en'),
    pack: typeof s.pack === 'string' ? s.pack : 'everyday',
  };
}

export const saveCfg = (c: Cfg) => save('pat', c);
export const lookOf = (c: Cfg): Look => ({ name: c.name, color: c.color, hat: c.hat, kind: c.kind });
