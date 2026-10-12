# Plant a Thought: honest product and code review

> **Status (v2):** everything below has been built: all bugs fixed (with tests), and every feature in the ranked list shipped, except that Dodge was kept as a side mini-game rather than cut. See the README for what exists now. Kept as the record of why.

Reviewed 2026-10-12 against commit `a3c499e`. Numbers below were measured in headless Chromium, not guessed.

## Verdict in one paragraph

The core idea is good and rare: **a word you write turns into a flower in a world you share with someone.** Almost everything else in the app works against that idea. The reflection part is gated behind a reflex game (crumbling islands, lives, combos, score multipliers), the journal is wiped every game, and the "play with a friend" feature does not work on the live site. Right now nobody has a reason to come back tomorrow. Fix the broken basics, pick **one** identity (cozy reflection, not arcade), and make it social in a way that does not need two people online at the same second.

## Bugs (confirmed)

| # | Bug | Evidence | Severity |
|---|-----|----------|----------|
| 1 | **Online multiplayer is off in production.** `config.js` ships with `url: ''` and `key: ''`, so on GitHub Pages "Host a world" only reaches another tab in the same browser. The headline social feature is broken for real users. | `config.js` | Critical |
| 2 | **The journal is lost.** `start()` resets `E = new Map()`; thoughts, moods and the "private note, just for you" are never saved. A refresh or "Play again" erases them. For a reflection app this is a trust failure. | `index.html` `start()`, `submit()` | Critical |
| 3 | **Islands go off-screen (Thought mode).** The camera never follows sideways (`translate(W/2, …)`), and moving islands reach x = ±313 world units, but a phone shows only ±229 to ±260. On a 320px phone, 21 of 89 moving islands carry the landing spot itself off-screen. This is the "partially visible" bug. | measured: 320×568, 360×740, 390×844 | High |
| 4 | **Dodge difficulty depends on screen width.** Obstacles move in raw pixels/sec, so reaction time at top speed is **0.43 s on a 320px phone, 0.53 s at 390px, 1.95 s on a 1440px laptop**. "Fast" obstacles: 0.30 s on small phones. Phones (your main audience) get a game ~4× harder than desktop. | `dist()`, `spd()`, `DPX()` | High |
| 5 | **HUD overlaps the play area.** The `#cnt` line (hearts + ⛰ + ⭐ + combo + ✨ + 💭) wraps on narrow phones and covers the mission text drawn at `SAT()+74` and the top lane in 2-player Dodge (players can rise to `H*.06`). | `#hud`, `drawMissions()`, `dstep()` | Medium |
| 6 | **The questions are limited.** 36 hardcoded English prompts (3 tiers × 12), and you only get one **every 20 islands**. With crumbling islands and 3 hearts most runs see one or two prompts. The thing the app is named after is the rarest event in it. | `QP`, `land()` (`j%20===0`) | High (product) |
| 7 | **Rooms are guessable and unauthenticated.** 20 stems × 90 numbers = 1,800 codes. Anyone can join any code; a third client in a room is treated as the partner. Deep prompts ("A fear you rarely admit") are broadcast to whoever is in the room. | `genCode()`, `onMsg()` | Medium (High if you go social) |
| 8 | **About a third of the file is dead code.** Run mode (`startRun`, `runFrame`, `rgen` …) is never called. Foes are disabled (`foeInfo` starts with `return null`), so `bonk`, `drawSword`, boss logic and the "A grumble! Tap to swing" hint never run. The slingshot `aim`/`charged` input is never enabled. `PROMPTS` is unused. `apkUrl` points at an APK build that was removed. | grep: `startRun(` 1 hit (its definition) | Medium (it slows every change) |
| 9 | **Hard to maintain.** One 530-line, minified-style file, no tests and no build. Every feature below costs more than it should until this is split up. | `index.html` | Medium |

## Why would anyone use this? (honest)

**Today: mostly they wouldn't, past one session.** There is no persistence, no progression across days, no reason to return, and multiplayer is off. Dodge mode is a generic endless runner competing with thousands of better-funded ones; it adds nothing distinctive.

**What could make people use it:** the emotional hook of *your words becoming a living garden*, shared with people you care about. The closest real competitor is **Finch** (self-care pet + reflection + friends, millions of users). Finch wins on persistence and gentle daily habit, not on gameplay. Your edge would be a **shared, visual garden of words**, which Finch does not do well.

**Is it a good idea?** The kernel is yes. The current product is no, because it is two apps fighting each other:
- People who want to reflect do not want to lose a heart because an island crumbled while they were thinking.
- People who want an arcade game skip the prompts.

Pick reflection. Keep the hopping as the gentle, no-fail way you move between thoughts.

## Features ranked by how much they bring in other people

1. **Shareable invite link instead of typed codes.** `…/plant-a-thought/?room=MOSS-42` plus the Web Share API button ("Send to WhatsApp"). Typing a code is a big drop-off point. Cheap.
2. **Daily shared prompt + daily seed (the Wordle loop).** Everyone gets the same question and the same island layout today. At the end: a share card (emoji summary + your flower, never your words unless you choose). This is the main growth engine: one share brings in people who were not invited.
3. **Async shared gardens (most important).** A garden link for a couple, friend group, family, class or team. Each person plants when they want; the garden grows over days. Real-time 2-player needs both people online at the same moment, which is why it will never take off. Needs a Supabase table (garden, author, word, mood, day), not just Broadcast.
4. **Persistent personal garden and journal.** Save locally first (`localStorage`/IndexedDB), with export. Gentle streaks ("your garden has 12 flowers"), never punishing ones.
5. **Group rooms of 3 to 30 with a host.** Unlocks real use cases: classroom SEL check-ins, team retros and stand-ups, therapy and support groups, family check-ins. The host chooses the prompt pack and whether answers are anonymous. This is the only plausible path to revenue (schools, teams).
6. **Prompt packs and community prompts.** Fixes "questions are limited": packs (Gratitude, Couples, Team retro, Kids, Exam stress), languages (Hindi and English first), and user-submitted prompts with moderation.
7. **Calm mode (no-fail).** No crumbling, no hearts. Prompt every 3 to 5 islands, not 20. Make it the default.
8. **"Water a friend's flower" reactions.** A one-tap kindness reaction on someone's thought in a shared garden. Low effort, high warmth, no comment threads to moderate.

## What I would cut

- **Dodge mode**, or demote it to a side mini-game. It dilutes the identity and it is the buggiest mode on phones.
- **All dead code** (Run mode, foes, slingshot, `PROMPTS`, `apkUrl`).
- **Score, combos and missions** in the reflection mode. They teach players that thoughts are obstacles between points.

## Risks you must take seriously before going social

- **Mental-health prompts plus strangers is dangerous.** If someone writes something alarming, you need crisis resources on screen and a report/block path. Keep deep prompts (tier 3) private by default; only share light ones.
- **Kids and schools** bring COPPA/GDPR-K obligations (no personal data from under-13s without consent).
- **Moderation costs money and time.** A public "world garden" of strangers' words will get abuse on day one. Start with private, invite-only gardens.
- **Supabase anon key in the client** is fine for Broadcast, but once you store gardens you need Row Level Security on every table.

## Suggested order of work

1. Turn on Supabase in `config.js` (or say clearly in the UI that online play is off).
2. Persist the journal locally.
3. Fix island clipping (follow the player sideways, or clamp `x + m + hw` to the visible width).
4. Make Dodge speed relative to screen width (seconds-to-reach, not pixels/sec).
5. Delete the dead code; split `index.html` into modules.
6. Calm mode + prompts every few islands + more prompts.
7. Invite links + Web Share.
8. Daily prompt + share card.
9. Async shared gardens (Supabase table + RLS).
10. Group rooms with host and prompt packs.
