#!/usr/bin/env node
// 모든 회차 파일을 검증하고, data/index.json 이 회차 파일들과 일치하는지도 확인한다.
import fs from 'node:fs';
import { INDEX_PATH, buildIndex, listEditionFiles, loadEdition, validateEdition } from './lib.mjs';

let bad = 0;
const editions = [];
for (const file of listEditionFiles()) {
  const id = file.replace(/\.json$/, '');
  let e;
  try {
    e = loadEdition(file);
  } catch (x) {
    console.error(`✗ ${file}: JSON 을 읽을 수 없어요 (${x.message})`);
    bad++;
    continue;
  }
  const errs = validateEdition(e, id);
  if (errs.length) {
    bad++;
    console.error(`✗ ${file}`);
    for (const m of errs) console.error(`   - ${m}`);
  } else {
    editions.push(e);
    console.log(`✓ ${file}`);
  }
}
if (fs.existsSync(INDEX_PATH)) {
  const cur = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const want = buildIndex(editions);
  const same = JSON.stringify(cur.editions) === JSON.stringify(want.editions) && cur.latest === want.latest;
  if (!same) {
    bad++;
    console.error('✗ data/index.json 이 회차 파일과 달라요. `node scripts/build-index.mjs` 를 실행하세요.');
  }
} else if (editions.length) {
  bad++;
  console.error('✗ data/index.json 이 없어요. `node scripts/build-index.mjs` 를 실행하세요.');
}
if (bad) {
  console.error(`\n검증 실패: ${bad}건`);
  process.exit(1);
}
console.log(`\n검증 통과: 회차 ${editions.length}개`);
