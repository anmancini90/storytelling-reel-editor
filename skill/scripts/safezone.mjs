// Safe-area audit: measures every visible overlay and the caption text on EVERY frame.
// Nothing may enter the top 10% / bottom 20% / bottom-right button column (TikTok & Reels UI). Exit code 1 on violations.
// Also, when data/heads.json exists (scripts/heads.py): HEADROOM, no overlay (except impact words, which sit behind the
// head on purpose) may come down onto the speaker's head; and CUTOUT, every impact word must have its cutout frames.
//   node safezone.mjs <project>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const RE_HOME = process.env.REEL_EDITOR_HOME || path.join(os.homedir(), '.reel-editor');
const require = createRequire(path.join(RE_HOME, 'node', 'package.json'));
const puppeteer = require('puppeteer-core');
const { chrome } = JSON.parse(fs.readFileSync(path.join(RE_HOME, 'env.json'), 'utf8'));
const P = path.resolve(process.argv[2]);
const meta = JSON.parse(fs.readFileSync(path.join(P, 'project.json'), 'utf8'));
const Z = JSON.parse(fs.readFileSync(path.join(P, 'style.json'), 'utf8')).safe_area;
const HP = path.join(P, 'data', 'heads.json');
const HEADS = fs.existsSync(HP) ? JSON.parse(fs.readFileSync(HP, 'utf8')) : null;
const CLEAR = Z.head_clearance_px ?? -40;   // required gap above the head top; negative = may overlap hair by that much
const headAt = (t) => {                      // conservative: highest head + widest extent of the two nearest samples
  if (!HEADS) return null;
  const ks = [Math.floor(t / HEADS.step), Math.ceil(t / HEADS.step)].filter((k) => HEADS.top[k] != null);
  if (!ks.length) return null;
  return { top: Math.min(...ks.map((k) => HEADS.top[k])), left: Math.min(...ks.map((k) => HEADS.left[k] ?? 0)), right: Math.max(...ks.map((k) => HEADS.right[k] ?? 1080)) };
};
const b = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--allow-file-access-from-files'] });
const [p] = await b.pages();
await p.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
await p.goto(pathToFileURL(path.join(P, 'page', 'index.html')).href, { waitUntil: 'load' });
await p.evaluate(() => window.__ready);
const ext = {}, bad = [];
const maps = await p.evaluate((n, fps) => Array.from({ length: n }, (_, i) => (window.__headMap ? window.__headMap(i / fps) : [1, 0, window.__headShift ? window.__headShift(i / fps) : 0])), meta.nframes, meta.fps);
const impacts = await p.evaluate(() => [...(window.ANT && window.ANT.impacts ? window.ANT.impacts : []), ...(window.KAL && window.KAL.cutouts ? window.KAL.cutouts : [])]
  .map((w) => ({ at: w.at, until: w.until, text: w.text })));
for (const w of impacts) {
  const miss = [];
  for (let i = Math.ceil(w.at * meta.fps); i < w.until * meta.fps; i++)
    if (!fs.existsSync(path.join(P, 'page', 'assets', 'fg', `${String(i).padStart(5, '0')}.png`))) miss.push(i);
  if (miss.length) bad.push(`CUTOUT "${w.text}" ${w.at.toFixed(2)}-${w.until.toFixed(2)}s: ${miss.length} frames have no cutout (word shows IN FRONT of the face). Run: cutout.py <project> --auto`);
}
for (let i = 0; i < meta.nframes; i++) {
  const boxes = await p.evaluate(async (i) => {
    await window.__frame(i);
    const out = [];
    document.querySelectorAll('.ui').forEach((el, k) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || +cs.opacity < 0.02) return;
      const r = el.getBoundingClientRect(); out.push([el.id || `${el.className.replace('ui ', '')}#${k}`, r.left, r.top, r.right, r.bottom, el.classList.contains('impact') || el.dataset.role === 'caption' || el.dataset.role === 'behind' || el.dataset.role === 'below' || el.dataset.role === 'cover']);   // below: under the chin, not on the face; cover: over the face on purpose (Ant asked)
    });
    const cap = document.getElementById('cap');
    if (cap.firstChild && getComputedStyle(cap).display !== 'none') { const rg = document.createRange(); rg.selectNodeContents(cap); const r = rg.getBoundingClientRect(); out.push(['caption', r.left, r.top, r.right, r.bottom]); }
    return out;
  }, i);
  const hd0 = headAt(i / meta.fps), [hs, hx, hy] = maps[i] || [1, 0, 0];   // the head moves/scales with a KAL layout (box, split, pip)
  const hd = hd0 && { top: hy + hs * hd0.top, left: hx + hs * hd0.left, right: hx + hs * hd0.right };
  for (const [id, l, t, r, bt, isImpact] of boxes) {
    if (hd && !isImpact && id !== 'caption' && bt > hd.top - CLEAR && r > hd.left && l < hd.right)
      bad.push(`HEADROOM frame ${i} (${(i / meta.fps).toFixed(2)}s) ${id} bottom ${bt.toFixed(0)} is on the head (top ${hd.top}, allowed ${hd.top - CLEAR})`);
    const e = ext[id] || (ext[id] = { top: 1e9, bottom: 0, left: 1e9, right: 0 });
    e.top = Math.min(e.top, t); e.bottom = Math.max(e.bottom, bt); e.left = Math.min(e.left, l); e.right = Math.max(e.right, r);
    if (t < Z.top || bt > Z.bottom || (bt > Z.rail_from_y && r > Z.rail_x)) bad.push(`frame ${i} (${(i / meta.fps).toFixed(2)}s) ${id} box [${l.toFixed(0)},${t.toFixed(0)} -> ${r.toFixed(0)},${bt.toFixed(0)}]`);
  }
}
for (const [id, e] of Object.entries(ext)) console.log(id.padEnd(14), `y ${e.top.toFixed(0)}-${e.bottom.toFixed(0)}  x ${e.left.toFixed(0)}-${e.right.toFixed(0)}`);
console.log(bad.length ? `VIOLATIONS: ${bad.length}\n` + bad.slice(0, 20).join('\n') : `SAFE AREA OK: 0 violations across ${meta.nframes} frames`);
await Promise.race([b.close(), new Promise((r) => setTimeout(r, 3000))]);
process.exit(bad.length ? 1 : 0);
