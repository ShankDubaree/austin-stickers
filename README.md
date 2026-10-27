# Austin's Stickers

A calm, ADHD-friendly digital sticker chart for Austin (Year 2).

- **Kid view (default):** read-only weekly chart — big stickers, soft colours, large tap targets for Amazon Fire (Silk).
- **Parent mode (iPhone):** unlock with a 4-digit PIN to award or undo stickers. Only Dad awards stickers.

Live URL (GitHub Pages): **https://shankdubaree.github.io/austin-stickers/**

## Categories

| Category | When |
|---|---|
| Brush teeth | Morning + evening, every day |
| Sleep in own bed | One sticker per night |
| Homework | School nights Mon–Thu |
| Poop | As needed (award one star at a time, with undo) |

Weeks use **ISO weeks** in **Europe/London**. Browse past weeks with Prev / Next.

## Quick start

1. On **Dad's iPhone**, open the live URL → **Create family** → note the 6-character family code.
2. On **Austin's Fire tablet**, open the same URL → **Join family** → enter the code.
3. On the phone: tap **Parent** → enter PIN (default **`1234`**) → award stickers.
4. On the tablet: leave it on the kid chart; stickers appear within about half a minute while the tab is visible (live sync).

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
