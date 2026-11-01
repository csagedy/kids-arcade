#!/usr/bin/env node
// Headless WebKit screenshots at the sizes the kids actually use.
//
//   node tools/shot.mjs <url> [outDir] [--sizes=ipad,ipadl,phone] [--wait=800]
//                       [--js="code run before the shot"]
//
// Writes <outDir>/<name>-<size>.png and prints any console errors / page
// errors. Playwright lives outside the repo in ~/.cache/arcade-tools so the
// arcade stays dependency-free.
import { createRequire } from 'module';
import os from 'os';
import path from 'path';
import fs from 'fs';

const require = createRequire(path.join(os.homedir(), '.cache/arcade-tools/package.json'));
const { webkit } = require('playwright');

const SIZES = {
  ipad:  { width: 820,  height: 1180, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
  ipadl: { width: 1180, height: 820,  isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
  phone: { width: 375,  height: 812,  isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  phonel:{ width: 812,  height: 375,  isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};
const UA = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const args = process.argv.slice(2);
const opt = k => (args.find(a => a.startsWith('--' + k + '=')) || '').split('=').slice(1).join('=');
const pos = args.filter(a => !a.startsWith('--'));
const url = pos[0];
if (!url) { console.error('usage: node tools/shot.mjs <url> [outDir] [--sizes=ipad,ipadl,phone]'); process.exit(1); }
const out = pos[1] || '.';
const sizes = (opt('sizes') || 'ipad,ipadl,phone').split(',');
const wait = +(opt('wait') || 800);
const js = opt('js');
const name = (url.replace(/^https?:\/\/[^/]+\/?/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'menu');
fs.mkdirSync(out, { recursive: true });

// The playwright installer's unzip hung on this Mac, so a hand-extracted
// WebKit lives next to it; fall back to the stock install if that's missing.
const local = path.join(os.homedir(), '.cache/arcade-tools/webkit/pw_run.sh');
const browser = await webkit.launch(fs.existsSync(local) ? { executablePath: local } : {});
let errors = 0;
for (const s of sizes) {
  const ctx = await browser.newContext({ viewport: { width: SIZES[s].width, height: SIZES[s].height }, ...SIZES[s], userAgent: UA, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') { errors++; console.log(`[${s}] console.error: ${m.text()}`); } });
  page.on('pageerror', e => { errors++; console.log(`[${s}] pageerror: ${e.message}`); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(wait);
  if (js) { await page.evaluate(js); await page.waitForTimeout(wait); }
  const file = path.join(out, `${name}-${s}.png`);
  await page.screenshot({ path: file });
  console.log(file);
  await ctx.close();
}
await browser.close();
process.exit(errors ? 2 : 0);
