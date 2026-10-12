import { randomHex } from './util';

export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, v: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}

/** Random per-device secret. Never shown, only sent to our own database functions, which store a hash of it. */
export function deviceId(): string {
  let d = load<string>('pat-device', '');
  if (!/^[0-9a-f]{32}$/.test(d)) { d = randomHex(16); save('pat-device', d); }
  return d;
}
