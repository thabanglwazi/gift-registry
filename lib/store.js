// Where picks (and gifts removed from the list) are saved. On Vercel this is Upstash Redis (files don't persist
// there); locally it is data/picks.json plus a data/picks.csv copy.
import fs from 'node:fs';
import path from 'node:path';
import { Redis } from '@upstash/redis';
import { toCsv } from './csv.js';

const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'registry:picks'; // hash: giftId -> pick
const HIDDEN_KEY = 'registry:hidden'; // set of giftIds removed from the public list

function redisStore() {
  const redis = new Redis({ url: redisUrl, token: redisToken });
  return {
    async list() {
      const all = (await redis.hgetall(KEY)) || {};
      return Object.values(all).map((v) => (typeof v === 'string' ? JSON.parse(v) : v));
    },
    // HSETNX only writes if nobody has the gift yet, so two guests can't both get it
    async claim(pick) {
      return (await redis.hsetnx(KEY, pick.giftId, JSON.stringify(pick))) === 1;
    },
    async release(giftId) {
      return (await redis.hdel(KEY, giftId)) === 1;
    },
    async listHidden() {
      return (await redis.smembers(HIDDEN_KEY)) || [];
    },
    async setHidden(giftId, hidden) {
      await (hidden ? redis.sadd(HIDDEN_KEY, giftId) : redis.srem(HIDDEN_KEY, giftId));
    },
  };
}

function fileStore() {
  const dir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const jsonFile = path.join(dir, 'picks.json');
  const csvFile = path.join(dir, 'picks.csv');
  const hiddenFile = path.join(dir, 'hidden.json');
  fs.mkdirSync(dir, { recursive: true });
  const read = () => (fs.existsSync(jsonFile) ? JSON.parse(fs.readFileSync(jsonFile, 'utf8')) : []);
  const write = (picks) => {
    fs.writeFileSync(jsonFile, JSON.stringify(picks, null, 2));
    fs.writeFileSync(csvFile, toCsv(picks));
  };
  return {
    async list() {
      return read();
    },
    async claim(pick) {
      const picks = read();
      if (picks.some((p) => p.giftId === pick.giftId)) return false;
      write([...picks, pick]);
      return true;
    },
    async release(giftId) {
      const picks = read();
      const kept = picks.filter((p) => p.giftId !== giftId);
      write(kept);
      return kept.length !== picks.length;
    },
    async listHidden() {
      return fs.existsSync(hiddenFile) ? JSON.parse(fs.readFileSync(hiddenFile, 'utf8')) : [];
    },
    async setHidden(giftId, hidden) {
      const ids = new Set(await this.listHidden());
      hidden ? ids.add(giftId) : ids.delete(giftId);
      fs.writeFileSync(hiddenFile, JSON.stringify([...ids], null, 2));
    },
  };
}

if (!redisUrl && process.env.VERCEL) {
  console.error('No Redis database connected. Add Upstash Redis in the Vercel Storage tab.');
}

export const store = redisUrl && redisToken ? redisStore() : fileStore();
