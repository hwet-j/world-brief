import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { parseEdition } from '../src/lib/parse';
import { fixturePath, raw } from './helpers';

/**
 * 앱 픽스처가 저장소 루트의 검증기(scripts/validate.mjs 가 쓰는 validateEdition)를 통과하는지,
 * 그리고 앱 파서가 같은 파일을 경고 없이 읽는지 확인해 스키마와 앱이 어긋나지 않게 한다.
 */
const lib = path.resolve(__dirname, '..', '..', 'scripts', 'lib.mjs');
const code = `
import fs from 'node:fs';
import { validateEdition } from ${JSON.stringify(lib)};
const out = {};
for (const f of process.argv.slice(1)) { const e = JSON.parse(fs.readFileSync(f, 'utf8')); out[f] = validateEdition(e, e.id); }
console.log(JSON.stringify(out));
`;

test.each(['edition-a.json', 'edition-b.json', 'edition-c.json'])('%s: 루트 검증기 통과 + 앱 파서 경고 없음', (name) => {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code, fixturePath(name)], { encoding: 'utf8' });
  expect(r.status).toBe(0);
  const result = JSON.parse(r.stdout.trim()) as Record<string, string[]>;
  expect(result[fixturePath(name)]).toEqual([]);
  const p = parseEdition(raw(name));
  expect(p.warnings).toEqual([]);
  expect(p.value).not.toBeNull();
});

test('검증기가 잘못된 데이터는 실제로 잡는다 (테스트 자체 점검)', () => {
  const bad = `import { validateEdition } from ${JSON.stringify(lib)}; console.log(JSON.stringify(validateEdition({ schemaVersion: 1, id: 'x' }, 'x')));`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', bad], { encoding: 'utf8' });
  expect((JSON.parse(r.stdout.trim()) as string[]).length).toBeGreaterThan(0);
});
