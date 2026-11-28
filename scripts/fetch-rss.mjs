#!/usr/bin/env node
// 한국·미국의 공개 RSS 를 모은다 (AI·API 비용 없음).
//   node scripts/fetch-rss.mjs              → data/raw/<회차>.json 에 원본 기사 목록 저장 (요약 작업이 읽는다)
//   node scripts/fetch-rss.mjs --fallback   → 요약된 회차가 아직 없으면 원본으로 '제목만' 회차를 대신 만든다
// 같은 id 의 회차 파일(요약본)이 있으면 절대 덮어쓰지 않는다 (REPLACE=1 이면 허용).
import fs from 'node:fs';
import path from 'node:path';
import { EDITIONS_DIR, RAW_DIR } from './lib.mjs';
import { buildEdition, parseFeed } from './rss.mjs';

// topic: politics|economy|tech|society|world|culture. 접속·형식 오류가 나는 피드는 건너뛴다 (로그에 남음)
const f = (source, lang, topic, url) => ({ source, lang, topic, url });
const REGION_FEEDS = {
  KR: { name: '대한민국', flag: '🇰🇷', feeds: [
    f('연합뉴스', 'ko', 'politics', 'https://www.yna.co.kr/rss/politics.xml'),
    f('연합뉴스', 'ko', 'economy', 'https://www.yna.co.kr/rss/economy.xml'),
    f('연합뉴스', 'ko', 'society', 'https://www.yna.co.kr/rss/society.xml'),
    f('연합뉴스', 'ko', 'world', 'https://www.yna.co.kr/rss/international.xml'),
    f('연합뉴스', 'ko', 'tech', 'https://www.yna.co.kr/rss/industry.xml'),
    f('한국경제', 'ko', 'politics', 'https://www.hankyung.com/feed/politics'),
    f('한국경제', 'ko', 'economy', 'https://www.hankyung.com/feed/economy'),
    f('한국경제', 'ko', 'tech', 'https://www.hankyung.com/feed/it'),
    f('한국경제', 'ko', 'world', 'https://www.hankyung.com/feed/international'),
    f('매일경제', 'ko', 'economy', 'https://www.mk.co.kr/rss/30100041/'),
    f('매일경제', 'ko', 'politics', 'https://www.mk.co.kr/rss/30200030/'),
    f('매일경제', 'ko', 'tech', 'https://www.mk.co.kr/rss/50700001/'),
    f('한겨레', 'ko', 'politics', 'https://www.hani.co.kr/rss/politics/'),
    f('한겨레', 'ko', 'economy', 'https://www.hani.co.kr/rss/economy/'),
    f('한겨레', 'ko', 'society', 'https://www.hani.co.kr/rss/society/'),
    f('경향신문', 'ko', 'politics', 'https://www.khan.co.kr/rss/rssdata/politic_news.xml'),
    f('경향신문', 'ko', 'economy', 'https://www.khan.co.kr/rss/rssdata/economy_news.xml'),
    f('경향신문', 'ko', 'tech', 'https://www.khan.co.kr/rss/rssdata/it_news.xml'),
    f('조선일보', 'ko', 'politics', 'https://www.chosun.com/arc/outboundfeeds/rss/category/politics/?outputType=xml'),
    f('조선일보', 'ko', 'economy', 'https://www.chosun.com/arc/outboundfeeds/rss/category/economy/?outputType=xml'),
    f('중앙일보', 'ko', 'politics', 'https://rss.joins.com/joins_politics_list.xml'),
    f('중앙일보', 'ko', 'economy', 'https://rss.joins.com/joins_money_list.xml'),
    f('동아일보', 'ko', 'politics', 'https://rss.donga.com/politics.xml'),
    f('동아일보', 'ko', 'economy', 'https://rss.donga.com/economy.xml'),
    f('SBS', 'ko', 'politics', 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=01&plink=RSSREADER'),
    f('SBS', 'ko', 'economy', 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=02&plink=RSSREADER'),
    f('SBS', 'ko', 'society', 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=03&plink=RSSREADER'),
    f('SBS', 'ko', 'world', 'https://news.sbs.co.kr/news/SectionRssFeed.do?sectionId=07&plink=RSSREADER'),
    f('JTBC', 'ko', 'politics', 'https://fs.jtbc.co.kr/RSS/politics.xml'),
    f('JTBC', 'ko', 'economy', 'https://fs.jtbc.co.kr/RSS/economy.xml'),
    f('KBS', 'ko', 'society', 'https://news.kbs.co.kr/rss/rss.xml'),
    f('오마이뉴스', 'ko', 'politics', 'https://rss.ohmynews.com/rss/ohmynews.xml'),
    f('전자신문', 'ko', 'tech', 'https://rss.etnews.com/Section901.xml'),
    f('ZDNet Korea', 'ko', 'tech', 'https://feeds.feedburner.com/zdkorea'),
    f('블로터', 'ko', 'tech', 'https://www.bloter.net/feed'),
  ] },
  US: { name: '미국', flag: '🇺🇸', feeds: [
    f('NPR', 'en', 'politics', 'https://feeds.npr.org/1014/rss.xml'),
    f('NPR', 'en', 'economy', 'https://feeds.npr.org/1006/rss.xml'),
    f('NPR', 'en', 'tech', 'https://feeds.npr.org/1019/rss.xml'),
    f('NPR', 'en', 'world', 'https://feeds.npr.org/1004/rss.xml'),
    f('NPR', 'en', 'society', 'https://feeds.npr.org/1001/rss.xml'),
    f('NYT', 'en', 'politics', 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml'),
    f('NYT', 'en', 'economy', 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml'),
    f('NYT', 'en', 'tech', 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml'),
    f('NYT', 'en', 'world', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml'),
    f('PBS NewsHour', 'en', 'politics', 'https://www.pbs.org/newshour/feeds/rss/politics'),
    f('PBS NewsHour', 'en', 'economy', 'https://www.pbs.org/newshour/feeds/rss/economy'),
    f('PBS NewsHour', 'en', 'world', 'https://www.pbs.org/newshour/feeds/rss/world'),
    f('CNN', 'en', 'politics', 'https://rss.cnn.com/rss/cnn_allpolitics.rss'),
    f('CNN', 'en', 'economy', 'https://rss.cnn.com/rss/money_latest.rss'),
    f('CNN', 'en', 'tech', 'https://rss.cnn.com/rss/cnn_tech.rss'),
    f('CNN', 'en', 'world', 'https://rss.cnn.com/rss/cnn_world.rss'),
    f('Fox News', 'en', 'politics', 'https://moxie.foxnews.com/google-publisher/politics.xml'),
    f('Fox News', 'en', 'tech', 'https://moxie.foxnews.com/google-publisher/tech.xml'),
    f('Guardian US', 'en', 'politics', 'https://www.theguardian.com/us-news/us-politics/rss'),
    f('Guardian US', 'en', 'economy', 'https://www.theguardian.com/us/business/rss'),
    f('Guardian US', 'en', 'tech', 'https://www.theguardian.com/us/technology/rss'),
    f('Politico', 'en', 'politics', 'https://rss.politico.com/politics-news.xml'),
    f('The Hill', 'en', 'politics', 'https://thehill.com/feed/'),
    f('Axios', 'en', 'politics', 'https://api.axios.com/feed/'),
    f('CNBC', 'en', 'economy', 'https://www.cnbc.com/id/100003114/device/rss/rss.html'),
    f('CNBC', 'en', 'economy', 'https://www.cnbc.com/id/20910258/device/rss/rss.html'),
    f('CNBC', 'en', 'tech', 'https://www.cnbc.com/id/19854910/device/rss/rss.html'),
    f('WSJ', 'en', 'economy', 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml'),
    f('WSJ', 'en', 'world', 'https://feeds.a.dj.com/rss/RSSWorldNews.xml'),
    f('WSJ', 'en', 'tech', 'https://feeds.a.dj.com/rss/RSSWSJD.xml'),
    f('The Verge', 'en', 'tech', 'https://www.theverge.com/rss/index.xml'),
    f('TechCrunch', 'en', 'tech', 'https://techcrunch.com/feed/'),
    f('Wired', 'en', 'tech', 'https://www.wired.com/feed/rss'),
    f('Ars Technica', 'en', 'tech', 'https://feeds.arstechnica.com/arstechnica/index'),
    f('MIT Technology Review', 'en', 'tech', 'https://www.technologyreview.com/feed/'),
  ] },
};
const PER_FEED = 8;

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; world-brief-rss/1.0; +https://github.com/hwet-j/world-brief)', Accept: 'application/rss+xml, application/xml, text/xml, */*' }, signal: AbortSignal.timeout(20_000), redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const slotId = (now = new Date()) => {
  const kst = new Date(now.getTime() + 9 * 3_600_000);
  return `${kst.toISOString().slice(0, 10)}-${kst.getUTCHours() < 12 ? 'am' : 'pm'}`;
};

async function collect() {
  const regions = {};
  for (const [code, r] of Object.entries(REGION_FEEDS)) {
    const items = [];
    const seen = new Set();
    await Promise.all(r.feeds.map(async (fd) => {
      try {
        const got = parseFeed(await fetchText(fd.url), PER_FEED);
        console.log(`${code} ${fd.source}/${fd.topic}: ${got.length}건`);
        return got.map((g) => ({ ...g, source: fd.source, lang: fd.lang, topic: fd.topic }));
      } catch (e) {
        console.warn(`${code} ${fd.source}/${fd.topic}: 건너뜀 (${e.message}) ${fd.url}`);
        return [];
      }
    })).then((lists) => lists.flat().forEach((it) => { if (!seen.has(it.link)) { seen.add(it.link); items.push(it); } }));
    regions[code] = { name: r.name, flag: r.flag, items };
    console.log(`== ${code}: 총 ${items.length}건`);
  }
  return regions;
}

const id = slotId();
const rawFile = path.join(RAW_DIR, `${id}.json`);
const editionFile = path.join(EDITIONS_DIR, `${id}.json`);
const fallback = process.argv.includes('--fallback');

if (fs.existsSync(editionFile) && process.env.REPLACE !== '1') {
  console.log(`${id} 회차(요약본)가 이미 있어요 — 아무 것도 하지 않아요`);
  process.exit(0);
}

let regions;
if (fallback && fs.existsSync(rawFile)) {
  regions = JSON.parse(fs.readFileSync(rawFile, 'utf8')).regions;
} else {
  regions = await collect();
  const total = Object.values(regions).reduce((n, r) => n + r.items.length, 0);
  if (total < 20) { console.error(`수집된 기사가 ${total}건뿐이에요. 저장하지 않아요.`); process.exit(1); }
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.writeFileSync(rawFile, `${JSON.stringify({ id, collectedAt: new Date().toISOString(), regions }, null, 1)}\n`);
  console.log(`원본 저장: data/raw/${id}.json (${total}건)`);
  // 오래된 원본은 정리 (최근 6개만 유지)
  const olds = fs.readdirSync(RAW_DIR).filter((x) => x.endsWith('.json')).sort().slice(0, -6);
  for (const o of olds) fs.unlinkSync(path.join(RAW_DIR, o));
}

if (fallback) {
  // 요약본이 없을 때만: 제목·소개문만으로 대신 만든 회차
  const edition = buildEdition(regions);
  if (!edition.regions.length) { console.error('회차를 만들 지역이 없어요'); process.exit(1); }
  fs.mkdirSync(EDITIONS_DIR, { recursive: true });
  fs.writeFileSync(editionFile, `${JSON.stringify(edition, null, 2)}\n`);
  console.log(`${edition.id} 대체 회차(제목만) 저장: 지역 ${edition.regions.length}개`);
}
