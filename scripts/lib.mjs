// 회차 파일 검증과 목록 생성에 쓰는 공통 로직 (외부 의존성 없음, Node 20+)
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const EDITIONS_DIR = path.join(ROOT, 'data', 'editions');
export const RAW_DIR = path.join(ROOT, 'data', 'raw');
export const INDEX_PATH = path.join(ROOT, 'data', 'index.json');

export const REGIONS = ['KR', 'US', 'JP', 'CN', 'EU', 'GB', 'RU', 'ME', 'IN', 'GLOBAL'];
export const TOPICS = ['politics', 'economy', 'society', 'world', 'tech', 'security', 'energy', 'climate', 'health', 'culture', 'other'];
export const CONFIDENCE = ['high', 'medium', 'low'];
const ID_RE = /^\d{4}-\d{2}-\d{2}-(am|pm)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ITEM_ID_RE = /^[a-z0-9-]{1,24}$/;
const HTML_RE = /<\/?[a-z][^>]*>/i;

const isStr = (v, max, min = 1) => typeof v === 'string' && v.trim().length >= min && v.length <= max;
const validDate = (s) => {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** 회차 객체를 검증해 오류 문자열 배열을 돌려준다 (빈 배열이면 통과). fileId 는 파일 이름(확장자 제외) */
export function validateEdition(e, fileId) {
  const errs = [];
  const err = (m) => errs.push(m);
  if (!e || typeof e !== 'object') return ['최상위가 객체가 아니에요'];
  if (e.schemaVersion !== 1) err('schemaVersion 은 1 이어야 해요');
  if (typeof e.id !== 'string' || !ID_RE.test(e.id)) err('id 형식이 YYYY-MM-DD-am|pm 이 아니에요');
  if (fileId && e.id !== fileId) err(`id(${e.id}) 가 파일 이름(${fileId}) 과 달라요`);
  if (!validDate(e.date)) err('date 가 올바른 YYYY-MM-DD 가 아니에요');
  if (typeof e.id === 'string' && validDate(e.date) && !e.id.startsWith(e.date)) err('id 가 date 로 시작해야 해요');
  if (e.slot !== 'am' && e.slot !== 'pm') err('slot 은 am 또는 pm');
  if (typeof e.id === 'string' && e.slot && !e.id.endsWith(`-${e.slot}`)) err('id 의 am/pm 이 slot 과 달라요');
  if (typeof e.generatedAt !== 'string' || Number.isNaN(Date.parse(e.generatedAt))) err('generatedAt 이 ISO 시각이 아니에요');
  if (!isStr(e.title, 80)) err('title 은 1~80자');
  if (!Array.isArray(e.headline) || e.headline.length < 3 || e.headline.length > 5 || !e.headline.every((h) => isStr(h, 120))) err('headline 은 3~5개, 각 1~120자');
  if (!Array.isArray(e.regions) || e.regions.length < 1 || e.regions.length > 12) {
    err('regions 는 1~12개');
    return errs;
  }
  const codes = new Set();
  const itemIds = new Set();
  e.regions.forEach((r, ri) => {
    const rp = `regions[${ri}]`;
    if (!r || typeof r !== 'object') return err(`${rp} 가 객체가 아니에요`);
    if (!REGIONS.includes(r.code)) err(`${rp}.code(${r.code}) 가 알려진 지역이 아니에요`);
    if (codes.has(r.code)) err(`${rp}.code(${r.code}) 중복`);
    codes.add(r.code);
    if (!isStr(r.name, 30)) err(`${rp}.name`);
    if (!isStr(r.flag, 8)) err(`${rp}.flag`);
    if (!isStr(r.summary, 240)) err(`${rp}.summary 는 1~240자`);
    if (!Array.isArray(r.items) || r.items.length < 1 || r.items.length > 16) return err(`${rp}.items 는 1~16개`);
    r.items.forEach((it, ii) => {
      const ip = `${rp}.items[${ii}]`;
      if (!it || typeof it !== 'object') return err(`${ip} 가 객체가 아니에요`);
      if (typeof it.id !== 'string' || !ITEM_ID_RE.test(it.id)) err(`${ip}.id 형식(소문자·숫자·-)`);
      else if (itemIds.has(it.id)) err(`${ip}.id(${it.id}) 가 회차 안에서 중복`);
      else itemIds.add(it.id);
      if (!TOPICS.includes(it.topic)) err(`${ip}.topic(${it.topic}) 이 허용 값이 아니에요`);
      if (!isStr(it.title, 100)) err(`${ip}.title 은 1~100자`);
      if (!isStr(it.summary, 600, 20)) err(`${ip}.summary 는 20~600자`);
      if (it.whyItMatters != null && !isStr(it.whyItMatters, 200)) err(`${ip}.whyItMatters 는 1~200자`);
      if (![1, 2, 3].includes(it.importance)) err(`${ip}.importance 는 1|2|3`);
      if (!CONFIDENCE.includes(it.confidence)) err(`${ip}.confidence`);
      if (it.publishedAt != null && !validDate(it.publishedAt)) err(`${ip}.publishedAt 날짜 형식`);
      if (it.easy != null && !isStr(it.easy, 400)) err(`${ip}.easy 는 1~400자`);
      if (it.terms != null) {
        if (!Array.isArray(it.terms) || it.terms.length > 5) err(`${ip}.terms 는 최대 5개`);
        else it.terms.forEach((x, xi) => { if (!x || !isStr(x.term, 40) || !isStr(x.meaning, 300)) err(`${ip}.terms[${xi}] 형식(term 1~40자, meaning 1~300자)`); });
      }
      if (it.isUpdate != null && typeof it.isUpdate !== 'boolean') err(`${ip}.isUpdate 는 boolean`);
      if (it.tags != null && (!Array.isArray(it.tags) || it.tags.length > 5 || !it.tags.every((t) => isStr(t, 24)))) err(`${ip}.tags 는 최대 5개, 각 1~24자`);
      if (!Array.isArray(it.sources) || it.sources.length < 1 || it.sources.length > 4) err(`${ip}.sources 는 1~4개`);
      else {
        const seen = new Set();
        it.sources.forEach((s, si) => {
          const sp = `${ip}.sources[${si}]`;
          if (!s || !isStr(s.name, 40)) err(`${sp}.name`);
          if (!s || typeof s.url !== 'string' || !/^https:\/\/[^\s]+$/.test(s.url) || s.url.length > 500) err(`${sp}.url 은 https:// 주소여야 해요`);
          else if (seen.has(s.url)) err(`${sp}.url 중복`);
          else seen.add(s.url);
        });
      }
      if (it.confidence === 'high' && Array.isArray(it.sources) && it.sources.length < 2) err(`${ip}: confidence high 는 출처 2개 이상이 필요해요 (아니면 medium)`);
      for (const k of ['title', 'summary', 'whyItMatters', 'easy']) if (typeof it[k] === 'string' && HTML_RE.test(it[k])) err(`${ip}.${k} 에 HTML 이 들어 있어요`);
    });
  });
  if (e.watchlist != null) {
    if (!Array.isArray(e.watchlist) || e.watchlist.length > 8) err('watchlist 는 최대 8개');
    else e.watchlist.forEach((w, i) => {
      if (!w || !validDate(w.date) || !isStr(w.title, 120)) err(`watchlist[${i}] 형식(date, title)`);
      if (w && w.region != null && !REGIONS.includes(w.region)) err(`watchlist[${i}].region`);
    });
  }
  if (e.notes != null && !isStr(e.notes, 400)) err('notes 는 1~400자');
  if (e.recap != null && !isStr(e.recap, 600)) err('recap 는 1~600자');
  for (const k of ['title', 'notes', 'recap']) if (typeof e[k] === 'string' && HTML_RE.test(e[k])) err(`${k} 에 HTML 이 들어 있어요`);
  return errs;
}

export function listEditionFiles() {
  if (!fs.existsSync(EDITIONS_DIR)) return [];
  return fs.readdirSync(EDITIONS_DIR).filter((f) => /\.json$/.test(f)).sort();
}

export function loadEdition(file) {
  return JSON.parse(fs.readFileSync(path.join(EDITIONS_DIR, file), 'utf8'));
}

/** 회차 목록(index.json) 내용을 만든다. editions 는 검증된 회차 객체 배열 */
export function buildIndex(editions, now = new Date()) {
  const sorted = [...editions].sort((a, b) => b.id.localeCompare(a.id));
  return {
    schemaVersion: 1,
    updatedAt: now.toISOString(),
    latest: sorted[0]?.id ?? null,
    editions: sorted.map((e) => ({
      id: e.id, date: e.date, slot: e.slot, title: e.title, headline: e.headline.slice(0, 3),
      regions: e.regions.map((r) => r.code),
      itemCount: e.regions.reduce((n, r) => n + r.items.length, 0),
      path: `data/editions/${e.id}.json`,
    })),
  };
}
