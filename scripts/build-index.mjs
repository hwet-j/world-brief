#!/usr/bin/env node
// data/editions/*.json 에서 data/index.json 을 다시 만든다 (검증을 통과한 회차만).
import fs from 'node:fs';
import { INDEX_PATH, buildIndex, listEditionFiles, loadEdition, validateEdition } from './lib.mjs';

const editions = [];
for (const file of listEditionFiles()) {
  const e = loadEdition(file);
  const errs = validateEdition(e, file.replace(/\.json$/, ''));
  if (errs.length) {
    console.error(`✗ ${file} 검증 실패 — 목록에서 제외하지 않고 중단합니다`);
    for (const m of errs) console.error(`   - ${m}`);
    process.exit(1);
  }
  editions.push(e);
}
// updatedAt 만 바뀌는 불필요한 커밋을 줄이려고, 내용이 같으면 파일을 다시 쓰지 않는다
const next = buildIndex(editions);
if (fs.existsSync(INDEX_PATH)) {
  const cur = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  if (JSON.stringify(cur.editions) === JSON.stringify(next.editions) && cur.latest === next.latest) {
    console.log('index.json 변경 없음');
    process.exit(0);
  }
}
fs.writeFileSync(INDEX_PATH, `${JSON.stringify(next, null, 2)}\n`);
console.log(`index.json 갱신: 회차 ${next.editions.length}개, 최신 ${next.latest}`);
