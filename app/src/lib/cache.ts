import { parseEdition, parseIndex } from './parse';
import { fetchJson, type Src } from './source';
import type { BriefIndex, Edition, IndexEntry } from './types';

/** 캐시 저장소 인터페이스 (앱은 SQLite, 테스트는 메모리) */
export interface CacheDb {
  getIndex(): Promise<{ json: string; etag: string | null; fetchedAt: string } | null>;
  putIndex(json: string, etag: string | null, fetchedAt: string): Promise<void>;
  getEdition(id: string): Promise<{ json: string; etag: string | null } | null>;
  putEdition(id: string, date: string, json: string, etag: string | null, fetchedAt: string): Promise<void>;
  listEditionIds(): Promise<{ id: string; date: string }[]>;
  deleteEditions(ids: string[]): Promise<void>;
}
type FetchFn = Parameters<typeof fetchJson>[0];

export interface SyncResult {
  index: BriefIndex | null;
  /** 이번 갱신으로 새로 알게 된 회차 */
  newEntries: IndexEntry[];
  changed: boolean;
  offline: boolean;
  error?: string;
  futureSchema: boolean;
  warnings: string[];
  fetchedAt: string | null;
}

/** 새 목록에서 이전 목록에 없던 회차 (최신순) */
export function diffIndex(prev: BriefIndex | null, next: BriefIndex): IndexEntry[] {
  const had = new Set((prev?.editions ?? []).map((e) => e.id));
  return next.editions.filter((e) => !had.has(e.id));
}

/** 목록을 읽어 캐시를 갱신한다. 네트워크 실패면 캐시를 그대로 돌려준다(offline). */
export async function syncIndex(db: CacheDb, fetchFn: FetchFn, src: Src, now: Date, hadSeen: BriefIndex | null): Promise<SyncResult> {
  const cached = await db.getIndex();
  const cachedIdx = cached ? parseIndex(safeJson(cached.json)) : null;
  const res = await fetchJson(fetchFn, src, 'data/index.json', cached?.etag);
  if (res.status === 'ok') {
    const p = parseIndex(res.data);
    if (!p.value) return { index: cachedIdx?.value ?? null, newEntries: [], changed: false, offline: false, error: p.warnings[0], futureSchema: false, warnings: p.warnings, fetchedAt: cached?.fetchedAt ?? null };
    const fetchedAt = now.toISOString();
    await db.putIndex(JSON.stringify(res.data), res.etag, fetchedAt);
    return { index: p.value, newEntries: diffIndex(hadSeen ?? cachedIdx?.value ?? null, p.value), changed: true, offline: false, futureSchema: p.futureSchema, warnings: p.warnings, fetchedAt };
  }
  const idx = cachedIdx?.value ?? null;
  if (res.status === 'notModified') {
    const fetchedAt = now.toISOString();
    if (cached) await db.putIndex(cached.json, cached.etag, fetchedAt);
    return { index: idx, newEntries: [], changed: false, offline: false, futureSchema: cachedIdx?.futureSchema ?? false, warnings: [], fetchedAt };
  }
  if (res.status === 'notFound') {
    return { index: idx, newEntries: [], changed: false, offline: false, error: idx ? undefined : '아직 올라온 브리핑이 없어요', futureSchema: false, warnings: [], fetchedAt: cached?.fetchedAt ?? null };
  }
  return { index: idx, newEntries: [], changed: false, offline: true, error: res.message, futureSchema: cachedIdx?.futureSchema ?? false, warnings: [], fetchedAt: cached?.fetchedAt ?? null };
}

const safeJson = (s: string): unknown => { try { return JSON.parse(s); } catch { return null; } };

export interface EditionResult { edition: Edition | null; warnings: string[]; futureSchema: boolean; fromCache: boolean; error?: string }

/** 회차 한 개: 캐시 우선(회차 파일은 한 번 올라가면 바뀌지 않으므로), 없으면 받아서 저장 */
export async function loadEdition(db: CacheDb, fetchFn: FetchFn, src: Src, entry: Pick<IndexEntry, 'id' | 'date' | 'path'>, now: Date, forceRefresh = false): Promise<EditionResult> {
  const cached = await db.getEdition(entry.id);
  if (cached && !forceRefresh) {
    const p = parseEdition(safeJson(cached.json));
    if (p.value) return { edition: p.value, warnings: p.warnings, futureSchema: p.futureSchema, fromCache: true };
  }
  const res = await fetchJson(fetchFn, src, entry.path, cached?.etag);
  if (res.status === 'ok') {
    const p = parseEdition(res.data);
    if (p.value) await db.putEdition(entry.id, entry.date, JSON.stringify(res.data), res.etag, now.toISOString());
    return { edition: p.value, warnings: p.warnings, futureSchema: p.futureSchema, fromCache: false, error: p.value ? undefined : p.warnings[0] };
  }
  if (cached) {
    const p = parseEdition(safeJson(cached.json));
    return { edition: p.value, warnings: p.warnings, futureSchema: p.futureSchema, fromCache: true };
  }
  return { edition: null, warnings: [], futureSchema: false, fromCache: false, error: res.status === 'error' ? res.message : res.status === 'notFound' ? '회차 파일을 찾을 수 없어요' : '불러오지 못했어요' };
}

/** 최근 keep 개만 남기고 오래된 회차 캐시를 지운다 (지운 id 목록 반환) */
export async function pruneCache(db: CacheDb, keep: number): Promise<string[]> {
  const all = (await db.listEditionIds()).sort((a, b) => b.id.localeCompare(a.id));
  const drop = all.slice(Math.max(keep, 1)).map((e) => e.id);
  if (drop.length) await db.deleteEditions(drop);
  return drop;
}
