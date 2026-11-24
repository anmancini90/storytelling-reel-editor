// Print the time windows that need the speaker cut out (every ANT.impact() word + every KAL 'canvas' segment) in the project's page as JSON: [[at, until, "text", top, size], ...]
// (top/size only for impact words whose colour is "auto": cutout.py measures the background behind them).
// Used by `cutout.py <project> --auto`.   node impact_windows.mjs <project>
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
const b = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--allow-file-access-from-files'] });
const [p] = await b.pages();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(pathToFileURL(path.join(P, 'page', 'index.html')).href, { waitUntil: 'load' });
const w = await p.evaluate(() => [...(window.ANT && window.ANT.impacts ? window.ANT.impacts : []), ...(window.KAL && window.KAL.cutouts ? window.KAL.cutouts : [])]
  .map((x) => [x.at, x.until, x.text, x.auto ? x.top : null, x.auto ? x.size : null]));
await Promise.race([b.close(), new Promise((r) => setTimeout(r, 3000))]);
if (errs.length) { console.error('PAGE ERROR: ' + errs.join('; ')); process.exit(1); }
console.log(JSON.stringify(w));
