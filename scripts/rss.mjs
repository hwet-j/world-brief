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
    out.push({ title, link, description });
    if (out.length >= limit) break;
  }
  return out;
}

const cut = (s, n) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

const NOTE_ONLY = '제목만 모았어요. 자세한 내용은 출처 링크에서 확인하세요.';

/** 지역별 피드 결과 → 회차 객체. feedsByRegion: { KR: { name, flag, items: [{title, link, description, source, lang, topic?}] } } */
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
      if (n > 5) break;
      const summary = it.description && it.description.length >= 20 && it.description !== it.title ? cut(it.description, 240) : NOTE_ONLY;
      items.push({
        id: `${code.toLowerCase()}-${n}`,
        topic: TOPICS.includes(it.topic) ? it.topic : 'other',
        title: cut(it.title, 100),
        summary,
        importance: n === 1 ? 2 : 1,
        confidence: 'medium',
        publishedAt: date,
        tags: [],
        sources: [{ name: it.source, url: it.link, lang: it.lang }],
      });
    }
    regions.push({ code, name: r.name, flag: r.flag, summary: cut(`${r.name} 주요 기사 ${items.length}건 (자동 수집 헤드라인)`, 240), items });
  }
  const headline = regions.slice(0, 5).map((r) => cut(`${r.flag} ${r.items[0].title}`, 120));
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
