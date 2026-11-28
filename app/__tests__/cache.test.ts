import { diffIndex, loadEdition, pruneCache, syncIndex } from '../src/lib/cache';
import { buildRequest, fetchJson, validSrc } from '../src/lib/source';
import { fakeFetch, indexFixture, memDb, raw } from './helpers';

const SRC = { owner: 'hwet-j', repo: 'world-brief', branch: 'main' };
const NOW = new Date('2026-11-27T10:00:00Z');

test('주소 생성: 토큰 없으면 raw, 있으면 API + 헤더', () => {
  expect(buildRequest(SRC, 'data/index.json').url).toBe('https://raw.githubusercontent.com/hwet-j/world-brief/main/data/index.json');
  const t = buildRequest({ ...SRC, token: 'tok' }, 'data/editions/x.json');
  expect(t.url).toBe('https://api.github.com/repos/hwet-j/world-brief/contents/data/editions/x.json?ref=main');
  expect(t.headers).toMatchObject({ Accept: 'application/vnd.github.raw+json', Authorization: 'Bearer tok' });
  expect(() => buildRequest({ ...SRC, owner: 'a/b' }, 'x')).toThrow();
  expect(() => buildRequest(SRC, '../x')).toThrow();
  expect(() => buildRequest(SRC, '/x')).toThrow();
  expect(validSrc({ owner: 'a', repo: 'b', branch: 'feat/x' })).toBe(true);
  expect(validSrc({ owner: 'a b', repo: 'b', branch: 'main' })).toBe(false);
});

test('fetchJson: 200/304/404/401/403/500/네트워크 오류/깨진 JSON', async () => {
  const f = fakeFetch({
    'ok.json': { status: 200, body: { a: 1 }, etag: 'W/"1"' }, 'nm.json': { status: 304 }, 'nf.json': { status: 404 },
    'u.json': { status: 401 }, 'f.json': { status: 403 }, 's.json': { status: 500 }, 'net.json': new Error('boom'), 'bad.json': { status: 200, body: '{oops' },
  });
  expect(await fetchJson(f, SRC, 'ok.json')).toEqual({ status: 'ok', data: { a: 1 }, etag: 'W/"1"' });
  expect((await fetchJson(f, SRC, 'nm.json', 'W/"1"')).status).toBe('notModified');
  expect(f.calls.at(-1)!.headers['If-None-Match']).toBe('W/"1"');
  expect((await fetchJson(f, SRC, 'nf.json')).status).toBe('notFound');
  expect(await fetchJson(f, SRC, 'u.json')).toMatchObject({ status: 'error', message: expect.stringContaining('토큰') });
  expect(await fetchJson(f, SRC, 'f.json')).toMatchObject({ status: 'error', message: expect.stringContaining('거부') });
  expect(await fetchJson(f, SRC, 's.json')).toMatchObject({ status: 'error', message: expect.stringContaining('500') });
  expect(await fetchJson(f, SRC, 'net.json')).toMatchObject({ status: 'error', message: expect.stringContaining('네트워크') });
  expect(await fetchJson(f, SRC, 'bad.json')).toMatchObject({ status: 'error' });
});

test('새 회차 감지: 이전 목록에 없던 것만', () => {
  const next = indexFixture();
  expect(diffIndex(null, next).map((e) => e.id)).toEqual(['2026-11-27-pm', '2026-11-27-am', '2026-11-26-am']);
  const prev = { ...next, editions: next.editions.slice(1) };
  expect(diffIndex(prev, next).map((e) => e.id)).toEqual(['2026-11-27-pm']);
  expect(diffIndex(next, next)).toEqual([]);
});

test('syncIndex: 첫 수신 → 저장, 두 번째는 304 로 캐시 사용, 새 회차 감지', async () => {
  const db = memDb();
  const f = fakeFetch({ 'data/index.json': { status: 200, body: raw('index.json'), etag: 'E1' } });
  const r1 = await syncIndex(db, f, SRC, NOW, null);
  expect(r1.changed).toBe(true);
  expect(r1.newEntries).toHaveLength(3);
  expect(db.index?.etag).toBe('E1');

  const f2 = fakeFetch({ 'data/index.json': { status: 304 } });
  const r2 = await syncIndex(db, f2, SRC, new Date('2026-11-27T11:00:00Z'), r1.index);
  expect(f2.calls[0].headers['If-None-Match']).toBe('E1');
  expect(r2.changed).toBe(false);
  expect(r2.index?.latest).toBe('2026-11-27-pm');
  expect(r2.fetchedAt).toBe('2026-11-27T11:00:00.000Z');

  const bigger = { ...(raw('index.json') as object), latest: 'new', editions: [{ id: '2026-11-28-am', date: '2026-11-28', slot: 'am', title: 'n', headline: [], regions: [], itemCount: 0, path: 'data/editions/2026-11-28-am.json' }, ...((raw('index.json') as { editions: unknown[] }).editions)] };
  const r3 = await syncIndex(db, fakeFetch({ 'data/index.json': { status: 200, body: bigger, etag: 'E2' } }), SRC, NOW, r2.index);
  expect(r3.newEntries.map((e) => e.id)).toEqual(['2026-11-28-am']);
});

test('오프라인이면 캐시로 동작하고 offline 표시', async () => {
  const db = memDb();
  await syncIndex(db, fakeFetch({ 'data/index.json': { status: 200, body: raw('index.json') } }), SRC, NOW, null);
  const r = await syncIndex(db, fakeFetch({ 'data/index.json': new Error('offline') }), SRC, NOW, null);
  expect(r.offline).toBe(true);
  expect(r.index?.editions).toHaveLength(3);
  expect(r.error).toContain('네트워크');
  expect(r.newEntries).toEqual([]);
});

test('캐시도 없고 404 면 "아직 올라온 브리핑이 없어요"', async () => {
  const r = await syncIndex(memDb(), fakeFetch({}), SRC, NOW, null);
  expect(r.index).toBeNull();
  expect(r.error).toBe('아직 올라온 브리핑이 없어요');
});

test('깨진 목록은 기존 캐시를 지키고 오류만 알림', async () => {
  const db = memDb();
  await syncIndex(db, fakeFetch({ 'data/index.json': { status: 200, body: raw('index.json'), etag: 'E1' } }), SRC, NOW, null);
  const r = await syncIndex(db, fakeFetch({ 'data/index.json': { status: 200, body: [1, 2] } }), SRC, NOW, null);
  expect(r.index?.editions).toHaveLength(3);
  expect(r.error).toBeTruthy();
  expect(db.index?.etag).toBe('E1');
});

test('회차: 캐시 우선, 없으면 받아서 저장, 실패해도 캐시로', async () => {
  const db = memDb();
  const entry = { id: '2026-11-27-am', date: '2026-11-27', path: 'data/editions/2026-11-27-am.json' };
  const f = fakeFetch({ [entry.path]: { status: 200, body: raw('edition-b.json'), etag: 'X' } });
  const a = await loadEdition(db, f, SRC, entry, NOW);
  expect(a.fromCache).toBe(false);
  expect(a.edition?.title).toContain('11월 27일');
  expect(db.editions.size).toBe(1);

  const g = fakeFetch({});
  const b = await loadEdition(db, g, SRC, entry, NOW);
  expect(b.fromCache).toBe(true);
  expect(g.calls).toHaveLength(0);

  const off = fakeFetch({ [entry.path]: new Error('x') });
  const c = await loadEdition(db, off, SRC, entry, NOW, true);
  expect(c.fromCache).toBe(true);
  expect(c.edition).not.toBeNull();

  const miss = await loadEdition(memDb(), fakeFetch({}), SRC, entry, NOW);
  expect(miss.edition).toBeNull();
  expect(miss.error).toContain('찾을 수 없어요');
});

test('오래된 회차 캐시 정리: 최근 N개만', async () => {
  const db = memDb();
  for (const id of ['2026-11-25-am', '2026-11-26-am', '2026-11-27-am', '2026-11-27-pm']) await db.putEdition(id, id.slice(0, 10), '{}', null, '');
  expect(await pruneCache(db, 2)).toEqual(['2026-11-26-am', '2026-11-25-am']);
  expect([...db.editions.keys()].sort()).toEqual(['2026-11-27-am', '2026-11-27-pm']);
  expect(await pruneCache(db, 10)).toEqual([]);
});
