# Plant a Thought 🌱

A cozy hopping game. **Thought mode** is calm: land on an island, plant a word, grow a world.
**Dodge mode** is the challenge: hop over what your animal hates, climb ledges, grab power-ups.
Play solo, or with a friend using a 4-letter room code like `MOSS-42`.

- **Android:** download the APK from the [latest release](../../releases/latest).
- **iPhone, Mac, Windows, Linux:** play in the browser (GitHub Pages link in the repo's About box).

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

### 3. Android APK
1. In `config.js`, set `apkUrl` to
   `https://github.com/YOUR-USERNAME/YOUR-REPO/releases/latest/download/PlantAThought.apk`
   (this makes a download button appear for Android visitors on the web version).
2. Go to **Releases > Draft a new release**, create the tag `v1.0.0`, and publish.
3. The **Build Android APK** action runs (about 5 to 10 minutes) and attaches `PlantAThought.apk` to the release.
4. On the phone: download the APK, open it, and allow "Install unknown apps" for your browser when asked.

The APK is debug-signed, which is fine for sharing directly. For the Play Store you would add a release signing key.

## Run locally
    python3 -m http.server 8080   # then open http://localhost:8080

## Files
`index.html` the whole game, `config.js` your settings, `vendor/supabase.js` the realtime client,
`icons/` and `assets/` app icons, `capacitor.config.json` + `package.json` + `.github/workflows/android.yml` the Android build.
