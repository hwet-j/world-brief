import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateEdition } from '../lib.mjs';
import { buildEdition, parseFeed } from '../rss.mjs';

const RSS = `<?xml version="1.0"?><rss><channel>
<item><title><![CDATA[금리 &amp; 환율 동결]]></title><link>https://example.com/a</link><description><![CDATA[<p>한국은행이 <b>기준금리</b>를 동결했다고 밝혔다.</p>]]></description></item>
<item><title>Second</title><link>http://insecure.example.com/b</link></item>
<item><title>Third</title><link>https://example.com/c</link><description>x</description></item>
</channel></rss>`;
const ATOM = `<feed><entry><title>Atom 제목</title><link href="https://example.com/atom"/><summary>요약 문장이 충분히 길어야 해요 정말로.</summary></entry></feed>`;

test('RSS: CDATA·엔티티·HTML 제거, https 가 아닌 링크는 제외', () => {
  const r = parseFeed(RSS);
  assert.equal(r.length, 2);
  assert.equal(r[0].title, '금리 & 환율 동결');
  assert.equal(r[0].description, '한국은행이 기준금리 를 동결했다고 밝혔다.');
  assert.equal(r[1].link, 'https://example.com/c');
});

test('Atom 도 읽는다', () => {
  const r = parseFeed(ATOM);
  assert.deepEqual(r.map((x) => x.link), ['https://example.com/atom']);
});

const mk = (code, n) => ({ name: code, flag: '🏳', items: Array.from({ length: n }, (_, i) => ({ title: `${code} 제목 ${i}`, link: `https://e.com/${code}/${i}`, description: i === 0 ? '' : '충분히 긴 설명이 들어 있는 문장이에요 여기.', source: 'S', lang: 'en' })) });

test('회차 객체가 스키마 검증을 통과한다 (KST 날짜·슬롯)', () => {
  const ed = buildEdition({ KR: mk('KR', 7), US: mk('US', 2), GB: mk('GB', 1), JP: mk('JP', 0) }, new Date('2026-11-27T21:40:00Z')); // KST 11-28 06:40
  assert.equal(ed.id, '2026-11-28-am');
  assert.deepEqual(validateEdition(ed, ed.id), []);
  assert.equal(ed.regions.length, 3);
  assert.equal(ed.regions[0].items.length, 7); // KR 은 최대 12개라 가진 7개 전부
  const pm = buildEdition({ KR: mk('KR', 1), US: mk('US', 1), GB: mk('GB', 1) }, new Date('2026-11-28T09:40:00Z')); // KST 18:40
  assert.equal(pm.id, '2026-11-28-pm');
  assert.deepEqual(validateEdition(pm, pm.id), []);
});

test('같은 링크 중복 제거, 설명이 없으면 안내 문구', () => {
  const dup = { name: 'KR', flag: '🇰🇷', items: [{ title: 'a', link: 'https://e.com/1', description: '', source: 'S', lang: 'ko' }, { title: 'a2', link: 'https://e.com/1', description: '', source: 'S', lang: 'ko' }] };
  const ed = buildEdition({ KR: dup, US: mk('US', 1), GB: mk('GB', 1) }, new Date('2026-11-28T00:00:00Z'));
  assert.equal(ed.regions[0].items.length, 1);
  assert.match(ed.regions[0].items[0].summary, /제목만/);
});

test('한국·미국은 분야별로 많이(12개), 나머지는 5개, 분야 태그와 지역 요약', () => {
  const many = (code, topics) => ({ name: code, flag: '🏳', items: Array.from({ length: 20 }, (_, i) => ({ title: `${code} ${i}`, link: `https://e.com/${code}/${i}`, description: '충분히 긴 설명이 들어 있는 문장이에요 여기.', source: 'S', lang: 'en', topic: topics[i % topics.length] })) });
  const ed = buildEdition({ KR: many('KR', ['politics', 'economy', 'tech']), US: many('US', ['politics', 'economy']), GB: many('GB', ['world']) }, new Date('2026-11-28T00:00:00Z'));
  assert.deepEqual(validateEdition(ed, ed.id), []);
  const kr = ed.regions.find((r) => r.code === 'KR');
  assert.equal(kr.items.length, 12);
  assert.equal(ed.regions.find((r) => r.code === 'GB').items.length, 5);
  assert.deepEqual(kr.items[0].tags, ['정치']);
  assert.match(kr.summary, /정치 4/);
  assert.match(ed.headline[0], /^🏳 KR/);
});
