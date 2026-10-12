import { sb } from '../net/supabase';
import { deviceId, load, save } from '../core/store';

export interface GPlant { id: string; word: string; mood: string | null; prompt: string | null; waters: number; created_at: string; name: string | null; mine: boolean; watered: boolean; author_tag: string }
export interface Garden { slug: string; name: string; kind: 'friends' | 'circle'; pack: string; lang: 'en' | 'hi'; anonymous: boolean; prompt: string | null; locked: boolean; is_host: boolean; members: number; plants: GPlant[] }

/** Database errors become short messages people can act on. */
function friendly(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('not found')) return 'That garden doesn’t exist any more, or the link is wrong.';
  if (m.includes('full')) return 'This garden already has 30 people.';
  if (m.includes('locked')) return 'The host has paused planting in this garden.';
  if (m.includes('slow down')) return 'You’ve planted a lot this hour. Take a breath and try again later.';
  if (m.includes('too many gardens')) return 'You’ve made plenty of gardens today. Try again tomorrow.';
  if (m.includes('plenty for today')) return 'Thank you! That’s plenty of suggestions for today.';
  if (m.includes('only the host')) return 'Only the host can do that.';
  if (m.includes('fetch') || m.includes('network')) return 'Can’t reach the garden server. Check your connection.';
  return 'Something went wrong. Please try again.';
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const c = await sb();
  const { data, error } = await c.rpc(fn, { p_device: deviceId(), ...args });
  if (error) throw new Error(friendly(error.message));
  return data as T;
}

export const api = {
  create: (name: string, kind: 'friends' | 'circle', pack: string, lang: string, anonymous: boolean) =>
    call<{ slug: string }>('create_garden', { p_name: name, p_kind: kind, p_pack: pack, p_lang: lang, p_anonymous: anonymous }),
  get: (slug: string) => call<Garden>('get_garden', { p_slug: slug }),
  plant: (slug: string, name: string, word: string, mood: string | null, prompt: string | null) =>
    call<{ id: string }>('plant_word', { p_slug: slug, p_name: name, p_word: word, p_mood: mood, p_prompt: prompt }),
  water: (slug: string, plant: string) => call<{ waters: number }>('water_plant', { p_slug: slug, p_plant: plant }),
  report: (slug: string, plant: string, reason: string) => call('report_plant', { p_slug: slug, p_plant: plant, p_reason: reason }),
  remove: (slug: string, plant: string) => call('remove_plant', { p_slug: slug, p_plant: plant }),
  update: (slug: string, prompt: string | null, anonymous: boolean, locked: boolean) =>
    call('update_garden', { p_slug: slug, p_prompt: prompt, p_anonymous: anonymous, p_locked: locked }),
  close: (slug: string) => call('close_garden', { p_slug: slug }),
  suggest: (text: string, lang: string) => call('suggest_prompt', { p_text: text, p_lang: lang }),
  prompts: async (lang: string): Promise<string[]> => { const c = await sb(); const { data } = await c.rpc('list_prompts', { p_lang: lang }); return Array.isArray(data) ? data.filter((x): x is string => typeof x === 'string') : []; },
};

/** Gardens this device has opened, so they are easy to find again. Stored only on this device. */
export interface KnownGarden { slug: string; name: string; kind: string; host: boolean; seen: number }
export const knownGardens = () => load<KnownGarden[]>('pat-gardens', []).filter((g) => typeof g.slug === 'string').sort((a, b) => b.seen - a.seen);
export function rememberGarden(g: Garden) {
  const list = knownGardens().filter((x) => x.slug !== g.slug);
  list.unshift({ slug: g.slug, name: g.name, kind: g.kind, host: g.is_host, seen: Date.now() });
  save('pat-gardens', list.slice(0, 30));
}
export const forgetGarden = (slug: string) => save('pat-gardens', knownGardens().filter((x) => x.slug !== slug));

/** People you chose to hide in a garden (by per-garden tag). Stored only on this device. */
export const hiddenTags = (slug: string) => new Set(load<Record<string, string[]>>('pat-hidden', {})[slug] || []);
export function hideTag(slug: string, tag: string) {
  const all = load<Record<string, string[]>>('pat-hidden', {});
  all[slug] = [...new Set([...(all[slug] || []), tag])];
  save('pat-hidden', all);
}

/** Live nudges: after any change we tell others in the garden to refresh. Carries no content. */
export async function gardenChannel(slug: string, onChange: () => void) {
  const c = await sb();
  const ch = c.channel('garden-' + slug, { config: { broadcast: { self: false } } });
  ch.on('broadcast', { event: 'changed' }, () => onChange()).subscribe();
  return { ping: () => ch.send({ type: 'broadcast', event: 'changed', payload: {} }), close: () => c.removeChannel(ch) };
}
