# Plant a Thought 🌱

A cozy hopping game. **Thought mode** is calm: land on an island, plant a word, grow a world.
**Dodge mode** is the challenge: hop over what your animal hates, climb ledges, grab power-ups.
Play solo, or with a friend using a 4-letter room code like `MOSS-42`.

- **Play:** https://itsharshhy.github.io/plant-a-thought/ on any phone, tablet or computer.
- **Install it like an app:** tap **📲 Install the game** on the home screen (Android, Chrome, Edge).
  On iPhone/iPad: open it in Safari, tap **Share**, then **Add to Home Screen**. It works offline after the first visit.

## Set up (about 10 minutes)

### 1. Two-player online (Supabase)
1. Create a free project at supabase.com.
2. Open **Project Settings > API**. Copy the **Project URL** and the **anon public** key.
3. Paste them into `config.js` (`url` and `key`). Never use the `service_role` key.

No tables are needed. Rooms use Supabase Realtime *Broadcast*, which has no database.
Without these two values the game still works, but rooms only connect tabs in one browser.

### 2. Web version (GitHub Pages)
Settings > Pages > **Deploy from a branch** > `main` / `(root)` > Save.
Your game is then at `https://YOUR-USERNAME.github.io/YOUR-REPO/`.

### 3. Installable app (PWA)
Nothing to set up. `manifest.webmanifest` and `sw.js` make the web version installable and playable offline.

## Run locally
    python3 -m http.server 8080   # then open http://localhost:8080

## Files
`index.html` the whole game, `config.js` your settings, `vendor/supabase.js` the realtime client,
`icons/` app icons, `manifest.webmanifest` + `sw.js` the installable app (PWA).
