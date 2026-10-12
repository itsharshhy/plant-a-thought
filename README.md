# Plant a Thought 🌱

A cozy hopping game where every answer you write grows into a flower, alone or with the people you care about.

**Play:** https://plant-a-thought.vercel.app (works on any phone or computer; install it from the home screen to play offline).

- **Calm walk** (default): no timers, no losing. A question every 5 islands.
- **Today’s question**: everyone gets the same question and the same islands each day. Share a card when you finish.
- **Climb**: islands crumble, flyers swoop, combos and missions. A question every 10 islands.
- **Dodge**: a quick arcade mini-game.
- **Play live with a friend**: room codes like `MOSS-4821` or an invite link. Deep answers stay private unless you choose to share.
- **Shared gardens & circles**: a private link for friends, family, a class or a team. Everyone plants whenever they like; flowers can be watered. Circles have a host who sets the question, can make it anonymous, pause it, or close it (which erases everything). Up to 30 people.
- **Journal**: every answer is kept on your device, viewable as a garden, exportable, deletable.
- **Question packs**: Everyday (light → deep), Friends, Couples, Team check-in, Kids & class, Exam season, plus Community questions. English and Hindi.
- **Safety**: if something you write sounds like you might be in danger, the app offers free helplines. Report and hide in shared gardens.

## Privacy
No accounts, ads, analytics or cookies. The journal and private notes never leave the device. Shared gardens store only what is planted in them; the device ID used to let you delete your own thoughts is stored hashed.

## Develop
```bash
npm install
cp .env.example .env.local   # add your Supabase URL + publishable key (optional for solo play)
npm run dev
npm test          # unit tests
npm run e2e       # end-to-end tests (builds and serves the app itself)
```
Without Supabase values the game still works; live rooms then only link tabs in one browser and gardens are off.

## Supabase
1. Create a project and run `supabase/migrations/*.sql` (SQL editor or `supabase db push`).
2. Put the project URL and publishable key in `.env.local` (and in Vercel environment variables).

**Approving community questions:** suggestions arrive in `prompt_suggestions` with `status = 'pending'`. In the Supabase table editor (or SQL) set `status` to `approved` or `rejected`. Approved ones appear in the Community pack for everyone.

## Deploy (Vercel)
Import the repo in Vercel (framework: Vite), add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, and deploy. Every push to `main` deploys to production; other branches get preview links.

If GitHub Pages was turned on for the old version, turn it off (Settings → Pages): the source `index.html` is no longer a runnable page by itself.

## Structure
See `CLAUDE.md` for the layout, and `docs/ANALYSIS.md` for the product review this version was built from.
