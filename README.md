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
4. On the tablet: leave it on the kid chart; stickers appear within a few seconds (live sync).

## Parent PIN

- Default PIN: **`1234`**
- Change it in Parent mode → Settings → New PIN → Save PIN.
- The PIN is stored in the synced family data (all devices share it).

## Family sync

Sync uses a free JSON REST store ([crudcrud.com](https://crudcrud.com)) with a short **family code**.

- Create family → generates a code and a cloud document.
- Join family → both devices share that document.
- Parent awards push immediately; the tablet **polls every ~4 seconds**.
- Offline: each device keeps a **localStorage** cache and syncs when back online.

**Note:** crudcrud endpoints go idle after ~24 hours with *no* traffic. Daily use keeps the family data alive. If sync ever 404s after a long break, create a new family on the phone and re-join on the tablet (or contact Dad to share a fresh code).

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
