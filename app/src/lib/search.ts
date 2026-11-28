import type { Edition, Item, Region } from './types';

export interface Hit { editionId: string; editionDate: string; regionCode: string; regionName: string; flag: string; item: Item; score: number; field: 'title' | 'summary' | 'tag' | 'source' }

const norm = (s: string) => s.normalize('NFC').toLowerCase();

/** 캐시된 모든 회차에서 제목·요약·태그·출처명을 부분일치로 찾는다 (공백으로 나눈 모든 낱말이 포함돼야 함, 최신 회차 우선) */
export function searchEditions(editions: Edition[], query: string, limit = 80): Hit[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const out: Hit[] = [];
  for (const e of editions) {
    for (const r of e.regions) {
      for (const it of r.items) {
        const title = norm(it.title), summary = norm(`${it.summary} ${it.whyItMatters ?? ''}`);
        const tags = it.tags.map(norm), srcs = it.sources.map((s) => norm(s.name));
        const hay = [title, summary, ...tags, ...srcs].join('\n');
        if (!words.every((w) => hay.includes(w))) continue;
        const inTitle = words.some((w) => title.includes(w));
        const inTag = words.some((w) => tags.some((t) => t.includes(w)));
        const inSrc = words.some((w) => srcs.some((s) => s.includes(w)));
        const field = inTitle ? 'title' : inTag ? 'tag' : inSrc ? 'source' : 'summary';
        const score = (inTitle ? 4 : 0) + (inTag ? 3 : 0) + (inSrc ? 1 : 0) + it.importance;
        out.push({ editionId: e.id, editionDate: e.date, regionCode: r.code, regionName: r.name, flag: r.flag, item: it, score, field });
      }
    }
  }
  return out.sort((a, b) => b.editionId.localeCompare(a.editionId) || b.score - a.score).slice(0, limit);
}

/** 본문에서 검색어가 나타나는 구간을 [시작, 끝) 로 돌려준다 (하이라이트용, 겹치면 합침) */
export function highlightRanges(text: string, query: string): [number, number][] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  const hay = norm(text);
  const spans: [number, number][] = [];
  for (const w of words) {
    let i = hay.indexOf(w);
    while (i >= 0) { spans.push([i, i + w.length]); i = hay.indexOf(w, i + w.length); }
  }
  spans.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([...s]);
  }
  return merged;
}

export type RegionRef = Pick<Region, 'code' | 'name' | 'flag'>;
