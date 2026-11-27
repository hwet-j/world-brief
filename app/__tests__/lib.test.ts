import { byTopic, compareRegions, tagCounts, tagTimeline, topicCounts } from '../src/lib/explore';
import { groupByTopic, knownRegions, maxImportance, orderRegions, sortItems, TOPIC_LABEL } from '../src/lib/group';
import { highlightRanges, searchEditions } from '../src/lib/search';
import { bookmarkKey, makeBookmark, shareText } from '../src/lib/share';
import { dateLabel, relative, slotLabel } from '../src/lib/time';
import { dateOnly, formatBytes } from '../src/lib/misc';
import { allEditions, edition } from './helpers';

test('검색: 한글 부분일치, 여러 낱말 AND, 태그·출처명, 최신 회차 우선', () => {
  const eds = allEditions();
  const h1 = searchEditions(eds, '반도체');
  expect(h1.length).toBe(3);
  expect(h1[0].editionId).toBe('2026-11-27-pm');
  expect(searchEditions(eds, '반도체 후속').map((h) => h.editionId)).toEqual(['2026-11-27-pm', '2026-11-27-am']);
  expect(searchEditions(eds, '예시통신').length).toBeGreaterThan(10);
  expect(searchEditions(eds, '복지')[0].field).toBe('tag');
  expect(searchEditions(eds, '없는낱말')).toEqual([]);
  expect(searchEditions(eds, '   ')).toEqual([]);
  expect(searchEditions(eds, '반도체', 2)).toHaveLength(2);
  expect(searchEditions(eds, '미국')[0]).toBeUndefined(); // 지역 이름은 검색 대상이 아님
});

test('하이라이트 구간: 겹치면 합치고 대소문자 무시', () => {
  expect(highlightRanges('AI 규제와 ai 정책', 'ai')).toEqual([[0, 2], [7, 9]]);
  expect(highlightRanges('반도체 수출 반도체', '반도체 수출')).toEqual([[0, 3], [4, 6], [7, 10]]);
  expect(highlightRanges('abc', 'ab bc')).toEqual([[0, 3]]);
  expect(highlightRanges('abc', '')).toEqual([]);
});

test('정렬·그룹: 중요도 → 신뢰도, 주제 순서', () => {
  const items = edition('a').regions[0].items.concat(edition('a').regions[1].items);
  const sorted = sortItems(items);
  expect(sorted.map((i) => i.id)).toEqual(['kr-1', 'us-1', 'us-2', 'kr-2']);
  const groups = groupByTopic(items);
  expect(groups.map((g) => g.topic)).toEqual(['politics', 'economy', 'society']);
  expect(groups[1].items.map((i) => i.id)).toEqual(['kr-1', 'us-2']);
  expect(TOPIC_LABEL.economy).toBe('경제');
});

test('지역 순서·숨김', () => {
  const regions = edition('b').regions; // KR US CN GLOBAL
  expect(orderRegions(regions, { hiddenRegions: [], regionOrder: [] }).map((r) => r.code)).toEqual(['KR', 'US', 'CN', 'GLOBAL']);
  expect(orderRegions(regions, { hiddenRegions: ['US'], regionOrder: ['GLOBAL', 'KR'] }).map((r) => r.code)).toEqual(['GLOBAL', 'KR', 'CN']);
  expect(orderRegions(regions, { hiddenRegions: ['US'], regionOrder: [] }, true)).toHaveLength(4);
  expect(maxImportance(regions[0])).toBe(3);
  const known = knownRegions(allEditions()).map((r) => r.code);
  expect(known).toEqual(expect.arrayContaining(['KR', 'US', 'JP', 'CN', 'GLOBAL', 'EU', 'GB', 'RU', 'ME', 'IN']));
  expect(new Set(known).size).toBe(known.length);
});

test('주제별 모아보기와 개수', () => {
  const b = edition('b');
  expect(topicCounts(b).find((c) => c.topic === 'politics')?.count).toBe(2);
  expect(byTopic(b, 'politics').map((x) => `${x.regionCode}/${x.item.id}`)).toEqual(['US/us-1', 'KR/kr-2']);
  expect(byTopic(null, 'politics')).toEqual([]);
});

test('태그 인기순과 타임라인(날짜순, 같은 날 중복은 최신 회차만)', () => {
  const eds = allEditions();
  const tags = tagCounts(eds);
  expect(tags[0]).toMatchObject({ tag: '반도체', count: 3, days: 2 });
  const tl = tagTimeline(eds, '반도체');
  expect(tl.map((d) => d.date)).toEqual(['2026-11-26', '2026-11-27']);
  expect(tl[1].refs).toHaveLength(1);
  expect(tl[1].refs[0].editionId).toBe('2026-11-27-pm');
  expect(tagTimeline(eds, '복지').map((d) => d.refs.length)).toEqual([1, 1]);
  expect(tagTimeline(eds, '없음')).toEqual([]);
});

test('지역 비교: 같은 주제끼리, 항목 많은 주제 먼저', () => {
  const rows = compareRegions(edition('b'), 'KR', 'US');
  expect(rows[0].topic).toBe('politics');
  expect(rows[0].left.map((i) => i.id)).toEqual(['kr-2']);
  expect(rows[0].right.map((i) => i.id)).toEqual(['us-1']);
  const econ = rows.find((r) => r.topic === 'economy')!;
  expect(econ.left).toHaveLength(1);
  expect(econ.right).toHaveLength(0);
  expect(compareRegions(null, 'KR', 'US')).toEqual([]);
  expect(compareRegions(edition('b'), 'KR', 'ZZ').every((r) => r.right.length === 0)).toBe(true);
});

test('상대 시각·날짜 표기', () => {
  const now = new Date('2026-11-27T12:00:00+09:00');
  expect(relative('2026-11-27T11:59:30+09:00', now)).toBe('방금');
  expect(relative('2026-11-27T11:30:00+09:00', now)).toBe('30분 전');
  expect(relative('2026-11-27T07:15:00+09:00', now)).toBe('4시간 전');
  expect(relative('2026-11-26T09:00:00+09:00', now)).toBe('어제');
  expect(relative('2026-11-20T12:00:00+09:00', now)).toBe('7일 전');
  expect(relative('이상한값', now)).toBe('');
  expect(relative('2026-11-27T13:00:00+09:00', now)).toBe('방금');
  expect(dateLabel('2026-11-27', new Date(2026, 5, 1))).toBe('11월 27일 (금)');
  expect(dateLabel('2025-01-01', new Date(2026, 5, 1))).toBe('2025년 1월 1일 (수)');
  expect(slotLabel('am')).toBe('아침');
  expect(dateOnly('2026-11-27T07:15:00+09:00', 'x')).toBe('2026-11-27');
  expect(dateOnly('이상', '2026-01-01')).toBe('2026-01-01');
  expect(formatBytes(512)).toBe('512B');
  expect(formatBytes(2048)).toBe('2KB');
  expect(formatBytes(3 * 1024 * 1024)).toBe('3.0MB');
});

test('공유 텍스트: 제목·요약·출처, 미확인 안내', () => {
  const b = edition('a');
  const low = b.regions[1].items[1];
  const t = shareText(low, b.regions[1], b.date);
  expect(t).toContain('🇺🇸 [미국] [예시] 금리 관련 발언');
  expect(t).toContain('미확인 내용이 포함');
  expect(t).toContain('예시통신: https://example.com/us-2-a');
  expect(t.endsWith('World Brief · 2026-11-26')).toBe(true);
  expect(shareText(b.regions[0].items[0], b.regions[0], b.date)).toContain('왜 중요한가:');
});

test('북마크: 항목을 스냅샷으로 복사해 원문 변경과 무관, 메모 길이 제한', () => {
  const b = edition('b');
  const item = b.regions[0].items[0];
  const bm = makeBookmark(b, b.regions[0], item, 'x'.repeat(600), new Date('2026-11-27T01:00:00Z'));
  expect(bm.key).toBe(bookmarkKey('2026-11-27-am', 'kr-1'));
  expect(bm.note).toHaveLength(500);
  expect(bm.savedAt).toBe('2026-11-27T01:00:00.000Z');
  item.title = '바뀜';
  expect(bm.item.title).not.toBe('바뀜');
  expect(bm.item).not.toBe(item);
  expect(bm.regionName).toBe('대한민국');
});
