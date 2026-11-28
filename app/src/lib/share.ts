import type { Bookmark, Edition, Item, Region } from './types';

/** 공유용 텍스트: 제목 + 요약 + 출처 URL */
export function shareText(item: Item, region: Pick<Region, 'name' | 'flag'>, editionDate: string): string {
  const lines = [`${region.flag} [${region.name}] ${item.title}`, '', item.summary];
  if (item.whyItMatters) lines.push('', `왜 중요한가: ${item.whyItMatters}`);
  if (item.confidence === 'low') lines.push('', '※ 미확인 내용이 포함돼 있어요');
  if (item.sources.length) lines.push('', ...item.sources.map((s) => `${s.name}: ${s.url}`));
  lines.push('', `World Brief · ${editionDate}`);
  return lines.join('\n');
}

/** 북마크: 원문이 캐시에서 지워져도 보이도록 항목 전체를 스냅샷으로 저장 */
export function makeBookmark(edition: Pick<Edition, 'id' | 'date'>, region: Pick<Region, 'code' | 'name' | 'flag'>, item: Item, note = '', now: Date = new Date()): Bookmark {
  return {
    key: `${edition.id}/${item.id}`, editionId: edition.id, editionDate: edition.date, regionCode: region.code, regionName: region.name, flag: region.flag,
    item: JSON.parse(JSON.stringify(item)) as Item, note: note.slice(0, 500), savedAt: now.toISOString(),
  };
}
export const bookmarkKey = (editionId: string, itemId: string) => `${editionId}/${itemId}`;
