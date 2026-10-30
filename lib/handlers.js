// API handlers shared by the Vercel functions in /api and the local Express server.
import crypto from 'node:crypto';
import gifts from '../data/gifts.js';
import { store } from './store.js';
import { toCsv } from './csv.js';

const giftById = new Map(gifts.map((g) => [g.id, g]));

function isAdmin(req) {
  const expected = Buffer.from(process.env.ADMIN_PASSWORD || 'changeme');
  const given = Buffer.from(String(req.headers['x-admin-password'] || ''));
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

function onlyMethods(req, res, methods) {
  if (methods.includes(req.method)) return true;
  res.setHeader('Allow', methods.join(', '));
  res.status(405).json({ error: 'Method not allowed' });
  return false;
}

// Guests only ever see gifts nobody has picked yet
export async function listGifts(req, res) {
  if (!onlyMethods(req, res, ['GET'])) return;
  const taken = new Set((await store.list()).map((p) => p.giftId));
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(gifts.filter((g) => !taken.has(g.id)));
}

export async function pickGift(req, res) {
  if (!onlyMethods(req, res, ['POST'])) return;
  const giftId = String(req.body?.giftId || '');
  const guestName = String(req.body?.name || '').trim().replace(/\s+/g, ' ');
  const gift = giftById.get(giftId);

  if (!gift) return res.status(404).json({ error: 'That gift does not exist.' });
  if (guestName.length < 2 || guestName.length > 80) {
    return res.status(400).json({ error: 'Please enter your name (2–80 characters).' });
  }

  const claimed = await store.claim({
    giftId,
    giftName: gift.name,
    category: gift.category,
    price: gift.price,
    retailer: gift.retailer,
    url: gift.url,
    guestName,
    pickedAt: new Date().toISOString(),
  });
  if (!claimed) {
    return res.status(409).json({ error: 'Someone has just picked this gift. Please choose another one.' });
  }
  res.status(201).json({ ok: true, gift: gift.name });
}

// GET: who picked what. DELETE ?giftId=…: put a gift back on the public list.
export async function adminPicks(req, res) {
  if (!onlyMethods(req, res, ['GET', 'DELETE'])) return;
  if (!isAdmin(req)) return res.status(401).json({ error: 'Wrong admin password' });
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'DELETE') {
    const released = await store.release(String(req.query.giftId || ''));
    return released ? res.status(200).json({ ok: true }) : res.status(404).json({ error: 'Pick not found' });
  }
  const picks = await store.list();
  res.status(200).json({ picks, total: gifts.length, available: gifts.length - picks.length });
}

export async function adminCsv(req, res) {
  if (!onlyMethods(req, res, ['GET'])) return;
  if (!isAdmin(req)) return res.status(401).json({ error: 'Wrong admin password' });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="gift-picks.csv"');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send('﻿' + toCsv(await store.list())); // BOM so Excel reads names correctly
}
