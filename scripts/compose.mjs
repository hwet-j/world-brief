#!/usr/bin/env node
// 요약 결과(picks.json)와 후보 파일(candidates.mjs --out)을 합쳐 data/editions/<id>.json 을 만든다.
//   node scripts/compose.mjs /tmp/cands.json /tmp/picks.json
// picks.json: { "headline": ["…", …3~5개], "regions": { "KR": { "summary": "…", "items": [
//   { "refs": ["KR14","KR22"], "title": "한국어 제목", "summary": "2~4문장", "importance": 1|2|3, "whyItMatters": "선택", "topic": "선택(기본: 첫 refs 의 분야)", "tags": ["선택", …] } ] } },
//   "watchlist": [...], "notes": "선택" }
// refs 의 첫 번째가 대표 기사(발행일), 모든 refs 의 출처가 sources 에 들어간다 (서로 다른 출처 2곳 이상이면 confidence high).
import fs from 'node:fs';
import path from 'node:path';
import { EDITIONS_DIR, REGIONS, TOPICS, validateEdition } from './lib.mjs';

const TOPIC_LABEL = { politics: '정치', economy: '경제', society: '사회', world: '국제', tech: 'IT·과학', security: '안보', energy: '에너지', climate: '기후', health: '보건', culture: '문화', other: '기타' };
const REGION_META = { KR: { name: '대한민국', flag: '🇰🇷' }, US: { name: '미국', flag: '🇺🇸' } };

export function compose(cands, picks, now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3_600_000);
  const id = cands.id ?? `${kst.toISOString().slice(0, 10)}-${kst.getUTCHours() < 12 ? 'am' : 'pm'}`;
  const date = id.slice(0, 10);
  const slot = id.slice(-2);
  const regions = [];
  for (const code of REGIONS) {
    const p = picks.regions?.[code];
    if (!p) continue;
    const items = p.items.map((it, n) => {
      const arts = it.refs.map((r) => {
        // 다른 지역 후보도 가리킬 수 있다 (예: 미국 항목에 한국 언론의 보도 KR36 를 함께 인용)
        const m = /^([A-Z]+)(\d+)$/.exec(String(r));
        const a = m ? (cands.regions[m[1]] ?? [])[Number(m[2])] : undefined;
        if (!a) throw new Error(`${code} refs ${r} 가 후보에 없어요`);
        return a;
      });
      const sources = [];
      const seen = new Set();
      for (const a of arts) if (!seen.has(a.link)) { seen.add(a.link); sources.push({ name: a.source, url: a.link, lang: a.lang }); }
      const names = new Set(sources.map((s) => s.name));
      const topic = TOPICS.includes(it.topic) ? it.topic : arts[0].topic;
      const tags = [TOPIC_LABEL[topic], ...(it.tags ?? [])].filter(Boolean).slice(0, 5);
      const out = {
        id: `${code.toLowerCase()}-${n + 1}`, topic, title: it.title, summary: it.summary, importance: it.importance,
        confidence: names.size >= 2 ? 'high' : 'medium', tags, sources: sources.slice(0, 4),
      };
      if (it.whyItMatters) out.whyItMatters = it.whyItMatters;
      if (/^\d{4}-\d{2}-\d{2}$/.test(arts[0].publishedAt ?? '')) out.publishedAt = arts[0].publishedAt;
      if (it.isUpdate) out.isUpdate = true;
      return out;
    });
    regions.push({ code, ...REGION_META[code], summary: p.summary, items });
  }
  const edition = {
    schemaVersion: 1, id, date, slot, generatedAt: `${kst.toISOString().slice(0, 19)}+09:00`,
    title: `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일 ${slot === 'am' ? '아침' : '저녁'} 브리핑`,
    headline: picks.headline, regions,
  };
  if (picks.watchlist?.length) edition.watchlist = picks.watchlist;
  if (picks.notes) edition.notes = picks.notes;
  return edition;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const [candsFile, picksFile] = process.argv.slice(2);
  const edition = compose(JSON.parse(fs.readFileSync(candsFile, 'utf8')), JSON.parse(fs.readFileSync(picksFile, 'utf8')));
  const errs = validateEdition(edition, edition.id);
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  fs.mkdirSync(EDITIONS_DIR, { recursive: true });
  fs.writeFileSync(path.join(EDITIONS_DIR, `${edition.id}.json`), `${JSON.stringify(edition, null, 2)}\n`);
  console.log(`${edition.id} 저장: 지역 ${edition.regions.length}개, 항목 ${edition.regions.reduce((n, r) => n + r.items.length, 0)}건`);
}
