/** 앱이 쓰는 브리핑 데이터 형태 (원본 스키마: 저장소 docs/schema.md). 알 수 없는 필드는 파서가 버린다 */
export type Topic = 'politics' | 'economy' | 'society' | 'world' | 'tech' | 'security' | 'energy' | 'climate' | 'health' | 'culture' | 'other';
export type Confidence = 'high' | 'medium' | 'low';

export interface Source { name: string; url: string; lang?: string }
export interface Item {
  id: string; topic: Topic; title: string; summary: string; whyItMatters?: string;
  importance: 1 | 2 | 3; confidence: Confidence; publishedAt?: string; isUpdate: boolean; tags: string[]; sources: Source[];
}
export interface Region { code: string; name: string; flag: string; summary: string; items: Item[] }
export interface Watch { date: string; title: string; region?: string }
export interface Edition {
  schemaVersion: number; id: string; date: string; slot: 'am' | 'pm'; generatedAt: string; title: string;
  headline: string[]; regions: Region[]; watchlist: Watch[]; notes?: string;
}
export interface IndexEntry { id: string; date: string; slot: 'am' | 'pm'; title: string; headline: string[]; regions: string[]; itemCount: number; path: string }
export interface BriefIndex { schemaVersion: number; updatedAt: string; latest: string | null; editions: IndexEntry[] }

export interface Parsed<T> { value: T | null; warnings: string[]; futureSchema: boolean }

export interface Bookmark {
  key: string; // `${editionId}/${itemId}`
  editionId: string; editionDate: string; regionCode: string; regionName: string; flag: string;
  item: Item; note: string; savedAt: string;
}

export type FontScale = 'small' | 'normal' | 'large' | 'xlarge';
export type ThemeMode = 'system' | 'light' | 'dark';
export interface Prefs {
  owner: string; repo: string; branch: string;
  hiddenRegions: string[]; regionOrder: string[];
  fontScale: FontScale; theme: ThemeMode;
  refreshMinutes: number; keepEditions: number;
  notify: boolean; notifyHour: number; notifyMinute: number;
}
export const DEFAULT_PREFS: Prefs = {
  owner: 'hwet-j', repo: 'world-brief', branch: 'main',
  hiddenRegions: [], regionOrder: [], fontScale: 'normal', theme: 'system',
  refreshMinutes: 30, keepEditions: 90, notify: false, notifyHour: 7, notifyMinute: 40,
};
