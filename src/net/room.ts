import type { RealtimeChannel } from '@supabase/supabase-js';
import { online, sb } from './supabase';
import { randomHex } from '../core/util';

const STEMS = ['MOSS', 'FERN', 'DEWY', 'LEAF', 'PINE', 'WREN', 'BUDS', 'HAZE', 'LARK', 'MINT', 'SAGE', 'TEAL', 'VINE', 'WILD', 'COZY', 'DUSK', 'GLOW', 'LILY', 'OATS', 'POND',
  'REED', 'ROSE', 'SEED', 'SNOW', 'STAR', 'TIDE', 'WAVE', 'BEAM', 'BIRD', 'CLAY', 'DAWN', 'FAWN', 'GLEN', 'HUSH', 'IRIS', 'KITE', 'LUNA', 'MOON', 'NEST', 'PALM'];

/** 40 words × 9000 numbers = 360,000 codes, e.g. MOSS-4821. */
export function genCode(random = Math.random): string {
  return STEMS[Math.floor(random() * STEMS.length)] + '-' + (1000 + Math.floor(random() * 9000));
}

/** Accepts "moss 4821", "MOSS-4821", "moss4821". Returns null when it is not a valid code. */
export function normalizeCode(input: string): string | null {
  const u = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = /^([A-Z]{4})(\d{4})$/.exec(u);
  return m ? `${m[1]}-${m[2]}` : null;
}

export type Msg = { t: string; p?: number; [k: string]: unknown };
export type RoomState = 'ready' | 'full' | 'error';

export interface Room { code: string; crossDevice: boolean; send(m: Msg): void; close(): void }

export const MAX_PLAYERS = 2;

/**
 * Join a live room. Online builds use Supabase Realtime (Broadcast + Presence, no database);
 * otherwise rooms fall back to BroadcastChannel, which only links tabs in one browser.
 */
export function openRoom(code: string, slot: number, onMsg: (m: Msg) => void, onState: (s: RoomState, why?: string) => void): Room {
  let closed = false, seq = 0;
  const stamp = (m: Msg) => ({ ...m, p: slot, seq: ++seq });

  if (!online) {
    let bc: BroadcastChannel | null = null;
    try { bc = new BroadcastChannel('plant-a-thought-' + code); } catch { setTimeout(() => onState('error', 'This browser can’t open a room. Try solo.')); }
    if (bc) { bc.onmessage = (e) => !closed && onMsg(e.data as Msg); setTimeout(() => onState('ready')); }
    return { code, crossDevice: false, send: (m) => bc?.postMessage(stamp(m)), close: () => { if (closed) return; bc?.postMessage(stamp({ t: 'leave' })); closed = true; bc?.close(); } };
  }

  const me = randomHex(8), joinedAt = Date.now();
  let ch: RealtimeChannel | null = null, ready = false;
  sb().then((client) => {
    if (closed) return;
    ch = client.channel('room-' + code, { config: { broadcast: { self: false }, presence: { key: me } } });
    ch.on('broadcast', { event: 'm' }, ({ payload }) => !closed && onMsg(payload as Msg));
    ch.on('presence', { event: 'sync' }, () => {
      if (!ch || closed) return;
      const people = Object.entries(ch.presenceState<{ at: number }>())
        .map(([k, v]) => ({ k, at: v[0]?.at ?? 0 }))
        .sort((a, b) => a.at - b.at || a.k.localeCompare(b.k));
      if (people.findIndex((p) => p.k === me) >= MAX_PLAYERS) { onState('full', 'That room already has two players.'); close(); }
    });
    ch.subscribe(async (st) => {
      if (closed) return;
      if (st === 'SUBSCRIBED') { await ch!.track({ at: joinedAt }); if (!ready) { ready = true; onState('ready'); } }
      else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') onState('error', 'Can’t reach the game server. Check your connection and try again.');
    });
  }).catch(() => onState('error', 'Couldn’t load online play. Check your connection.'));

  function close() {
    if (closed) return;
    closed = true;
    const c = ch;
    if (c) { c.send({ type: 'broadcast', event: 'm', payload: stamp({ t: 'leave' }) }).catch(() => {}); setTimeout(() => sb().then((s) => s.removeChannel(c)), 150); }
  }
  return { code, crossDevice: true, send: (m) => { if (ch && ready && !closed) ch.send({ type: 'broadcast', event: 'm', payload: stamp(m) }); }, close };
}
