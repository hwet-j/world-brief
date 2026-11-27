import { sortItems } from './group';
import type { Edition, Item, Topic } from './types';

export interface Ref { editionId: string; editionDate: string; slot: 'am' | 'pm'; regionCode: string; regionName: string; flag: string; item: Item }

function* walk(editions: Edition[]): Generator<Ref> {
  for (const e of editions) for (const r of e.regions) for (const item of r.items) yield { editionId: e.id, editionDate: e.date, slot: e.slot, regionCode: r.code, regionName: r.name, flag: r.flag, item };
}

/** 한 주제의 모든 지역 항목 (가장 최근 회차 하나 기준, 중요도 순) */
export function byTopic(edition: Edition | null, topic: Topic): Ref[] {
  if (!edition) return [];
  const refs = [...walk([edition])].filter((x) => x.item.topic === topic);
  const order = new Map(sortItems(refs.map((x) => x.item)).map((it, i) => [it.id, i]));
  return refs.sort((a, b) => (order.get(a.item.id) ?? 0) - (order.get(b.item.id) ?? 0));
}

export function topicCounts(edition: Edition | null): { topic: Topic; count: number }[] {
  const m = new Map<Topic, number>();
  if (edition) for (const x of walk([edition])) m.set(x.item.topic, (m.get(x.item.topic) ?? 0) + 1);
  return [...m.entries()].map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count);
}

/** 태그별 등장 횟수(회차 안에서 중복 항목은 한 번) 인기순 */
export function tagCounts(editions: Edition[]): { tag: string; count: number; days: number }[] {
  const m = new Map<string, { count: number; days: Set<string> }>();
  for (const x of walk(editions)) for (const t of new Set(x.item.tags)) {
    const e = m.get(t) ?? { count: 0, days: new Set() };
    e.count++; e.days.add(x.editionDate); m.set(t, e);
  }
  return [...m.entries()].map(([tag, v]) => ({ tag, count: v.count, days: v.days.size })).sort((a, b) => b.count - a.count || b.days - a.days || a.tag.localeCompare(b.tag, 'ko'));
}

export interface TimelineDay { date: string; refs: Ref[] }
/** 태그가 달린 항목을 날짜순(오래된 → 최신) 타임라인으로. 같은 날 am/pm 에 같은 항목 id/제목이 반복되면 최신 회차 것만 */
export function tagTimeline(editions: Edition[], tag: string): TimelineDay[] {
  const days = new Map<string, Ref[]>();
  for (const x of walk([...editions].sort((a, b) => a.id.localeCompare(b.id)))) {
    if (!x.item.tags.includes(tag)) continue;
    const list = days.get(x.editionDate) ?? [];
    const dup = list.findIndex((r) => r.regionCode === x.regionCode && (r.item.id === x.item.id || r.item.title === x.item.title));
    if (dup >= 0) list[dup] = x; else list.push(x);
    days.set(x.editionDate, list);
  }
  return [...days.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, refs]) => ({ date, refs }));
}

/** 두 지역을 같은 주제끼리 나란히: 주제마다 { left, right } (항목 없으면 빈 배열). 양쪽 모두 없는 주제는 제외 */
export function compareRegions(edition: Edition | null, a: string, b: string): { topic: Topic; left: Item[]; right: Item[] }[] {
  if (!edition) return [];
  const get = (code: string) => edition.regions.find((r) => r.code === code)?.items ?? [];
  const L = get(a), R = get(b);
  const topics = new Set<Topic>([...L, ...R].map((i) => i.topic));
  return [...topics].map((topic) => ({ topic, left: sortItems(L.filter((i) => i.topic === topic)), right: sortItems(R.filter((i) => i.topic === topic)) }))
    .sort((x, y) => (y.left.length + y.right.length) - (x.left.length + x.right.length));
}
