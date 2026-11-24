// Render style options side by side: node pick.mjs <manifest.json> <out.jpg>   (my_style.py pick writes the manifest)
// Each manifest entry is a one-frame page (my_style.py builds it); this renders frame 0 of each, checks its fonts really
// loaded (a missing font silently falls back), and lays the panels out with their letter and label on top.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const RE_HOME = process.env.REEL_EDITOR_HOME || path.join(os.homedir(), '.reel-editor');
const require = createRequire(path.join(RE_HOME, 'node', 'package.json'));
const puppeteer = require('puppeteer-core');
const { chrome } = JSON.parse(fs.readFileSync(path.join(RE_HOME, 'env.json'), 'utf8'));
const [manPath, out] = process.argv.slice(2);
const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
const work = path.dirname(manPath);
const browser = await puppeteer.launch({ executablePath: chrome, headless: true,
  args: ['--allow-file-access-from-files', '--force-color-profile=srgb', '--hide-scrollbars'] });
const [page] = await browser.pages();
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
let missing = 0;
for (const m of man) {
  const url = pathToFileURL(path.join(m.dir, 'page', 'index.html')).href + '?frames=' + encodeURIComponent(pathToFileURL(path.join(m.dir, 'frames')).href);
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => window.__ready);
  await page.evaluate((f) => window.__frame(f), m.frame || 0);
  const gone = await page.evaluate(async (fonts) => {   // a font that isn't there measures exactly like the fallback
    await Promise.all(fonts.map((f) => document.fonts.load(`72px "${f}"`).catch(() => 0)));   // bundled fonts load on first use
    await document.fonts.ready;
    const c = document.createElement('canvas').getContext('2d'), s = 'mmmmmmmmlli WQ@ 0123';
    return fonts.filter((f) => ['monospace', 'serif'].every((fb) => { c.font = `72px "${f}", ${fb}`; const a = c.measureText(s).width; c.font = `72px ${fb}`; return a === c.measureText(s).width; }));
  }, m.fonts);
  for (const f of gone) { console.log(`FONT MISSING: "${f}" (option ${m.key}) fell back to another font`); missing++; }
  m.img = path.join(work, `${m.key}.jpg`);
  await page.screenshot({ path: m.img, type: 'jpeg', quality: 90 });
}
const cols = Math.min(4, man.length), rows = Math.ceil(man.length / cols), W = 360, H = 640, LH = 64;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
fs.writeFileSync(path.join(work, '_sheet.html'), `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},${W}px);gap:8px;padding:8px">` +
  man.map((m) => `<div><div style="height:${LH}px;display:flex;gap:10px;align-items:center;color:#fff;font:600 17px/1.2 -apple-system,sans-serif">` +
    `<b style="flex:none;width:40px;height:40px;border-radius:20px;background:#fff;color:#111;display:grid;place-items:center;font-size:22px">${esc(m.key)}</b>` +
    `<span>${esc(m.label)}</span></div><img src="${path.basename(m.img)}" style="width:${W}px;height:${H}px;display:block;border-radius:6px"></div>`).join('') + '</body>');
await page.setViewport({ width: cols * (W + 8) + 8, height: rows * (H + LH + 8) + 8, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(work, '_sheet.html')).href, { waitUntil: 'load' });
await page.screenshot({ path: out, type: 'jpeg', quality: 88 });
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
if (missing) console.log('Pick a font that is on this Mac (bundled: TikTok Sans, Inter, Hanken Grotesk) and render again.');
process.exit(0);
