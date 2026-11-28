import type { BriefIndex, Confidence, Edition, IndexEntry, Item, Parsed, Region, Source, Term, Topic, Watch } from './types';

export const TOPICS: Topic[] = ['politics', 'economy', 'society', 'world', 'tech', 'security', 'energy', 'climate', 'health', 'culture', 'other'];
const CONF: Confidence[] = ['high', 'medium', 'low'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SUPPORTED = 1;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 2000): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** https 주소만 허용 (앱에서 열 링크 검사용) */
export const isHttps = (u: unknown): u is string => typeof u === 'string' && /^https:\/\/[^\s]+$/.test(u) && u.length <= 500;

function parseSource(raw: unknown): Source | null {
  if (!isObj(raw)) return null;
  const name = str(raw.name, 60);
  if (!name || !isHttps(raw.url)) return null;
  return { name, url: raw.url, lang: str(raw.lang, 8) };
}

function parseTerm(raw: unknown): Term | null {
  if (!isObj(raw)) return null;
  const term = str(raw.term, 40);
  const meaning = str(raw.meaning, 300);
  return term && meaning ? { term, meaning } : null;
}

function parseItem(raw: unknown, where: string, warnings: string[]): Item | null {
  if (!isObj(raw)) { warnings.push(`${where}: 항목이 객체가 아니라 건너뜀`); return null; }
  const id = str(raw.id, 40);
  const title = str(raw.title, 200);
  const summary = str(raw.summary, 1500);
  if (!id || !title || !summary) { warnings.push(`${where}: id/제목/요약이 없어 건너뜀`); return null; }
  const topic = TOPICS.includes(raw.topic as Topic) ? (raw.topic as Topic) : 'other';
  const importance = raw.importance === 3 || raw.importance === 2 || raw.importance === 1 ? raw.importance : 2;
  const confidence = CONF.includes(raw.confidence as Confidence) ? (raw.confidence as Confidence) : 'medium';
  const sources = arr(raw.sources).map(parseSource).filter((s): s is Source => !!s).slice(0, 6);
  const tags = arr(raw.tags).map((t) => str(t, 40)).filter((t): t is string => !!t).slice(0, 8);
  const pub = typeof raw.publishedAt === 'string' && DATE_RE.test(raw.publishedAt) ? raw.publishedAt : undefined;
  return { id, topic, title, summary, whyItMatters: str(raw.whyItMatters, 400), easy: str(raw.easy, 400), terms: arr(raw.terms).map(parseTerm).filter((x): x is Term => !!x).slice(0, 5), importance, confidence, publishedAt: pub, isUpdate: raw.isUpdate === true, tags, sources };
}

function parseRegion(raw: unknown, ri: number, warnings: string[]): Region | null {
  if (!isObj(raw)) { warnings.push(`지역 ${ri + 1}: 형식 오류로 건너뜀`); return null; }
  const code = str(raw.code, 12);
  if (!code) { warnings.push(`지역 ${ri + 1}: code 가 없어 건너뜀`); return null; }
  const seen = new Set<string>();
  const items: Item[] = [];
  arr(raw.items).forEach((it, i) => {
    const p = parseItem(it, `${code} 항목 ${i + 1}`, warnings);
    if (p && !seen.has(p.id)) { seen.add(p.id); items.push(p); } else if (p) warnings.push(`${code}: 중복 id(${p.id}) 건너뜀`);
  });
  return { code, name: str(raw.name, 40) ?? code, flag: str(raw.flag, 10) ?? '🌐', summary: str(raw.summary, 400) ?? '', items };
}

export function parseEdition(raw: unknown): Parsed<Edition> {
  const warnings: string[] = [];
  if (!isObj(raw)) return { value: null, warnings: ['회차 데이터가 객체가 아니에요'], futureSchema: false };
  const futureSchema = typeof raw.schemaVersion === 'number' && raw.schemaVersion > SUPPORTED;
  const id = str(raw.id, 40);
  const date = typeof raw.date === 'string' && DATE_RE.test(raw.date) ? raw.date : undefined;
  if (!id || !date) return { value: null, warnings: ['id 또는 date 가 올바르지 않아요'], futureSchema };
  const regions = arr(raw.regions).map((r, i) => parseRegion(r, i, warnings)).filter((r): r is Region => !!r);
  const watchlist = arr(raw.watchlist).map((w): Watch | null => {
    if (!isObj(w)) return null;
    const title = str(w.title, 200);
    return title && typeof w.date === 'string' && DATE_RE.test(w.date) ? { date: w.date, title, region: str(w.region, 12) } : null;
  }).filter((w): w is Watch => !!w).slice(0, 12);
  return {
    value: {
      schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1, id, date,
      slot: raw.slot === 'pm' ? 'pm' : 'am', generatedAt: str(raw.generatedAt, 40) ?? `${date}T00:00:00+09:00`,
      title: str(raw.title, 120) ?? `${date} 브리핑`,
      headline: arr(raw.headline).map((h) => str(h, 200)).filter((h): h is string => !!h).slice(0, 6),
      regions, watchlist, notes: str(raw.notes, 600), recap: str(raw.recap, 600),
    },
    warnings, futureSchema,
  };
}

export function parseIndex(raw: unknown): Parsed<BriefIndex> {
  const warnings: string[] = [];
  if (!isObj(raw)) return { value: null, warnings: ['목록 데이터가 객체가 아니에요'], futureSchema: false };
  const futureSchema = typeof raw.schemaVersion === 'number' && raw.schemaVersion > SUPPORTED;
  const editions: IndexEntry[] = [];
  arr(raw.editions).forEach((e, i) => {
    if (!isObj(e)) return void warnings.push(`목록 ${i + 1}: 형식 오류로 건너뜀`);
    const id = str(e.id, 40);
    const date = typeof e.date === 'string' && DATE_RE.test(e.date) ? e.date : undefined;
    if (!id || !date) return void warnings.push(`목록 ${i + 1}: id/date 오류로 건너뜀`);
    editions.push({
      id, date, slot: e.slot === 'pm' ? 'pm' : 'am', title: str(e.title, 120) ?? id,
      headline: arr(e.headline).map((h) => str(h, 200)).filter((h): h is string => !!h).slice(0, 3),
      regions: arr(e.regions).map((c) => str(c, 12)).filter((c): c is string => !!c),
      itemCount: typeof e.itemCount === 'number' ? e.itemCount : 0, path: str(e.path, 200) ?? `data/editions/${id}.json`,
    });
  });
  editions.sort((a, b) => b.id.localeCompare(a.id));
  return {
    value: { schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1, updatedAt: str(raw.updatedAt, 40) ?? '', latest: str(raw.latest, 40) ?? editions[0]?.id ?? null, editions },
    warnings, futureSchema,
  };
}
