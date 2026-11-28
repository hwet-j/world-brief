import fs from 'node:fs';
import path from 'node:path';

import type { CacheDb } from '../src/lib/cache';
import { parseEdition, parseIndex } from '../src/lib/parse';
import type { Edition } from '../src/lib/types';

export const fixturePath = (name: string) => path.join(__dirname, '..', 'tests', 'fixtures', name);
export const raw = (name: string): unknown => JSON.parse(fs.readFileSync(fixturePath(name), 'utf8'));
export const edition = (letter: 'a' | 'b' | 'c'): Edition => parseEdition(raw(`edition-${letter}.json`)).value as Edition;
export const indexFixture = () => parseIndex(raw('index.json')).value!;
export const allEditions = (): Edition[] => [edition('c'), edition('b'), edition('a')];

/** 메모리 캐시 (SQLite 대신) */
export function memDb(): CacheDb & { editions: Map<string, { date: string; json: string; etag: string | null }>; index: { json: string; etag: string | null; fetchedAt: string } | null } {
  const self = {
    index: null as { json: string; etag: string | null; fetchedAt: string } | null,
    editions: new Map<string, { date: string; json: string; etag: string | null }>(),
    async getIndex() { return self.index; },
    async putIndex(json: string, etag: string | null, fetchedAt: string) { self.index = { json, etag, fetchedAt }; },
    async getEdition(id: string) { const e = self.editions.get(id); return e ? { json: e.json, etag: e.etag } : null; },
    async putEdition(id: string, date: string, json: string, etag: string | null) { self.editions.set(id, { date, json, etag }); },
    async listEditionIds() { return [...self.editions.entries()].map(([id, v]) => ({ id, date: v.date })); },
    async deleteEditions(ids: string[]) { for (const id of ids) self.editions.delete(id); },
  };
  return self;
}

type Reply = { status: number; body?: unknown; etag?: string } | Error;
/** 주소별로 미리 정한 응답을 돌려주는 가짜 fetch. 호출 기록(url, headers)을 남긴다 */
export function fakeFetch(routes: Record<string, Reply | (() => Reply)>) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fn = async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push({ url, headers: init?.headers ?? {} });
    const key = Object.keys(routes).find((k) => url.endsWith(k));
    const r = key ? (typeof routes[key] === 'function' ? (routes[key] as () => Reply)() : (routes[key] as Reply)) : { status: 404 };
    if (r instanceof Error) throw r;
    return { status: r.status, ok: r.status >= 200 && r.status < 300, headers: { get: (n: string) => (n.toLowerCase() === 'etag' ? r.etag ?? null : null) }, text: async () => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body ?? {})) };
  };
  return Object.assign(fn, { calls });
}
