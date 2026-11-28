import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickCandidates } from '../candidates.mjs';
import { compose } from '../compose.mjs';
import { validateEdition } from '../lib.mjs';

const art = (source, topic, n, extra = {}) => ({ source, lang: 'ko', topic, title: `제목 ${n}`, link: `https://e.com/${source}/${n}`, description: '충분히 긴 소개문이 들어 있는 기사 설명이에요.', publishedAt: '2026-11-28', ...extra });
const cands = { id: '2026-11-28-pm', regions: { KR: [art('A', 'politics', 1), art('B', 'politics', 2), art('A', 'economy', 3)], US: [art('N', 'tech', 4, { lang: 'en' })] } };
const picks = {
  headline: ['하나', '둘', '셋'],
  regions: {
    KR: { summary: '한국 요약', items: [{ refs: ['KR0', 'KR1'], title: '병합 항목', summary: '두 출처가 같은 일을 다뤘어요. 요약 문장이에요.', importance: 3, whyItMatters: '중요해요' }, { refs: ['KR2'], title: '단일 항목', summary: '한 출처만 다룬 소식이에요. 요약이에요.', importance: 1, tags: ['반도체'] }] },
    US: { summary: '미국 요약', items: [{ refs: ['US0'], title: '미국 항목', summary: '미국 기술 소식이에요. 요약 문장이에요.', importance: 2 }] },
  },
};

test('여러 출처를 묶으면 high, 한 곳이면 medium, 스키마 검증 통과', () => {
  const e = compose(cands, picks, new Date('2026-11-28T10:00:00Z'));
  assert.deepEqual(validateEdition(e, e.id), []);
  assert.equal(e.id, '2026-11-28-pm');
  const [a, b] = e.regions[0].items;
  assert.equal(a.confidence, 'high');
  assert.equal(a.sources.length, 2);
  assert.equal(b.confidence, 'medium');
  assert.deepEqual(b.tags, ['경제', '반도체']);
  assert.equal(e.regions[1].items[0].sources[0].lang, 'en');
});

test('없는 후보를 가리키면 오류', () => {
  assert.throws(() => compose(cands, { ...picks, regions: { KR: { summary: 'x', items: [{ refs: ['KR9'], title: 't', summary: 'ssssssssssssssssssssss', importance: 1 }] } } }), /후보에 없어요/);
});

test('후보 추리기: 분야 쿼터와 여러 출처가 다룬 기사 우선', () => {
  const mk = (src, n, title) => ({ source: src, lang: 'ko', topic: 'politics', title, link: `https://e.com/${src}${n}`, description: '설명 '.repeat(10), publishedAt: '2026-11-28' });
  const raw = { id: '2026-11-28-pm', regions: { KR: { items: [mk('A', 1, '대통령 데이터센터 착공식 참석'), mk('B', 2, '대통령 데이터센터 착공식 축사'), mk('C', 3, '전혀 다른 소식 하나')] }, US: { items: [] } } };
  const c = pickCandidates(raw);
  assert.ok(['A', 'B'].includes(c.KR[0].source));
  assert.equal(c.KR.length, 3);
  assert.deepEqual(c.US, []);
});
