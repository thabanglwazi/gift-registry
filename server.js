// Local server: runs the same API as the Vercel functions in /api.
// `npm run dev` pairs it with Vite; `npm start` also serves the built site.
import express from 'express';
import path from 'node:path';
import { listGifts, pickGift, adminPicks, adminCsv, adminGifts, manageGifts } from './lib/handlers.js';

const PORT = process.env.PORT || 3001;
const app = express();
app.use(express.json({ limit: '10kb' }));

// Express 4 doesn't catch async errors, so turn them into a 500 instead of a crash
const safe = (handler) => (req, res) =>
  handler(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

app.all('/api/gifts', safe(listGifts));
app.all('/api/pick', safe(pickGift));
app.all('/api/admin/picks', safe(adminPicks));
app.all('/api/admin/csv', safe(adminCsv));
app.all('/api/admin/gifts', safe(adminGifts));
app.all('/api/manage', safe(manageGifts));

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(import.meta.dirname, 'dist');
  app.use(express.static(dist));
  app.get('/admin', (req, res) => res.sendFile(path.join(dist, 'admin.html')));
  app.get('/manage', (req, res) => res.sendFile(path.join(dist, 'manage.html')));
}

app.listen(PORT, () => {
  console.log(`Gift registry API on http://localhost:${PORT}`);
  if (!process.env.ADMIN_PASSWORD) console.warn('⚠️  Using the default admin password "changeme".');
});
