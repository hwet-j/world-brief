#!/usr/bin/env node
// 공개 RSS 헤드라인을 모아 data/editions/<오늘>-<am|pm>.json 을 만든다 (AI·API 비용 없음).
// 같은 회차 파일이 이미 있으면(예: 요약까지 해 둔 회차) 덮어쓰지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { EDITIONS_DIR } from './lib.mjs';
import { buildEdition, parseFeed } from './rss.mjs';

// code → { name, flag, feeds: [{ source, lang, url, topic? }] }  (docs/regions.md 의 출처 중 공개 RSS 가 있는 곳)
const REGION_FEEDS = {
  KR: { name: '대한민국', flag: '🇰🇷', feeds: [{ source: '연합뉴스', lang: 'ko', url: 'https://www.yna.co.kr/rss/news.xml' }, { source: '한겨레', lang: 'ko', url: 'https://www.hani.co.kr/rss/' }] },
  US: { name: '미국', flag: '🇺🇸', feeds: [{ source: 'NPR', lang: 'en', url: 'https://feeds.npr.org/1001/rss.xml' }] },
  JP: { name: '일본', flag: '🇯🇵', feeds: [{ source: 'Japan Times', lang: 'en', url: 'https://www.japantimes.co.jp/feed/' }] },
  CN: { name: '중국·대만·홍콩', flag: '🇨🇳', feeds: [{ source: 'SCMP', lang: 'en', url: 'https://www.scmp.com/rss/91/feed' }] },
  EU: { name: '유럽연합·독일·프랑스', flag: '🇪🇺', feeds: [{ source: 'DW', lang: 'en', url: 'https://rss.dw.com/rdf/rss-en-all' }, { source: 'France 24', lang: 'en', url: 'https://www.france24.com/en/rss' }] },
  GB: { name: '영국', flag: '🇬🇧', feeds: [{ source: 'BBC', lang: 'en', url: 'https://feeds.bbci.co.uk/news/uk/rss.xml' }] },
  RU: { name: '러시아·우크라이나', flag: '🇷🇺', feeds: [{ source: 'Kyiv Independent', lang: 'en', url: 'https://kyivindependent.com/feed/' }] },
  ME: { name: '중동', flag: '🌍', feeds: [{ source: 'Al Jazeera', lang: 'en', url: 'https://www.aljazeera.com/xml/rss/all.xml' }] },
  IN: { name: '인도·남아시아', flag: '🇮🇳', feeds: [{ source: 'The Hindu', lang: 'en', url: 'https://www.thehindu.com/news/national/feeder/default.rss' }] },
  GLOBAL: { name: '글로벌', flag: '🌐', feeds: [{ source: 'BBC World', lang: 'en', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' }, { source: 'Ars Technica', lang: 'en', url: 'https://feeds.arstechnica.com/arstechnica/index', topic: 'tech' }] },
};

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'world-brief-rss/1.0 (+https://github.com/hwet-j/world-brief)', Accept: 'application/rss+xml, application/xml, text/xml, */*' }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const byRegion = {};
for (const [code, r] of Object.entries(REGION_FEEDS)) {
  const items = [];
  for (const f of r.feeds) {
    try {
      const xml = await fetchText(f.url);
      const got = parseFeed(xml, 4);
      console.log(`${code} ${f.source}: ${got.length}건`);
      for (const g of got) items.push({ ...g, source: f.source, lang: f.lang, topic: f.topic });
    } catch (e) {
      console.warn(`${code} ${f.source}: 건너뜀 (${e.message})`);
    }
  }
  // 한 출처가 한 지역을 독점하지 않게 출처별로 번갈아 담는다
  byRegion[code] = { name: r.name, flag: r.flag, items: interleave(items) };
}

function interleave(items) {
  const groups = new Map();
  for (const it of items) groups.set(it.source, [...(groups.get(it.source) ?? []), it]);
  const lists = [...groups.values()];
  const out = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i]);
  return out;
}

const edition = buildEdition(byRegion);
if (edition.regions.length < 3) {
  console.error(`수집된 지역이 ${edition.regions.length}개뿐이에요(최소 3개). 회차를 만들지 않아요.`);
  process.exit(1);
}
const file = path.join(EDITIONS_DIR, `${edition.id}.json`);
if (fs.existsSync(file)) {
  console.log(`${edition.id} 회차가 이미 있어요 — 덮어쓰지 않아요`);
  process.exit(0);
}
fs.mkdirSync(EDITIONS_DIR, { recursive: true });
fs.writeFileSync(file, `${JSON.stringify(edition, null, 2)}\n`);
console.log(`${edition.id} 회차 저장: 지역 ${edition.regions.length}개, 항목 ${edition.regions.reduce((n, r) => n + r.items.length, 0)}건`);
