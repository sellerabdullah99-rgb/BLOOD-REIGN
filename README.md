# BLOOD REIGN

Free Fire tournament + gear shop platform for Pakistan's gaming community.
Plain HTML/CSS/JS frontend, Supabase backend (Postgres + Auth + RLS).

## Folder structure

```
blood-reign/
├── index.html              ← app shell, loads everything below
├── css/
│   ├── tokens.css          ← brand colors + design tokens (edit colors here)
│   ├── base.css             ← reset + utility classes
│   ├── components.css      ← buttons, cards, badges, inputs, modals, toasts…
│   ├── layout.css           ← header, bottom nav / desktop nav, grids
│   ├── screens.css          ← per-tab styles (hero, tournament cards, podium…)
│   ├── animations.css       ← keyframes
│   └── responsive.css      ← breakpoint fine-tuning
├── js/
│   ├── config.js            ← ⚠️ put your Supabase URL + anon key here
│   ├── supabaseClient.js    ← creates the Supabase client (or falls back to demo mode)
│   ├── utils.js              ← formatting, toasts, localStorage helpers
│   ├── mockData.js           ← offline/demo content (mirrors seed.sql)
│   ├── guestStore.js         ← local coin economy used when not logged in / not configured
│   ├── teamStore.js          ← local team/roster/tryout/scrim sandbox (guest mode only)
│   ├── auth.js                ← sign up / log in / guest identity, one normalized profile
│   ├── data.js                ← ⭐ every tab calls this — routes to Supabase or local data
│   ├── ui.js                  ← modal system
│   ├── nav.js                 ← tab switching, hidden admin unlock
│   ├── home.js, tournaments.js, teams.js, scrims.js, tryouts.js,
│   │   shop.js, coins.js, leaderboard.js, profile.js, admin.js
│   └── main.js                ← boots the app
├── assets/icons/             ← put a favicon / app icon here if you want one
└── supabase/
    ├── schema.sql             ← run 1st — core tables
    ├── policies.sql            ← run 2nd — Row Level Security
    ├── functions.sql           ← run 3rd — secure coin/tournament RPCs
    ├── seed.sql                ← run 4th (optional) — sample tournaments/products
    ├── teams_schema.sql        ← run 5th — teams, rosters, tryouts, scrims tables
    ├── teams_policies.sql      ← run 6th — RLS for the above
    └── teams_functions.sql     ← run 7th — create_team / register_team / respond_to_tryout RPCs
```

There's **no separate backend/server folder** — Supabase is a backend-as-a-service.
The frontend talks to it directly through the JS client, and Postgres Row Level
Security (not a server you write) is what keeps it safe to expose publicly.

## Setup (5 minutes)

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase dashboard, open **SQL Editor** and run, in order:
   `schema.sql` → `policies.sql` → `functions.sql` → `seed.sql` →
   `teams_schema.sql` → `teams_policies.sql` → `teams_functions.sql`.
3. Go to **Project Settings → API** and copy your **Project URL** and **anon public key**.
4. Paste them into `js/config.js`:
   ```js
   SUPABASE_URL: 'https://xxxxxxxxxxxx.supabase.co',
   SUPABASE_ANON_KEY: 'eyJhbGciOi...',
   ```
5. Also set `WHATSAPP_NUMBER` in the same file to your real WhatsApp Business number.
6. Open `index.html` in a browser (or deploy the folder anywhere static — Netlify,
   Vercel, GitHub Pages, or your own hosting).

**Without step 4**, the app still runs fully — it silently falls back to local
demo data and a per-browser guest coin wallet, so you (or anyone testing it)
can open `index.html` directly with nothing configured.

## Teams & rosters

- Any signed-in player can create **one team** from Profile → My Team, filling
  in a roster of Free Fire squad roles (**IGL, Rusher, Assaulter, Sniper**,
  plus Support/Substitute), capped at 6 to allow subs.
- Only that team's **captain** can add/remove roster members, post **tryouts**,
  and schedule **scrims** — enforced by RLS (`is_team_captain()`), not just the UI.
- Joining a **SOLO** tournament still uses the individual FF UID + username flow.
  Joining a **DUO/SQUAD** tournament now requires a team with enough roster
  members (2 for DUO, 4 for SQUAD) and freezes a roster snapshot at
  registration time, so later roster edits don't rewrite tournament history.
- **Tryouts**: a captain posts an open role; anyone can apply; accepting an
  application auto-adds that player to the roster and closes the tryout.
- **Scrims**: any captain can schedule a practice match (opponent, map, mode,
  time) visible to everyone; the host captain marks it complete or cancels it.
- **Known gap**: `getMyTeam()` currently only surfaces a team you *captain*.
  If you're recruited onto someone else's roster via a tryout, there's no
  "you're on Team X's roster" view in your own profile yet — the roster shows
  up on the team side, just not reflected back to the member's profile. A
  quick follow-up (a `getMyRosterMemberships()` query) would close this.

## Making yourself an admin

The footer logo, tapped 5× fast, opens a passcode prompt (default passcode:
`bloodreign2026`, change it in `config.js`). That only *reveals* the Admin tab —
it doesn't grant real write access. To actually manage tournaments/orders/coins
for real:

1. Sign up a real account in the app.
2. In Supabase: **Table Editor → profiles**, find your row, set `is_admin` to `true`.
3. Log out and back in. The Admin tab's write actions will now work — everything
   is still enforced by RLS policies, not by the passcode.

## Changing the logo / icons

Right now branding is a generated placeholder — a red "BR" shield built from
brand colors, no real logo file yet. When you have a real logo, here's every
place it needs to go:

| What | File | Notes |
|---|---|---|
| Header logo (top-left, in-app) | `index.html` — the `<i class="fa-solid fa-shield-halved">` next to "BLOOD REIGN" in the header/footer | Swap the `<i>` icon for an `<img src="assets/icons/logo.png">` once you have a real logo file |
| Browser tab favicon | `assets/icons/icon-192.png` | Replace the file directly (same filename), or update the `<link rel="icon">` path in `index.html` |
| Home screen / PWA install icon | `assets/icons/icon-192.png`, `assets/icons/icon-512.png`, `assets/icons/icon-512-maskable.png` | These are what shows when someone "Add to Home Screen"s the app. Recommended sizes: 192×192 and 512×512 PNG, square, transparent or brand-color background. The "maskable" one needs extra padding (~15%) around the edges since Android crops it into a circle/shape. |
| Social share preview image | `assets/icons/og-image.png` | Shown when the site link is shared on Discord/WhatsApp/Facebook. Recommended size: 1200×630 PNG. |
| `manifest.json` | Already points at the files above — no changes needed if you keep the same filenames. Just replace the PNGs. |

**Simplest path:** keep the exact same filenames (`icon-192.png`, `icon-512.png`,
`icon-512-maskable.png`, `og-image.png`) and just replace their contents —
nothing else in the code needs to change. If you want a different filename or
to add a proper `<img>` logo instead of the shield icon, paste your logo file
into this chat and it can be wired in directly.

## What's real vs. what's a placeholder

- **Real**: Supabase schema, RLS policies, secure coin-economy RPCs (can't be
  cheated by editing client JS), auth, orders, tournaments, leaderboard.
- **Placeholder you should customize**: Discord webhook URL + invite link, admin
  passcode, brand colors (all in `css/tokens.css`), logo/icons (see above), the
  "This Week" leaderboard (currently shows all-time totals; a true weekly reset
  needs a scheduled Supabase Edge Function or cron job, which isn't included).

## ⚠️ Pending: Rewarded Ads (Monetag)

The "Watch Ad" button in Coins tab currently just runs a 15-second honesty
timer before letting the player claim coins — **no real ad network is wired
up yet**. Adsterra's Popunder was tried and removed after it served a
scammy "your FB account was hacked" push notification. Next step: set up
**Monetag** (avoid their "Push Notifications" format specifically — that's
what caused the scam ad), then:

1. Get Monetag's ad script URL from their dashboard.
2. Paste it into `js/config.js` → `AD_NETWORK_SCRIPT_SRC`.
3. Load it at page load in `index.html` (right after `js/config.js` loads) —
   ask Claude to re-add this loader block when the Monetag script is ready.

## Notes for going further

- **Payments**: orders currently go out via Discord for manual confirmation —
  add a payment gateway (JazzCash/Easypaisa/Stripe) when ready.
- **Push notifications**: the bell icon is currently decorative; wire it to
  Supabase Realtime on the `announcements` table for live alerts.
- **Images**: product/tournament images are CSS gradients + icons right now to
  keep the app framework-free and fast; swap in real photos via Supabase Storage.
