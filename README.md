# 🎁 Birthday Gift Registry

A gift registry for a 35th birthday, built with Vite and a small Express server.

- Guests see the gifts (R200–R500, with estimated prices and where to buy them).
- A guest picks a gift and enters their name. The gift then **disappears** from the public list.
- Every pick is saved to `picks.csv` with: date, guest name, gift, category, estimated price and shop.
- Only the **admin page** (`/admin`, password protected) shows who picked what. The CSV is downloaded from there too.
- The admin page can **Release** a pick to put the gift back on the list.

## Personalise it

- Name, age, party date and message: [`src/config.js`](src/config.js)
- Gift list and prices: [`data/gifts.json`](data/gifts.json). Each gift needs a unique `id`.

## Run it locally

```bash
npm install
npm run dev
```

- Guest page: http://localhost:5173
- Admin page: http://localhost:5173/admin.html. The local default password is `changeme`.

## Host it online (Render)

The server writes picks to a file, so the host needs a **persistent disk**. Static-only hosts such as Netlify, Vercel or GitHub Pages will not work.

1. Push this repo to GitHub.
2. On [render.com](https://render.com), go to **New → Web Service** and connect this repo.
3. Use these settings:
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
4. Add these **Environment variables**:
   - `ADMIN_PASSWORD`: choose a strong password.
   - `DATA_DIR`: `/var/data`
5. Under **Disks**, add a disk mounted at `/var/data` (1 GB is plenty). Disks need a paid instance. On the free plan, picks are wiped whenever the service restarts.
6. Share the site URL with guests. Open `https://your-site.onrender.com/admin` for the admin page.

Railway or Fly.io also work. Use the same commands, and mount a volume at the folder you set as `DATA_DIR`.

## Privacy

`data/picks.json` and `data/picks.csv` contain guest names. They are in `.gitignore` so they never reach this public repo.

## Gift prices

Prices were checked online in October 2026 at Yuppiechef, Dis-Chem, Clicks, Typo and Woolworths. Items marked "Estimate" in `gifts.json` are approximate. Prices change, so the site labels them "approx.".
