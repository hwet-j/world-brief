import { isHttps, parseEdition, parseIndex } from '../src/lib/parse';
import { edition, raw } from './helpers';

test('정상 픽스처는 경고 없이 파싱', () => {
  const p = parseEdition(raw('edition-b.json'));
  expect(p.warnings).toEqual([]);
  expect(p.futureSchema).toBe(false);
  expect(p.value?.regions.map((r) => r.code)).toEqual(['KR', 'US', 'CN', 'GLOBAL']);
  expect(p.value?.regions[0].items[0].isUpdate).toBe(true);
  expect(p.value?.watchlist).toHaveLength(2);
});

test('알 수 없는 필드는 버리고, 선택 필드가 없어도 동작', () => {
  const p = parseEdition({ id: '2026-11-27-am', date: '2026-11-27', mystery: 1, regions: [{ code: 'KR', extra: true, items: [{ id: 'kr-1', title: 'T', summary: 'S', weird: 5 }] }] });
  expect(p.value).not.toBeNull();
  const it = p.value!.regions[0].items[0];
  expect(it).toMatchObject({ topic: 'other', importance: 2, confidence: 'medium', isUpdate: false, tags: [], sources: [] });
  expect('weird' in it).toBe(false);
  expect(p.value!.regions[0].name).toBe('KR');
  expect(p.value!.headline).toEqual([]);
  expect(p.value!.slot).toBe('am');
});

test('타입이 틀린 값은 기본값, 잘못된 항목은 그 항목만 건너뛰고 경고', () => {
  const p = parseEdition({
    id: 'x-am', date: '2026-11-27',
    regions: [
      { code: 'KR', items: [{ id: 'a', title: 'ok', summary: 's', importance: 9, confidence: 'wow', topic: 'sports', tags: 'no', sources: 'no' }, 'bad', { id: 'b' }, { id: 'a', title: 'dup', summary: 'x' }] },
      'broken', { name: '코드 없음', items: [] },
    ],
  });
  expect(p.value!.regions).toHaveLength(1);
  const items = p.value!.regions[0].items;
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ importance: 2, confidence: 'medium', topic: 'other', tags: [], sources: [] });
  expect(p.warnings.length).toBe(5);
});

test('출처 URL 은 https 만 남김', () => {
  const p = parseEdition({ id: 'x-am', date: '2026-11-27', regions: [{ code: 'KR', items: [{ id: 'a', title: 't', summary: 's', sources: [{ name: 'A', url: 'http://a.com' }, { name: 'B', url: 'javascript:alert(1)' }, { name: 'C', url: 'https://c.com/x' }, { url: 'https://noname.com' }] }] }] });
  expect(p.value!.regions[0].items[0].sources).toEqual([{ name: 'C', url: 'https://c.com/x', lang: undefined }]);
  expect(isHttps('https://a.b/c')).toBe(true);
  expect(isHttps('http://a.b')).toBe(false);
  expect(isHttps('https://a b')).toBe(false);
  expect(isHttps(null)).toBe(false);
});

test('HTML 은 해석하지 않고 문자열 그대로 둔다', () => {
  const p = parseEdition({ id: 'x-am', date: '2026-11-27', title: '<b>제목</b>', regions: [{ code: 'KR', items: [{ id: 'a', title: '<script>x</script>', summary: '<img src=x onerror=1>' }] }] });
  expect(p.value!.title).toBe('<b>제목</b>');
  expect(p.value!.regions[0].items[0].title).toBe('<script>x</script>');
});

test('schemaVersion 이 더 크면 futureSchema, 그래도 읽을 수 있는 건 읽음', () => {
  const p = parseEdition({ schemaVersion: 2, id: 'x-am', date: '2026-11-27', regions: [{ code: 'KR', items: [{ id: 'a', title: 't', summary: 's' }] }], newField: 1 });
  expect(p.futureSchema).toBe(true);
  expect(p.value).not.toBeNull();
});

test('치명적 오류는 value null', () => {
  expect(parseEdition(null).value).toBeNull();
  expect(parseEdition([]).value).toBeNull();
  expect(parseEdition({ id: 'x' }).value).toBeNull();
  expect(parseEdition({ id: 'x-am', date: '어제' }).value).toBeNull();
});

test('목록 파서: 최신순 정렬, 깨진 항목 건너뜀', () => {
  const p = parseIndex({ schemaVersion: 1, updatedAt: 't', latest: 'b', editions: [{ id: '2026-11-26-am', date: '2026-11-26' }, 5, { id: '2026-11-27-pm', date: '2026-11-27', slot: 'pm', headline: ['a', 2, 'b'], regions: ['KR', 3] }, { id: '', date: 'x' }] });
  expect(p.value!.editions.map((e) => e.id)).toEqual(['2026-11-27-pm', '2026-11-26-am']);
  expect(p.value!.editions[0]).toMatchObject({ slot: 'pm', headline: ['a', 'b'], regions: ['KR'], path: 'data/editions/2026-11-27-pm.json' });
  expect(p.warnings).toHaveLength(2);
  expect(parseIndex('x').value).toBeNull();
  expect(parseIndex({ schemaVersion: 3, editions: [] }).futureSchema).toBe(true);
});

test('픽스처 객체는 불변으로 안전하게 재파싱', () => {
  expect(edition('a').regions[0].items[0].tags).toEqual(['반도체', '수출']);
});
