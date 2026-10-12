import type { Room, Msg } from '../net/room';
import type { Look } from '../data/profile';

/** Who is playing with whom. Shared by every mode. */
export const session = {
  slot: 1,
  seed: 1,
  room: null as Room | null,
  partner: null as Look | null,
  lastPing: 0,
};

export const send = (m: Msg) => session.room?.send(m);

export interface PromptRequest { depth: number; daily: boolean; shared: boolean }
export interface OverInfo { title: string; text: string; share?: { thoughts: number; islands: number; moods: (string | null)[] } }

/** UI callbacks the game modes use. Set by main.ts. */
export const hooks = {
  openPrompt: (_r: PromptRequest) => {},
  gameOver: (_o: OverInfo) => {},
  hud: (_stats: string) => {},
  missions: (_m: { t: string; d: boolean }[] | null) => {},
};
