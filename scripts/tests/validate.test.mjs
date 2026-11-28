import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildIndex, validateEdition } from '../lib.mjs';

const item = (id, over = {}) => ({
  id, topic: 'economy', title: '제목', summary: '이것은 스무 자가 넘는 충분히 긴 요약 문장입니다. 원문을 복사하지 않았어요.', importance: 2, confidence: 'high',
  sources: [{ name: 'Reuters', url: 'https://example.com/a' }, { name: 'AP', url: 'https://example.com/b' }], ...over,
});
const region = (code, items) => ({ code, name: code, flag: '🏳️', summary: '요약', items });
const edition = (over = {}) => ({
  schemaVersion: 1, id: '2026-11-27-am', date: '2026-11-27', slot: 'am', generatedAt: '2026-11-27T07:15:00+09:00', title: '11월 27일 아침 브리핑',
  headline: ['하나', '둘', '셋'], regions: [region('KR', [item('kr-1')]), region('US', [item('us-1')]), region('JP', [item('jp-1')])], ...over,
});

test('정상 회차는 통과', () => assert.deepEqual(validateEdition(edition(), '2026-11-27-am'), []));

test('id·date·slot 불일치', () => {
  assert.match(validateEdition(edition(), '2026-11-27-pm').join('\n'), /파일 이름/);
  assert.match(validateEdition(edition({ slot: 'pm' }), '2026-11-27-am').join('\n'), /slot/);
  assert.match(validateEdition(edition({ date: '2026-02-30' }), '2026-11-27-am').join('\n'), /date/);
});

test('지역·항목 개수와 중복', () => {
  assert.match(validateEdition(edition({ regions: [region('KR', [item('a')])] })).join('\n'), /regions 는 3~12/);
  assert.match(validateEdition(edition({ regions: [region('KR', [item('x')]), region('KR', [item('y')]), region('US', [item('z')])] })).join('\n'), /중복/);
  assert.match(validateEdition(edition({ regions: [region('KR', [item('x')]), region('US', [item('x')]), region('JP', [item('j')])] })).join('\n'), /회차 안에서 중복/);
  assert.match(validateEdition(edition({ regions: [region('KR', []), region('US', [item('u')]), region('JP', [item('j')])] })).join('\n'), /1~16개/);
  assert.match(validateEdition(edition({ regions: [region('ZZ', [item('a')]), region('US', [item('u')]), region('JP', [item('j')])] })).join('\n'), /알려진 지역/);
});

test('출처: https 만, 중복 금지, high 는 2개 이상', () => {
  const bad = (over) => validateEdition(edition({ regions: [region('KR', [item('a', over)]), region('US', [item('u')]), region('JP', [item('j')])] })).join('\n');
  assert.match(bad({ sources: [{ name: 'X', url: 'http://x.com' }, { name: 'Y', url: 'https://y.com' }] }), /https/);
  assert.match(bad({ sources: [{ name: 'X', url: 'https://x.com' }, { name: 'Y', url: 'https://x.com' }] }), /중복/);
  assert.match(bad({ sources: [{ name: 'X', url: 'https://x.com' }] }), /high/);
  assert.equal(bad({ sources: [{ name: 'X', url: 'https://x.com' }], confidence: 'medium' }), '');
  assert.match(bad({ sources: [] }), /1~4개/);
});

test('필드 형식: topic/importance/HTML/길이', () => {
  const bad = (over) => validateEdition(edition({ regions: [region('KR', [item('a', over)]), region('US', [item('u')]), region('JP', [item('j')])] })).join('\n');
  assert.match(bad({ topic: 'sports' }), /topic/);
  assert.match(bad({ importance: 5 }), /importance/);
  assert.match(bad({ summary: '짧음' }), /summary/);
  assert.match(bad({ title: '<b>굵게</b>' }), /HTML/);
  assert.match(bad({ tags: ['a', 'b', 'c', 'd', 'e', 'f'] }), /tags/);
  assert.match(bad({ publishedAt: '어제' }), /publishedAt/);
});

test('headline 개수', () => {
  assert.match(validateEdition(edition({ headline: ['하나'] })).join('\n'), /headline/);
});

test('index: 최신순, 요약 필드', () => {
  const a = edition();
  const b = edition({ id: '2026-11-27-pm', slot: 'pm', title: '저녁' });
  const c = edition({ id: '2026-11-26-am', date: '2026-11-26', title: '전날' });
  const idx = buildIndex([c, a, b], new Date('2026-11-27T00:00:00Z'));
  assert.deepEqual(idx.editions.map((x) => x.id), ['2026-11-27-pm', '2026-11-27-am', '2026-11-26-am']);
  assert.equal(idx.latest, '2026-11-27-pm');
  assert.equal(idx.editions[0].itemCount, 3);
  assert.deepEqual(idx.editions[0].regions, ['KR', 'US', 'JP']);
  assert.equal(idx.editions[0].path, 'data/editions/2026-11-27-pm.json');
  assert.equal(buildIndex([]).latest, null);
});
