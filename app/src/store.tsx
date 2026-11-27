import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { allCachedEditionJson, cacheDb, cacheSize, clearEditionCache, clearToken, deleteBookmark, getToken, kvGet, kvSet, loadBookmarks, loadPrefs, saveBookmark, savePrefs, setToken as storeToken } from './db';
import { loadEdition, pruneCache, syncIndex } from './lib/cache';
import { makeBookmark } from './lib/share';
import { parseEdition, parseIndex } from './lib/parse';
import type { Src } from './lib/source';
import { DEFAULT_PREFS, type Bookmark, type BriefIndex, type Edition, type Item, type Prefs, type Region } from './lib/types';

export interface Status { refreshing: boolean; offline: boolean; error?: string; fetchedAt: string | null; futureSchema: boolean; warnings: string[] }

interface Ctx {
  ready: boolean;
  prefs: Prefs; setPrefs(p: Partial<Prefs>): Promise<void>;
  hasToken: boolean; setToken(t: string): Promise<void>; removeToken(): Promise<void>;
  index: BriefIndex | null;
  editions: Edition[]; latest: Edition | null; status: Status;
  hasNew: boolean; markSeen(): void;
  refresh(opts?: { force?: boolean }): Promise<void>;
  getEdition(id: string): Promise<Edition | null>;
  bookmarks: Bookmark[]; isBookmarked(editionId: string, itemId: string): boolean;
  toggleBookmark(e: Pick<Edition, 'id' | 'date'>, r: Pick<Region, 'code' | 'name' | 'flag'>, it: Item): Promise<boolean>;
  setNote(key: string, note: string): Promise<void>; removeBookmark(key: string): Promise<void>;
  cache(): Promise<{ editions: number; bytes: number }>; clearCache(): Promise<void>;
}
const C = createContext<Ctx>(null as never);
export const useBrief = () => useContext(C);

const fetchAdapter = (url: string, init?: { headers?: Record<string, string> }) => fetch(url, init);
const PREFETCH = 6;

export function BriefProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [token, setTokenState] = useState<string | null>(null);
  const [index, setIndex] = useState<BriefIndex | null>(null);
  const [edMap, setEdMap] = useState<Map<string, Edition>>(new Map());
  const [seen, setSeen] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [status, setStatus] = useState<Status>({ refreshing: false, offline: false, fetchedAt: null, futureSchema: false, warnings: [] });
  const prefsRef = useRef(prefs);
  const tokenRef = useRef(token);
  const indexRef = useRef(index);
  useEffect(() => { prefsRef.current = prefs; tokenRef.current = token; indexRef.current = index; });
  const busy = useRef(false);

  const src = useCallback((): Src => ({ owner: prefsRef.current.owner, repo: prefsRef.current.repo, branch: prefsRef.current.branch, token: tokenRef.current }), []);

  const refresh = useCallback(async (opts?: { force?: boolean }) => {
    if (busy.current) return;
    busy.current = true;
    setStatus((s) => ({ ...s, refreshing: true }));
    try {
      const r = await syncIndex(cacheDb, fetchAdapter, src(), new Date(), indexRef.current);
      if (r.index) setIndex(r.index);
      const warnings = [...r.warnings];
      if (r.index) {
        const want = r.index.editions.slice(0, PREFETCH);
        const next = new Map<string, Edition>();
        let future = r.futureSchema;
        for (const entry of want) {
          const res = await loadEdition(cacheDb, fetchAdapter, src(), entry, new Date(), !!opts?.force && entry.id === r.index.latest);
          if (res.edition) next.set(entry.id, res.edition);
          warnings.push(...res.warnings);
          future = future || res.futureSchema;
        }
        const dropped = await pruneCache(cacheDb, prefsRef.current.keepEditions);
        setEdMap((m) => {
          const merged = new Map(m);
          for (const [k, v] of next) merged.set(k, v);
          for (const d of dropped) merged.delete(d);
          return merged;
        });
        setStatus({ refreshing: false, offline: r.offline, error: r.error, fetchedAt: r.fetchedAt, futureSchema: future, warnings: warnings.slice(0, 20) });
      } else {
        setStatus({ refreshing: false, offline: r.offline, error: r.error, fetchedAt: r.fetchedAt, futureSchema: r.futureSchema, warnings });
      }
    } finally {
      busy.current = false;
    }
  }, [src]);

  // 시작: 저장된 설정·캐시를 먼저 읽고(오프라인에서도 바로 보이도록), 오래됐으면 갱신
  useEffect(() => {
    (async () => {
      const [p, tk, bms, seenId, idxRaw] = await Promise.all([loadPrefs(), getToken(), loadBookmarks(), kvGet('seen_latest'), kvGet('index')]);
      setPrefsState(p); prefsRef.current = p;
      setTokenState(tk); tokenRef.current = tk;
      setBookmarks(bms); setSeen(seenId);
      if (idxRaw) { try { const pi = parseIndex(JSON.parse(idxRaw)); if (pi.value) { setIndex(pi.value); indexRef.current = pi.value; } } catch { /* 캐시 손상: 새로 받음 */ } }
      const m = new Map<string, Edition>();
      for (const row of await allCachedEditionJson()) { try { const pe = parseEdition(JSON.parse(row.json)); if (pe.value) m.set(row.id, pe.value); } catch { /* 건너뜀 */ } }
      setEdMap(m);
      setReady(true);
      refresh();
    })();
  }, [refresh]);

  // 앱이 앞으로 올 때, 설정한 간격이 지났으면 갱신
  const fetchedRef = useRef<string | null>(null);
  useEffect(() => { fetchedRef.current = status.fetchedAt; });
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') return;
      const at = fetchedRef.current ? Date.parse(fetchedRef.current) : 0;
      if (Date.now() - at > prefsRef.current.refreshMinutes * 60_000) refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const editions = useMemo(() => [...edMap.values()].sort((a, b) => b.id.localeCompare(a.id)), [edMap]);
  const latest = useMemo(() => (index?.latest ? edMap.get(index.latest) ?? editions[0] ?? null : editions[0] ?? null), [index, edMap, editions]);
  const hasNew = !!index?.latest && index.latest !== seen;

  const value = useMemo<Ctx>(() => ({
    ready, prefs, hasToken: !!token, index, editions, latest, status, hasNew, refresh, bookmarks,
    async setPrefs(p) { const n = { ...prefsRef.current, ...p }; setPrefsState(n); prefsRef.current = n; await savePrefs(n); },
    async setToken(t) { await storeToken(t); setTokenState(t.trim()); tokenRef.current = t.trim(); },
    async removeToken() { await clearToken(); setTokenState(null); tokenRef.current = null; },
    markSeen() { if (index?.latest) { setSeen(index.latest); kvSet('seen_latest', index.latest); } },
    async getEdition(id) {
      const have = edMap.get(id);
      if (have) return have;
      const entry = indexRef.current?.editions.find((e) => e.id === id);
      if (!entry) return null;
      const res = await loadEdition(cacheDb, fetchAdapter, src(), entry, new Date());
      if (res.edition) setEdMap((m) => new Map(m).set(id, res.edition as Edition));
      return res.edition;
    },
    isBookmarked: (e, i) => bookmarks.some((b) => b.key === `${e}/${i}`),
    async toggleBookmark(e, r, it) {
      const key = `${e.id}/${it.id}`;
      if (bookmarks.some((b) => b.key === key)) { await deleteBookmark(key); setBookmarks((b) => b.filter((x) => x.key !== key)); return false; }
      const bm = makeBookmark(e, r, it);
      await saveBookmark(bm); setBookmarks((b) => [bm, ...b]); return true;
    },
    async setNote(key, note) {
      const cur = bookmarks.find((b) => b.key === key);
      if (!cur) return;
      const bm = { ...cur, note: note.slice(0, 500) };
      await saveBookmark(bm); setBookmarks((b) => b.map((x) => (x.key === key ? bm : x)));
    },
    async removeBookmark(key) { await deleteBookmark(key); setBookmarks((b) => b.filter((x) => x.key !== key)); },
    cache: cacheSize,
    async clearCache() { await clearEditionCache(); setEdMap(new Map()); setIndex(null); indexRef.current = null; setStatus((s) => ({ ...s, fetchedAt: null })); await refresh({ force: true }); },
  }), [ready, prefs, token, index, editions, latest, status, hasNew, refresh, bookmarks, edMap, src]);

  return <C.Provider value={value}>{children}</C.Provider>;
}
