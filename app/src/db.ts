import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';

import type { CacheDb } from './lib/cache';
import { DEFAULT_PREFS, type Bookmark, type Prefs } from './lib/types';

let dbp: Promise<SQLite.SQLiteDatabase> | null = null;
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbp) {
    dbp = (async () => {
      const db = await SQLite.openDatabaseAsync('worldbrief.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS editions (id TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL, json TEXT NOT NULL, etag TEXT, fetched_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS bookmarks (key TEXT PRIMARY KEY NOT NULL, json TEXT NOT NULL, saved_at TEXT NOT NULL);
      `);
      return db;
    })();
  }
  return dbp;
}

const kvGet = async (key: string) => (await (await getDb()).getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key))?.value ?? null;
const kvSet = async (key: string, value: string) => { await (await getDb()).runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, value); };
export { kvGet, kvSet };

export const cacheDb: CacheDb = {
  async getIndex() {
    const r = await kvGet('index');
    if (!r) return null;
    const meta = JSON.parse((await kvGet('index_meta')) ?? '{}') as { etag?: string | null; fetchedAt?: string };
    return { json: r, etag: meta.etag ?? null, fetchedAt: meta.fetchedAt ?? '' };
  },
  async putIndex(json, etag, fetchedAt) {
    await kvSet('index', json);
    await kvSet('index_meta', JSON.stringify({ etag, fetchedAt }));
  },
  async getEdition(id) {
    const r = await (await getDb()).getFirstAsync<{ json: string; etag: string | null }>('SELECT json, etag FROM editions WHERE id = ?', id);
    return r ?? null;
  },
  async putEdition(id, date, json, etag, fetchedAt) {
    await (await getDb()).runAsync('INSERT OR REPLACE INTO editions (id, date, json, etag, fetched_at) VALUES (?,?,?,?,?)', id, date, json, etag, fetchedAt);
  },
  async listEditionIds() {
    return (await getDb()).getAllAsync<{ id: string; date: string }>('SELECT id, date FROM editions');
  },
  async deleteEditions(ids) {
    const db = await getDb();
    for (const id of ids) await db.runAsync('DELETE FROM editions WHERE id = ?', id);
  },
};

export async function allCachedEditionJson(): Promise<{ id: string; json: string }[]> {
  return (await getDb()).getAllAsync<{ id: string; json: string }>('SELECT id, json FROM editions ORDER BY id DESC');
}
export async function cacheSize(): Promise<{ editions: number; bytes: number }> {
  const r = await (await getDb()).getFirstAsync<{ n: number; b: number | null }>('SELECT COUNT(*) AS n, SUM(LENGTH(json)) AS b FROM editions');
  return { editions: r?.n ?? 0, bytes: r?.b ?? 0 };
}
export async function clearEditionCache(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM editions');
  await db.runAsync("DELETE FROM kv WHERE key IN ('index','index_meta')");
}

export async function loadPrefs(): Promise<Prefs> {
  try { return { ...DEFAULT_PREFS, ...(JSON.parse((await kvGet('prefs')) ?? '{}') as Partial<Prefs>) }; } catch { return DEFAULT_PREFS; }
}
export const savePrefs = (p: Prefs) => kvSet('prefs', JSON.stringify(p));

const TOKEN_KEY = 'github_token';
export const getToken = async (): Promise<string | null> => { try { return await SecureStore.getItemAsync(TOKEN_KEY); } catch { return null; } };
export const setToken = (t: string) => SecureStore.setItemAsync(TOKEN_KEY, t.trim());
export const clearToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);

export async function loadBookmarks(): Promise<Bookmark[]> {
  const rows = await (await getDb()).getAllAsync<{ json: string }>('SELECT json FROM bookmarks ORDER BY saved_at DESC');
  const out: Bookmark[] = [];
  for (const r of rows) { try { out.push(JSON.parse(r.json) as Bookmark); } catch { /* 깨진 항목은 건너뜀 */ } }
  return out;
}
export async function saveBookmark(b: Bookmark): Promise<void> {
  await (await getDb()).runAsync('INSERT OR REPLACE INTO bookmarks (key, json, saved_at) VALUES (?,?,?)', b.key, JSON.stringify(b), b.savedAt);
}
export async function deleteBookmark(key: string): Promise<void> {
  await (await getDb()).runAsync('DELETE FROM bookmarks WHERE key = ?', key);
}
