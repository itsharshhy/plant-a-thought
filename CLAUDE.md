# Plant a Thought: notes for Claude

## How to work with the owner
- Be a blunt "devil mentor": no sugarcoating, do not just agree. Challenge ideas with evidence, say plainly when something is a bad idea, and recommend one path.
- Keep `docs/ANALYSIS.md` (the product and bug review) up to date when bugs are fixed or the direction changes.

## Project facts
- Static PWA on GitHub Pages: `index.html` holds the whole game (HTML, CSS, JS in one minified-style file, no build or tests). `sw.js` caches it offline. `config.js` holds Supabase `url`/`key`.
- Run locally: `python3 -m http.server 8080`.
- Modes reachable from the home screen: **Thought** (`start()`, `frame()`) and **Dodge** (`startDodge()`, `dodgeFrame()`).
- Dead code: Run mode (`startRun`/`runFrame`), foes (`foeInfo` returns `null`), slingshot `aim`/`charged`, `PROMPTS`, `apkUrl`.
- Multiplayer: Supabase Realtime Broadcast, channel `room-<CODE>`; without `config.js` values it falls back to `BroadcastChannel` (same browser only). Production `config.js` is currently empty.

## Known open bugs (see docs/ANALYSIS.md)
1. Online multiplayer off in production (empty `config.js`).
2. Journal wiped on every `start()`; nothing is persisted.
3. Moving islands can go off-screen sideways on phones (camera does not follow x).
4. Dodge speed is in raw px/s, so phones get ~0.4 s to react versus ~2 s on desktop.
5. HUD wraps and overlaps the missions and the top lane on narrow phones.
6. Prompts: only 36, and only one every 20 islands.

## Agreed direction (proposed, not yet confirmed by owner)
Reflection first: calm no-fail mode, persistent garden, invite links, daily shared prompt, async shared gardens, group rooms. Demote or cut Dodge mode.
