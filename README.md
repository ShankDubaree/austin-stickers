# Austin's Stickers

A calm, ADHD-friendly digital sticker chart for Austin (Year 2).

- **Kid view (default):** read-only current-week chart — sea-creature stickers, golden puffer progress to 20, Spider-Man colours, Fire-tablet-friendly.
- **Parent mode (iPhone):** unlock with a 4-digit PIN to award or undo stickers. Only Dad awards stickers.

Live URL (GitHub Pages): **https://shankdubaree.github.io/austin-stickers/**

## Categories

| Category | When |
|---|---|
| Sleep in own bed | One sticker per night |
| Brush Teeth | Morning + evening, every day |
| Toilet | As needed (award one at a time, with undo). Stored as `poop` in sync data. |
| Homework | School nights Mon–Thu |

Filled sticker slots show **sea creatures** (same set as the homework app). Kid view always shows the **current week** (Europe/London ISO week) with a big golden puffer fish progress of **total / 20**. Parent mode can still browse weeks to adjust.

## Quick start

1. On **Dad's iPhone**, open the live URL → **Create family** → note the 6-character family code.
2. In **Parent mode**, copy **Austin’s tablet link** (includes `kid.html?family=…&id=…`).
3. On **Austin's Fire tablet**, open that dedicated link (view-only — no join/PIN). Pin it to the home screen.
4. On the phone: tap **Parent** → enter PIN → award stickers.
5. On the tablet: leave `kid.html` open; stickers poll about every 45s while visible. At **20/20** the prize wheel unlocks (one spin per week; wins sync into the prize log).

Main app: **https://shankdubaree.github.io/austin-stickers/**  
Kid (tablet) example: **https://shankdubaree.github.io/austin-stickers/kid.html?family=CODE&id=REMOTE_ID**

## Parent PIN

- Default PIN: **`1234`**
- Change it in Parent mode → Settings → New PIN → Save PIN.
- The PIN is stored in the synced family data (all devices share it).

## Family sync

Sync uses [restful-api.dev](https://restful-api.dev) (`https://api.restful-api.dev/objects`) — a free JSON REST API with CORS enabled from the GitHub Pages origin (Chrome and Safari/iPhone).

- **Create family** → generates a 6-character code, `POST`s a `fam-CODE` object, and registers the code in a small index object so other devices can find it.
- **Join family** → looks up the code in the index, then loads that object.
- Parent awards **push immediately** (`PUT`).
- Devices **poll about every 25 seconds**, and **only while the page is visible** (background tabs pause) to stay within the free tier.
- Offline: each device keeps a **localStorage** cache and syncs when back online.

### Free-tier limits (important)

Public restful-api.dev allows roughly **50 requests per day per client IP** (about 100/day with an API key). Phone and tablet on the same home Wi‑Fi share that budget.

Typical daily use (create/join once, a handful of awards, tablet open for sticker time with 25s visible polling) should fit. If sync starts failing after heavy use, wait for the daily reset, leave the tablet tab in the background when not needed, or create/join again the next day if an object was lost.

This replaced an earlier crudcrud.com backend, which was unreliable from browsers (expired keys often surfaced as CORS / “Failed to fetch”).

## Redeploy

```bash
npm install
npm run build
git push origin main
```

GitHub Actions builds with Vite (`base: /austin-stickers/`) and deploys `dist` to GitHub Pages.

## Local dev

```bash
npm install
npm run dev
```

## Design notes

- en-GB copy, Europe/London dates.
- Kid screen has **no** award/undo controls — view only.
- Celebration is CSS confetti (Silk-friendly; no required audio).
