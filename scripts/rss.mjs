// RSS/Atom 헤드라인을 회차 JSON 으로 만드는 순수 로직 (외부 의존성 없음). 요약·번역은 하지 않는다.
import { REGIONS, TOPICS } from './lib.mjs';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, g) => {
    if (g[0] === '#') {
      const code = g[1].toLowerCase() === 'x' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[g.toLowerCase()] ?? m;
  });
const strip = (s) => decode(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (block, name) => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block);
  return m ? m[1] : '';
};

/** RSS 2.0 / Atom 문자열 → [{title, link, description}] (최대 limit개) */
export function parseFeed(xml, limit = 10) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  const out = [];
  for (const b of blocks) {
    const title = strip(tag(b, 'title'));
    let link = strip(tag(b, 'link'));
    if (!link) link = /<link[^>]*\shref=["']([^"']+)["']/i.exec(b)?.[1] ?? '';
    link = decode(link).trim();
    const description = strip(tag(b, 'description') || tag(b, 'summary') || tag(b, 'content'));
    if (!title || !/^https:\/\/\S+$/.test(link) || link.length > 500) continue;
    const raw = strip(tag(b, 'pubDate') || tag(b, 'dc:date') || tag(b, 'published') || tag(b, 'updated'));
    const t = raw ? Date.parse(raw) : NaN;
    out.push({ title, link, description, publishedAt: Number.isNaN(t) ? null : new Date(t + 9 * 3_600_000).toISOString().slice(0, 10) });
    if (out.length >= limit) break;
  }
  return out;
}

const cut = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

const NOTE_ONLY = '제목만 모았어요. 자세한 내용은 출처 링크에서 확인하세요.';

/** 지역별 피드 결과 → 회차 객체. feedsByRegion: { KR: { name, flag, items: [{title, link, description, source, lang, topic?}] } } */
const TOPIC_LABEL = { politics: '정치', economy: '경제', society: '사회', world: '국제', tech: 'IT·과학', security: '안보', energy: '에너지', climate: '기후', health: '보건', culture: '문화', other: '기타' };
/** 지역별 최대 항목 수: 비중이 큰 지역은 더 많이 */
export const REGION_CAP = { KR: 12, US: 12 };
const DEFAULT_CAP = 5;

export function buildEdition(feedsByRegion, now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3_600_000);
  const date = kst.toISOString().slice(0, 10);
  const slot = kst.getUTCHours() < 12 ? 'am' : 'pm';
  const regions = [];
  for (const code of REGIONS) {
    const r = feedsByRegion[code];
    if (!r?.items?.length) continue;
    const seen = new Set();
    const items = [];
    for (const it of r.items) {
      if (seen.has(it.link)) continue;
      seen.add(it.link);
      const n = items.length + 1;
      if (n > (REGION_CAP[code] ?? DEFAULT_CAP)) break;
      const summary = it.description && it.description.length >= 20 && it.description !== it.title ? cut(it.description, 420) : NOTE_ONLY;
      items.push({
        id: `${code.toLowerCase()}-${n}`,
        topic: TOPICS.includes(it.topic) ? it.topic : 'other',
        title: cut(it.title, 100),
        summary,
        importance: n === 1 ? 2 : 1,
        confidence: 'medium',
        publishedAt: /^\d{4}-\d{2}-\d{2}$/.test(it.publishedAt ?? '') ? it.publishedAt : date,
        tags: TOPIC_LABEL[it.topic] ? [TOPIC_LABEL[it.topic]] : [],
        sources: [{ name: it.source, url: it.link, lang: it.lang }],
      });
    }
    const counts = {};
    for (const it of items) counts[it.topic] = (counts[it.topic] ?? 0) + 1;
    const parts = Object.entries(counts).map(([t, n]) => `${TOPIC_LABEL[t] ?? t} ${n}`).join(' · ');
    regions.push({ code, name: r.name, flag: r.flag, summary: cut(`${r.name} 주요 기사 ${items.length}건 (${parts}) — 자동 수집 헤드라인`, 240), items });
  }
  const lead = (r, topic) => r.items.find((x) => x.topic === topic) ?? r.items[0];
  const kr = regions.find((r) => r.code === 'KR');
  const us = regions.find((r) => r.code === 'US');
  const picks = [kr && lead(kr, 'politics'), kr && lead(kr, 'economy'), us && lead(us, 'politics'), us && lead(us, 'economy'), us && lead(us, 'tech')].filter(Boolean);
  const flagOf = (it) => regions.find((r) => r.items.includes(it))?.flag ?? '';
  const uniq = [...new Set(picks)];
  for (const r of regions) { if (uniq.length >= 3) break; if (!uniq.includes(r.items[0])) uniq.push(r.items[0]); }
  const headline = uniq.slice(0, 5).map((it) => cut(`${flagOf(it)} ${it.title}`, 120));
  const [, m, d] = date.split('-');
  return {
    schemaVersion: 1,
    id: `${date}-${slot}`,
    date,
    slot,
    generatedAt: `${kst.toISOString().slice(0, 19)}+09:00`,
    title: `${Number(m)}월 ${Number(d)}일 ${slot === 'am' ? '아침' : '저녁'} 헤드라인`,
    headline,
    regions,
    notes: '자동 수집한 RSS 헤드라인이에요. 번역과 요약은 없고 원문 언어 그대로예요. 사실 확인은 출처 링크에서 해 주세요.',
  };
}
