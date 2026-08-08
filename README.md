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
    ├── teams_functions.sql     ← run 7th — create_team / register_team / respond_to_tryout RPCs
    └── identity_and_registry.sql ← run 8th — IGN/role captured at signup + public "who's registered"
```

There's **no separate backend/server folder** — Supabase is a backend-as-a-service.
The frontend talks to it directly through the JS client, and Postgres Row Level
Security (not a server you write) is what keeps it safe to expose publicly.

## Setup (5 minutes)

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase dashboard, open **SQL Editor** and run, in order:
   `schema.sql` → `policies.sql` → `functions.sql` → `seed.sql` →
   `teams_schema.sql` → `teams_policies.sql` → `teams_functions.sql` →
   `identity_and_registry.sql`.
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

## Identity at signup

- Sign Up now asks for **username, IGN, Free Fire UID, and your role**
  (IGL / Rusher / Assaulter / Sniper / Support / Substitute) in one form —
  that identity exists the moment the account does, and pre-fills
  everywhere it's needed later (creating a team, applying to a tryout,
  joining a tournament). It can still be edited any time from
  Profile → Edit Profile.
- This is stored on `profiles.ign` / `profiles.primary_role` — added by
  `identity_and_registry.sql`, and populated automatically by the
  `handle_new_user` trigger from the signup form's metadata.

## Who's registered

- Every tournament card now has a **"View Registered Players / Teams"**
  button — SOLO tournaments list every player who joined (username + UID);
  DUO/SQUAD tournaments list every registered team with its frozen roster
  snapshot. This is public to everyone, not just admins.
- Scrims now has a **"Browse All Teams"** toggle so you can see every team
  on the platform and one-tap "Challenge to Scrim" (opponent name
  pre-filled) instead of typing it blind.
- Tryouts already showed which team posted each open slot — unchanged.
- In offline/demo mode this is backed by seed data in `mockData.js` (plus
  your own local guest registration/team, if any), since there's no shared
  backend to read from without Supabase connected.

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

## What's real vs. what's a placeholder

- **Real**: Supabase schema, RLS policies, secure coin-economy RPCs (can't be
  cheated by editing client JS), auth, orders, tournaments, leaderboard.
- **Placeholder you should customize**: WhatsApp number, admin passcode, brand
  colors (all in `css/tokens.css`), product images (currently icon placeholders —
  swap in real photos when you have them), the "This Week" leaderboard (currently
  shows all-time totals; a true weekly reset needs a scheduled Supabase Edge
  Function or cron job, which isn't included).

## Notes for going further

- **Payments**: orders currently go out via WhatsApp for manual confirmation —
  add a payment gateway (JazzCash/Easypaisa/Stripe) when ready.
- **Push notifications**: the bell icon is currently decorative; wire it to
  Supabase Realtime on the `announcements` table for live alerts.
- **Images**: product/tournament images are CSS gradients + icons right now to
  keep the app framework-free and fast; swap in real photos via Supabase Storage.
