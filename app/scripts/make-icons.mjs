// 앱 아이콘 PNG 생성: node scripts/make-icons.mjs  (필요: playwright — npm i --no-save playwright)
// 임시(placeholder) 디자인: 남색 그라데이션 + 흰 지구본(경위선). 최종 아이콘이 정해지면 SVG 만 바꿔 다시 실행한다.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets');

const defs = `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1E3A8A"/><stop offset="1" stop-color="#3B82F6"/></linearGradient></defs>`;
const bg = '<rect width="1024" height="1024" fill="url(#bg)"/>';
const globe = (c = '#fff') => `<g fill="none" stroke="${c}" stroke-width="34" stroke-linecap="round">
  <circle cx="512" cy="512" r="280"/><ellipse cx="512" cy="512" rx="120" ry="280"/><path d="M232 512H792M290 372H734M290 652H734"/></g>`;
const svg = (size, inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${defs}${inner}</svg>`;
const fit = (inner) => `<g transform="translate(512 512) scale(.86) translate(-512 -512)">${inner}</g>`;

const files = {
  'icon.png': { size: 1024, svg: svg(1024, bg + globe()), opaque: true },
  'android-icon-background.png': { size: 1024, svg: svg(1024, bg), opaque: true },
  'android-icon-foreground.png': { size: 1024, svg: svg(1024, fit(globe())) },
  'android-icon-monochrome.png': { size: 1024, svg: svg(1024, fit(globe('#000'))) },
  'splash-icon.png': { size: 512, svg: svg(512, globe()) },
  'favicon.png': { size: 48, svg: svg(48, bg + globe()), opaque: true },
  'notification-icon.png': { size: 96, svg: svg(96, globe()) },
};

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, f] of Object.entries(files)) {
  await page.setViewportSize({ width: f.size, height: f.size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${f.svg}</body></html>`);
  fs.writeFileSync(path.join(OUT, name), await page.screenshot({ omitBackground: !f.opaque, clip: { x: 0, y: 0, width: f.size, height: f.size } }));
  console.log('wrote', name);
}
await browser.close();
