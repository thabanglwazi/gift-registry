import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = import.meta.dirname;
const PORT = process.env.PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
// Picks live in DATA_DIR so a host can mount a persistent disk there
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const PICKS_JSON = path.join(DATA_DIR, 'picks.json');
const PICKS_CSV = path.join(DATA_DIR, 'picks.csv');

const gifts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'gifts.json'), 'utf8'));
const giftById = new Map(gifts.map((g) => [g.id, g]));

fs.mkdirSync(DATA_DIR, { recursive: true });
let picks = fs.existsSync(PICKS_JSON) ? JSON.parse(fs.readFileSync(PICKS_JSON, 'utf8')) : [];

const CSV_HEADER = ['Picked At', 'Guest Name', 'Gift', 'Category', 'Estimated Price (R)', 'Where To Buy'];

function csvCell(value) {
  let s = String(value ?? '');
  // Stop spreadsheet apps from treating a guest's name as a formula
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv() {
  const rows = picks.map((p) => [p.pickedAt, p.guestName, p.giftName, p.category, p.price, p.retailer]);
  return [CSV_HEADER, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

function save() {
  fs.writeFileSync(PICKS_JSON, JSON.stringify(picks, null, 2));
  fs.writeFileSync(PICKS_CSV, toCsv());
}
save();

function requireAdmin(req, res, next) {
  const given = Buffer.from(String(req.get('x-admin-password') || req.query.key || ''));
  const expected = Buffer.from(ADMIN_PASSWORD);
  if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) return next();
  res.status(401).json({ error: 'Wrong admin password' });
}

const app = express();
app.use(express.json({ limit: '10kb' }));

// Guests only ever see gifts nobody has picked yet
app.get('/api/gifts', (req, res) => {
  const taken = new Set(picks.map((p) => p.giftId));
  res.json(gifts.filter((g) => !taken.has(g.id)));
});

app.post('/api/pick', (req, res) => {
  const giftId = String(req.body?.giftId || '');
  const guestName = String(req.body?.name || '').trim().replace(/\s+/g, ' ');
  const gift = giftById.get(giftId);

  if (!gift) return res.status(404).json({ error: 'That gift does not exist.' });
  if (guestName.length < 2 || guestName.length > 80) {
    return res.status(400).json({ error: 'Please enter your name (2–80 characters).' });
  }
  if (picks.some((p) => p.giftId === giftId)) {
    return res.status(409).json({ error: 'Someone has just picked this gift. Please choose another one.' });
  }

  picks.push({
    id: crypto.randomUUID(),
    giftId,
    giftName: gift.name,
    category: gift.category,
    price: gift.price,
    retailer: gift.retailer,
    guestName,
    pickedAt: new Date().toISOString(),
  });
  save();
  res.status(201).json({ ok: true, gift: gift.name });
});

app.get('/api/admin/picks', requireAdmin, (req, res) => {
  const taken = new Set(picks.map((p) => p.giftId));
  res.json({ picks, total: gifts.length, available: gifts.filter((g) => !taken.has(g.id)).length });
});

app.get('/api/admin/picks.csv', requireAdmin, (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="gift-picks.csv"');
  res.send('﻿' + toCsv()); // BOM so Excel reads names with accents correctly
});

// Puts a gift back on the public list (e.g. a guest changed their mind)
app.delete('/api/admin/picks/:id', requireAdmin, (req, res) => {
  const before = picks.length;
  picks = picks.filter((p) => p.id !== req.params.id);
  if (picks.length === before) return res.status(404).json({ error: 'Pick not found' });
  save();
  res.json({ ok: true });
});

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(ROOT, 'dist');
  app.use(express.static(dist));
  app.get('/admin', (req, res) => res.sendFile(path.join(dist, 'admin.html')));
}

app.listen(PORT, () => {
  console.log(`Gift registry API on http://localhost:${PORT}`);
  if (ADMIN_PASSWORD === 'changeme') console.warn('⚠️  Set ADMIN_PASSWORD before going live.');
});
