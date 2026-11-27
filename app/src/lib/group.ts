import type { Edition, Item, Prefs, Region, Topic } from './types';

export const TOPIC_LABEL: Record<Topic, string> = {
  politics: '정치', economy: '경제', society: '사회', world: '국제', tech: '기술', security: '안보', energy: '에너지', climate: '기후', health: '보건', culture: '문화', other: '기타',
};
export const TOPIC_ICON: Record<Topic, string> = {
  politics: '🏛️', economy: '💹', society: '👥', world: '🌐', tech: '💻', security: '🛡️', energy: '⚡', climate: '🌡️', health: '🩺', culture: '🎭', other: '📌',
};
export const TOPIC_ORDER: Topic[] = ['politics', 'economy', 'security', 'world', 'tech', 'energy', 'climate', 'society', 'health', 'culture', 'other'];

/** 중요도(높은 순) → 신뢰도 → 원래 순서 */
export function sortItems(items: Item[]): Item[] {
  const conf = { high: 0, medium: 1, low: 2 } as const;
  return items.map((it, i) => ({ it, i })).sort((a, b) => b.it.importance - a.it.importance || conf[a.it.confidence] - conf[b.it.confidence] || a.i - b.i).map((x) => x.it);
}

export interface TopicGroup { topic: Topic; label: string; items: Item[] }
/** 주제별 그룹 (주제 순서는 TOPIC_ORDER, 그룹 안은 sortItems) */
export function groupByTopic(items: Item[]): TopicGroup[] {
  const map = new Map<Topic, Item[]>();
  for (const it of items) map.set(it.topic, [...(map.get(it.topic) ?? []), it]);
  return TOPIC_ORDER.filter((t) => map.has(t)).map((t) => ({ topic: t, label: TOPIC_LABEL[t], items: sortItems(map.get(t)!) }));
}

/** 관심 지역 설정(숨김·순서)을 적용한 지역 목록. 순서에 없는 지역은 원래 순서로 뒤에 붙는다 */
export function orderRegions(regions: Region[], prefs: Pick<Prefs, 'hiddenRegions' | 'regionOrder'>, includeHidden = false): Region[] {
  const visible = regions.filter((r) => includeHidden || !prefs.hiddenRegions.includes(r.code));
  const pos = (c: string) => { const i = prefs.regionOrder.indexOf(c); return i < 0 ? 1e6 : i; };
  return visible.map((r, i) => ({ r, i })).sort((a, b) => pos(a.r.code) - pos(b.r.code) || a.i - b.i).map((x) => x.r);
}

export const maxImportance = (r: Region): number => r.items.reduce((m, it) => Math.max(m, it.importance), 0);

/** 설정 화면용: 알려진 모든 지역 코드(캐시된 회차들에서 모은 것 + 기본 목록) */
export const DEFAULT_REGION_CODES = ['KR', 'US', 'JP', 'CN', 'EU', 'GB', 'RU', 'ME', 'IN', 'GLOBAL'];
export function knownRegions(editions: Edition[]): { code: string; name: string; flag: string }[] {
  const m = new Map<string, { code: string; name: string; flag: string }>();
  for (const e of editions) for (const r of e.regions) if (!m.has(r.code)) m.set(r.code, { code: r.code, name: r.name, flag: r.flag });
  for (const c of DEFAULT_REGION_CODES) if (!m.has(c)) m.set(c, { code: c, name: c, flag: '🌐' });
  return [...m.values()];
}
