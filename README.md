# 🎁 Birthday Gift Registry

A gift registry for a 35th birthday, built with Vite and hosted on Vercel.

- Guests see 32 gifts between R200 and R500. Each gift has a shop photo, a price and a "View in shop" link.
- A guest picks a gift and enters their name, and the gift **disappears** from the public list.
- Only the **admin page** (`/admin`, password protected) shows who picked what. **Download CSV** there gives a spreadsheet with the date, guest name, gift, category, price, shop and link.
- The admin page can **Release** a pick to put that gift back on the list.

## Personalise it

- Her name, age, party date and message: [`src/config.js`](src/config.js)
- The gift list: [`data/gifts.js`](data/gifts.js). Each gift needs a unique `id`.

## Deploy to Vercel

Vercel doesn't keep saved files, so picks are stored in a free **Upstash Redis** database.

1. Go to [vercel.com/new](https://vercel.com/new), sign in with GitHub, and **Import** this repo. Vercel detects Vite on its own, so leave the build settings as they are.
2. Before clicking Deploy, open **Environment Variables** and add `ADMIN_PASSWORD` with a strong password.
3. Click **Deploy**.
4. In the project, go to **Storage → Create Database → Upstash (Redis)**. Choose the free plan and connect it to the project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you.
5. Go to **Deployments → ⋯ → Redeploy** so the site picks up the database.
6. Share `https://<your-project>.vercel.app` with guests. Open `/admin` for the admin page.

Each later push to `main` redeploys the site on its own.

## Run it locally

```bash
npm install
npm run dev
```

- Guest page: http://localhost:5173
- Admin page: http://localhost:5173/admin.html. The local default password is `changeme`.

Locally, picks are saved to `data/picks.json` and `data/picks.csv`. Those files are in `.gitignore`, so guest names never reach this public repo.

## How it's built

- `index.html`, `admin.html`, `src/`: the Vite front end.
- `api/`: Vercel serverless functions. Each one points to a handler in `lib/handlers.js`.
- `lib/store.js`: saves picks to Redis when a database is connected, or to a local file otherwise.
- `server.js`: local Express server that runs the same handlers.

## Gift prices and photos

Prices, photos and links were taken from CUM Books, Dis-Chem and Yuppiechef in October 2026. Prices change, so the site labels them "approx.". The photos load from the shops' own servers. If a shop removes a photo, that card shows a category emoji instead.
