# Plant a Thought: notes for contributors and AI assistants

## Stack
- Vite + TypeScript (strict), no UI framework: DOM panels in `index.html`, game drawn on one `<canvas>`.
- Supabase: Postgres functions for shared gardens and community questions, Realtime Broadcast + Presence for live rooms. Client is lazy-loaded (`src/net/supabase.ts`).
- Hosted on Vercel (`vercel.json`). PWA via `public/sw.js` + `public/manifest.webmanifest`.
- Tests: Vitest (`tests/unit`, jsdom) and Playwright (`tests/e2e`, phone / 320px phone / desktop).

## Commands
- `npm run dev` · `npm run build` (typecheck + build) · `npm test` (unit) · `npm run e2e` (builds and serves itself).
- `E2E_REALTIME=1 npm run e2e` also runs the cross-device live-room test (needs websockets to Supabase).

## Layout
- `src/main.ts` wires UI, modes and rooms. `src/ui/gardens.ts` is the shared-garden screen.
- `src/game/climb.ts` Calm walk / Climb / Daily. `src/game/dodge.ts` Dodge. `src/game/session.ts` shared state + UI hooks.
- `src/draw/` animals and scenery (all drawing goes through `g` in `src/core/canvas.ts`; `withContext` swaps it).
- `src/data/prompts.ts` question packs (Hindi lists are line-by-line translations of English).
- `src/journal.ts` local-only journal. `src/safety.ts` crisis check + helplines.
- `supabase/migrations/` is the source of truth for the database.

## Rules that matter
- Database tables have RLS on and no policies; the app may only call the SECURITY DEFINER functions. Never add table grants for `anon`.
- Never upload the journal or private notes. Only what someone plants in a shared garden leaves the device.
- Anything received from another player goes through `cleanLook` / length limits before use.
- Islands must fit the narrowest phone: `MAX_REACH + MAX_HALF_WIDTH <= 320 / 2 / 0.7` (unit-tested).
- Dodge speeds are in world units with a fixed visible distance (`VIS`), so reaction time does not depend on screen width.
