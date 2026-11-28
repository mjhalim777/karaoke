# 🎤 Karaoke

A free karaoke system that runs on **GitHub Pages**: no server of your own needed.

- **TV screen** (`tv.html`): open it on the smart TV browser. It plays karaoke videos from YouTube, moves to the next song by itself, and shows a room code and a QR code.
- **Phone remote** (`remote.html`): scan the QR code (or type the room code), search for songs, add them with your name, reorder or remove them, and press Skip, Pause or Play.

The TV and the phones talk to each other through **Firebase Realtime Database** (free tier). Song search uses the **YouTube Data API**. Both are set up in one file: `config.js`.

> **Demo mode:** if `config.js` is left empty, the site still works, but only between tabs of the *same browser on one computer*. That's handy for trying it out. To use real phones with a real TV, finish step 1 below.

Final addresses (after step 3):

- TV: https://mjhalim777.github.io/karaoke/tv
- Phone: https://mjhalim777.github.io/karaoke/remote
- Home page: https://mjhalim777.github.io/karaoke/

---

## Step 1: Set up Firebase (free, about 10 minutes)

Firebase is what lets a phone add a song and have it show up on the TV.

1. Go to https://console.firebase.google.com and sign in with a Google account.
2. Click **Create a project** (or **Add project**). Name it, for example `karaoke`. You can turn **off** Google Analytics. Click **Create project**, then **Continue**.
3. In the left menu, open **Build → Realtime Database** and click **Create Database**.
   - Pick a location (for the Philippines, **Singapore (asia-southeast1)** is closest).
   - Choose **Start in locked mode** and click **Enable**. You will paste proper rules in a moment.
4. Still in Realtime Database, open the **Rules** tab, replace everything with this, and click **Publish**:

   ```json
   {
     "rules": {
       ".read": false,
       ".write": false,
       "rooms": {
         "$code": {
           ".read": "$code.matches(/^[A-HJ-NP-Z2-9]{4}$/)",
           ".write": "$code.matches(/^[A-HJ-NP-Z2-9]{4}$/)"
         }
       },
       "stats": {
         ".read": true,
         "searches": {
           "$day": {
             ".write": "$day.matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)",
             ".validate": "newData.isNumber() && newData.val() === (data.exists() ? data.val() + 1 : 1)"
           }
         },
         "online": {
           "$id": {
             ".write": true,
             ".validate": "newData.val() === 'tv' || newData.val() === 'phone'"
           }
         }
       }
     }
   }
   ```

   What this means: anyone who knows a room code can read and change *that room* (that's how phones join without accounts). Nobody can list all rooms or write anywhere else. Don't use "test mode" rules: they open the whole database and stop working after 30 days.

5. Go to **Project Overview** (house icon, top left) → click the **web icon `</>`** ("Add app"). Give it a nickname such as `karaoke-web`. Leave "Firebase Hosting" **unchecked**. Click **Register app**.
6. Firebase now shows a block of code with `const firebaseConfig = { ... }`. Copy the values into `config.js`, inside `window.FIREBASE_CONFIG`:

   ```js
   window.FIREBASE_CONFIG = {
     apiKey: "AIza...",
     authDomain: "karaoke-xxxx.firebaseapp.com",
     databaseURL: "https://karaoke-xxxx-default-rtdb.asia-southeast1.firebasedatabase.app",
     projectId: "karaoke-xxxx",
     storageBucket: "karaoke-xxxx.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```

   **`databaseURL` is required.** If it's missing from the copied code, copy it from the top of the **Realtime Database → Data** tab (it looks like the example above, and depends on the location you picked).

The Firebase `apiKey` is *not* a secret. It's meant to be in web pages; the rules from step 4 are what protect the data.

Old rooms stay in the database. That's fine (the free tier has 1 GB), but you can delete them any time in **Realtime Database → Data** by hovering over `rooms` and clicking the trash icon.

## Step 2: YouTube search key (optional, about 5 minutes)

Without a key, phones can still add songs by **pasting a YouTube link** (in the YouTube app: Share → Copy link). With a key, phones get a search box that adds "karaoke" to every search.

1. Go to https://console.cloud.google.com and sign in. At the top, select your Firebase project (Firebase projects are also Google Cloud projects) or create a new one.
2. Open **APIs & Services → Library**, search **YouTube Data API v3**, click it, then click **Enable**.
3. Open **APIs & Services → Credentials → Create credentials → API key**. Copy the key.
4. Paste it into `config.js`:

   ```js
   window.YOUTUBE_API_KEY = "AIza...";
   ```

5. **Important: restrict the key.** Once the site is online, anyone can see this key in the page source. Click the key's name in **Credentials** and:
   - Under **Application restrictions**, choose **Websites (HTTP referrers)** and add:
     - `https://mjhalim777.github.io/*`
     - `http://localhost:8000/*` (only if you want search to work while testing on your computer)
   - Under **API restrictions**, choose **Restrict key** and tick only **YouTube Data API v3**.
   - Click **Save**. (It can take a few minutes to take effect.)

**Daily limit:** the free quota is 10,000 units a day and each search costs 100, so about **100 searches per day**. That's plenty for a party. If search stops working, pasting links still works, and the quota resets at midnight Pacific time.

## Step 3: Put it online with GitHub Pages

1. Commit and push your changes (including `config.js`) to the `main` branch of https://github.com/mjhalim777/karaoke.
2. On GitHub, open the repo → **Settings** → **Pages** (left menu).
3. Under **Build and deployment**: **Source** = **Deploy from a branch**, **Branch** = **main**, folder **/ (root)**. Click **Save**.
4. Wait 1–2 minutes. The page shows "Your site is live at https://mjhalim777.github.io/karaoke/".

## Using it

1. On the TV browser, open **https://mjhalim777.github.io/karaoke/tv** and press **Start** (OK on the remote). Browsers only allow sound after a press, and this also switches to fullscreen.
2. On your phone, scan the QR code on the TV (or open `remote.html` and type the 4-letter room code).
3. Type your name, search for a song, and tap **Add**. The TV starts playing it, and when a song ends the next one starts automatically.
4. The **Queue** tab lets you move songs up or down (▲ ▼) or remove them (✕). ⏸ / ▶ pauses and plays, ⏭ skips.

The TV remembers its room code when refreshed. To get a fresh code, use "Make a new room code" on the TV start screen.

Some videos don't allow playing on other websites. The TV shows a message and skips them automatically.

## Testing on your computer

You need any simple web server (opening the file directly with `file://` won't work with YouTube). With Python installed:

```powershell
python -m http.server 8000
```

Then open http://localhost:8000/tv.html in one tab and http://localhost:8000/remote.html in another. With `config.js` empty, this runs in demo mode (tabs in the same browser only).

## Files

| File | What it does |
|---|---|
| `index.html` | Home page with links to the TV and phone pages |
| `tv.html`, `js/tv.js`, `css/tv.css` | TV screen |
| `remote.html`, `js/remote.js`, `css/remote.css` | Phone remote |
| `js/sync.js` | Talks to Firebase (or demo mode) |
| `config.js` | Your Firebase settings and YouTube key |

## Usage page

`usage.html` shows how much of each free limit is used: YouTube searches today (out of ~100/day) and devices connected to Firebase right now (out of 100). The TV and phone pages write these counts under `stats/` in the database, which the rules above allow.
