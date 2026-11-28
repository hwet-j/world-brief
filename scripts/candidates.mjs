#!/usr/bin/env node
// 원본(data/raw/<id>.json)에서 요약할 후보를 추린다: 여러 출처가 함께 다룬 기사·최신·소개문이 있는 기사를 우선, 분야별 쿼터.
//   node scripts/candidates.mjs [회차id] [--out /tmp/cands.json]  → 표로 출력하고 --out 파일에 저장 (compose.mjs 가 같은 파일을 읽는다)
import fs from 'node:fs';
import path from 'node:path';
import { RAW_DIR } from './lib.mjs';

const QUOTA = {
  KR: { politics: 10, economy: 10, tech: 6, society: 5, world: 6 },
  US: { politics: 10, economy: 10, tech: 10, world: 6, society: 2 },
};
const STOP = new Set('the a an of to in on for and with at by from as is are was be after over new says say amid into than more his her its that this will have has not but about out how what who why when can could may year years first one two 대한 위한 있는 하는 따른 통해 이후 관련 오늘 지난 밝혔다'.split(' '));
const toks = (s) => new Set((s.toLowerCase().match(/[가-힣]{2,}|[a-z][a-z\-']{2,}/g) ?? []).filter((w) => !STOP.has(w)));

export function pickCandidates(raw) {
  const out = {};
  for (const [code, quota] of Object.entries(QUOTA)) {
    const items = raw.regions?.[code]?.items ?? [];
    const T = items.map((i) => toks(`${i.title} ${i.description.slice(0, 120)}`));
    const today = raw.id?.slice(0, 10);
    items.forEach((it, k) => {
      let shared = 0;
      items.forEach((o, j) => { if (o.source !== it.source && [...T[k]].filter((w) => T[j].has(w)).length >= 2) shared++; });
      it.score = shared * 3 + Math.min(it.description.length, 300) / 100 + (it.publishedAt === today ? 1.5 : 0);
    });
    out[code] = Object.entries(quota).flatMap(([topic, n]) => items.filter((i) => i.topic === topic).sort((a, b) => b.score - a.score).slice(0, n));
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const outFile = outIdx >= 0 ? args[outIdx + 1] : null;
  const idArg = args.find((a, i) => !a.startsWith('--') && i !== outIdx + 1);
  const file = idArg ? path.join(RAW_DIR, `${idArg}.json`) : path.join(RAW_DIR, fs.readdirSync(RAW_DIR).filter((f) => f.endsWith('.json')).sort().pop());
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const c = pickCandidates(raw);
  if (outFile) fs.writeFileSync(outFile, JSON.stringify({ id: raw.id, regions: c }));
  for (const [code, list] of Object.entries(c)) {
    console.log(`##### ${code}`);
    list.forEach((i, n) => console.log(`${code}${n}|${i.topic.slice(0, 4)}|${i.source}|${i.title.slice(0, 90)}|${i.description.slice(0, 130)}`));
  }
}
