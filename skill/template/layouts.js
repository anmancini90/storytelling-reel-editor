// layouts.js: layout building blocks (KAL.*): grid canvas, news split, picture-in-picture and full frame, with a gold
// accent and Hanken Grotesk + Inter by default (style.json palette / fonts change them: CSS variables set in runtime.js). Loaded after components.js. Documented in the comments below.
//
// The video cuts between three LAYOUTS (KAL.layout):
//   'canvas'  light grid-paper canvas; headline on top; one floating object at a time; speaker in a rounded box across
//             the bottom with their HEAD BREAKING OUT over the box's top edge (cutout); one-word dark captions above it.
//   'news'    hard 50/50 split: B-roll / a card full-bleed on top, speaker on the bottom; 2-4 word captions on the seam.
//   'full'    plain full-frame talking head; one big white word with a soft glow (chest height, never on the face).
// Components: KAL.headline, KAL.float, KAL.phone, KAL.grid, KAL.stat, KAL.highlight, KAL.banner (+ every ANT.* / BEAT.*;
// ANT.profile / ANT.timeline take theme: 'light' for the canvas).
(() => {
  const SERIF = 'var(--font-serif)';
  const css = document.createElement('style');
  css.textContent = `
@font-face { font-family: "Hanken Grotesk"; font-weight: 100 900; src: url(fonts/hanken-grotesk.woff2) format("woff2"); }
@font-face { font-family: "Inter"; font-weight: 100 900; src: url(fonts/inter.woff2) format("woff2"); }
.klay { position: absolute; inset: 0; display: none; overflow: hidden; }
.kcream { position: absolute; inset: 0; display: none; }
.kcanvas { background-color: var(--canvas);
  background-image: linear-gradient(color-mix(in srgb, var(--ink) 5.5%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--ink) 5.5%, transparent) 1px, transparent 1px);
  background-size: 36px 36px; background-position: -1px -1px; }
.kframe { position: absolute; background: #111; box-shadow: 0 0 0 1px rgba(0,0,0,.08), 0 30px 70px -30px rgba(0,0,0,.45); }
.kspk { position: absolute; inset: 0; overflow: hidden; }
.kspk img { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; }
.kclip img { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; }
.kclip { position: absolute; left: 0; top: 0; width: 1080px; overflow: hidden; }
.kntop { position: absolute; left: 0; top: 0; width: 1080px; height: 960px; overflow: hidden; }
.kseam { position: absolute; left: 0; top: 958px; width: 1080px; height: 4px; background: rgba(0,0,0,.55); }
/* layout captions use the saved style's caption look (runtime.js --cap-*); on the cream canvas they turn dark */
#kcap { left: 540px; text-align: center; white-space: nowrap; transform: translate(-50%, -50%); z-index: 60;
  font-family: var(--cap-font), sans-serif; font-weight: var(--cap-weight); font-size: var(--cap-size); letter-spacing: var(--cap-track);
  line-height: 1; color: var(--cap-color); text-transform: var(--cap-case); font-style: var(--cap-style); text-shadow: var(--cap-shadow);
  -webkit-text-stroke: var(--cap-stroke); paint-order: stroke fill; }
#kcap.news { font-size: calc(var(--cap-size) * 0.9); }
#kcap.canvas { color: var(--ink); text-shadow: none; -webkit-text-stroke: 0; }
#kcap .c { background: var(--cap-box); padding: var(--cap-pad); border-radius: 0.18em; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
#kcap .k { color: var(--cap-key); }
#kcap.canvas .k { color: var(--accent-dark); }
.khead { left: 0; width: 1080px; text-align: center; font-family: var(--font-head), sans-serif; font-weight: 800; color: var(--ink);
  letter-spacing: -0.035em; line-height: 1.04; }
.khead .ln { display: block; white-space: nowrap; position: relative; }
.khead span { display: inline-block; margin: 0 8px; }
.khead .serif { font-family: ${SERIF}; font-style: italic; font-weight: 600; letter-spacing: -0.01em; font-size: 1.12em; }
.khead .gold { color: var(--accent); }
.khead .ul { position: absolute; left: 50%; bottom: -12px; height: 7px; border-radius: 4px; background: linear-gradient(90deg, var(--accent-dark), var(--accent) 55%, var(--accent-light)); }
.kfloat { border-radius: 26px; background: #fff; color: var(--ink); overflow: hidden;
  box-shadow: 0 0 0 1px rgba(0,0,0,.07), 0 26px 60px -24px rgba(0,0,0,.32); }
.kphone { border-radius: 58px; background: #0b0b0c; padding: 14px; box-shadow: 0 30px 70px -26px rgba(0,0,0,.5); }
.kphone .scr { position: relative; width: 100%; height: 100%; border-radius: 46px; overflow: hidden; }
.kphone .scr img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.kphone .isl { position: absolute; left: 50%; top: 12px; width: 110px; height: 32px; margin-left: -55px; border-radius: 16px; background: #000; z-index: 2; }
.kphone .rail { position: absolute; right: 16px; bottom: 120px; display: flex; flex-direction: column; gap: 26px; z-index: 2; }
.kphone .rail svg { width: 44px; height: 44px; }
.kphone .who { position: absolute; left: 22px; bottom: 40px; right: 90px; color: #fff; font: 600 24px var(--font-body), sans-serif; z-index: 2; text-shadow: 0 1px 6px rgba(0,0,0,.4); }
.kphone .who small { display: block; font-weight: 400; font-size: 21px; opacity: .85; margin-top: 4px; }
.kphone .play { position: absolute; left: 50%; top: 50%; width: 92px; height: 92px; margin: -46px 0 0 -46px; border-radius: 50%; background: rgba(0,0,0,.35); display: grid; place-items: center; z-index: 2; }
.kgrid { display: grid; }
.kgrid .t { position: relative; border-radius: 16px; overflow: hidden; box-shadow: 0 16px 34px -18px rgba(0,0,0,.45); }
.kgrid .t img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.kgrid .t svg { position: absolute; left: 50%; top: 50%; width: 40px; height: 40px; margin: -20px 0 0 -17px; }
.kgrid .t b { position: absolute; left: 10px; bottom: 8px; color: #fff; font: 600 19px var(--font-body), sans-serif; text-shadow: 0 1px 4px rgba(0,0,0,.5); }
.kstat .lbl { font: 600 26px var(--font-body), sans-serif; color: color-mix(in srgb, var(--ink) 55%, transparent); text-transform: uppercase; letter-spacing: .08em; }
.kstat .big { font: 800 120px var(--font-head), sans-serif; letter-spacing: -0.04em; line-height: 1; margin-top: 10px; }
.kstat .sub { font: 500 28px var(--font-body), sans-serif; color: color-mix(in srgb, var(--ink) 60%, transparent); margin-top: 6px; }
.kstat .bars { position: absolute; left: 44px; right: 44px; bottom: 70px; height: 190px; display: flex; align-items: flex-end; gap: 22px; }
.kstat .bars i { flex: 1; border-radius: 10px 10px 4px 4px; background: #d9d7d2; transform-origin: 50% 100%; }
.kstat .bars i.on { background: linear-gradient(180deg, var(--accent-light), var(--accent)); }
.kstat .days { position: absolute; left: 44px; right: 44px; bottom: 26px; display: flex; gap: 22px; font: 500 22px var(--font-body), sans-serif; color: color-mix(in srgb, var(--ink) 45%, transparent); }
.kstat .days span { flex: 1; text-align: center; }
.khl { padding: 46px 52px; font: 500 54px/1.4 var(--font-body), sans-serif; letter-spacing: -0.02em; color: var(--ink); }
.khl mark { color: inherit; padding: 0 4px; border-radius: 6px; -webkit-box-decoration-break: clone; box-decoration-break: clone;
  background: linear-gradient(color-mix(in srgb, var(--accent-light) 90%, transparent), color-mix(in srgb, var(--accent-light) 90%, transparent)) no-repeat 0 60% / calc(var(--k, 0) * 100%) 82%; }
.kban { left: 40px; transform-origin: 0 50%; }
.kban .bk { display: inline-block; padding: 14px 40px 18px 34px; background: var(--ink); border-radius: 18px; transform: skewX(-8deg);
  box-shadow: 0 18px 40px -16px rgba(0,0,0,.6); }
.kban .bk div { transform: skewX(8deg); font: 900 74px/0.98 var(--font-head), sans-serif; letter-spacing: -0.02em; color: #f7f6f3; text-transform: uppercase; white-space: nowrap; }
.kban .gold { color: var(--accent-light); }
`;
  document.head.appendChild(css);
  // start loading the brand fonts now, so the renderer's document.fonts.ready waits for them
  ['800 64px var(--font-head)', '900 74px var(--font-head)', '800 58px var(--font-body)', '500 46px var(--font-body)', 'italic 600 70px Baskerville']
    .forEach((f) => document.fonts.load(f).catch(() => 0));

  const stage = document.getElementById('stage'), footage = document.getElementById('a'), CAP = document.getElementById('cap');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const show = (el, on, disp = 'block') => { el.style.display = on ? disp : 'none'; };
  const add = (cls, html = '') => { const el = document.createElement('div'); el.className = 'ui ' + cls; el.innerHTML = html; stage.insertBefore(el, CAP); return el; };
  const PLAY = '<svg viewBox="0 0 24 24"><path fill="#fff" d="M7 4.5v15l12-7.5z"/></svg>';
  const GRADS = ['linear-gradient(160deg,#e2b688,#a8673f 55%,#4a2b1c)', 'linear-gradient(160deg,#9fb8c8,#4f6f86 60%,#1f2f3c)',
    'linear-gradient(160deg,#c9d4b5,#7d9468 60%,#34442a)', 'linear-gradient(160deg,#e6c3b8,#b36f62 60%,#5a2f28)',
    'linear-gradient(160deg,#d8d0e4,#8b7aa6 60%,#3b3150)', 'linear-gradient(160deg,#f0dca8,#c99a3d 60%,#6b4a12)'];
  // markup for headline/banner words: *serif accent*  _gold word_
  const words = (line) => line.split(/\s+/).map((raw) => {
    const serif = /^\*.*\*[.,!?]*$/.test(raw), gold = /^_.*_[.,!?]*$/.test(raw), w = raw.replace(/[*_]/g, '');
    return `<span class="${serif ? 'serif gold' : gold ? 'gold' : ''}">${esc(w)}</span>`;
  }).join('');

  // ---------------------------------------------------------------- layout engine
  // One speaker layer is drawn in every layout and MORPHS between them: its clip rectangle, corner radius and vertical
  // offset are interpolated over MORPH seconds (starting LEAD s before the cue word), so full -> box -> split are moves,
  // not cuts. The canvas / news panel fade in behind it and the caption glides to its new spot.
  const MORPH = 0.4, LEAD = 0.3;     // the move settles just as the cue word lands
  const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  let SEG = [], BOX = null, NEWS = null, PIP = null;
  // per segment: [t, mode, { trans, dur, lead }]  dur = how long the move takes, lead = how early it starts before t
  const leadOf = (seg) => (seg[2] && seg[2].trans === 'cut' ? 0 : seg[2] && seg[2].lead != null ? seg[2].lead : LEAD);   // a straight cut lands on the word, not before it
  const durOf = (seg) => (seg && seg[2] && seg[2].dur) || MORPH;
  const modeAt = (t) => { let m = 'full'; for (const sg of SEG) if (t >= sg[0] - leadOf(sg)) m = sg[1]; return m; };
  // every layout: clip rect (x,y,w,h,r) + footage transform (translate ox, oy + dy, scale s) + which backgrounds show
  function geom(m) {
    const base = { s: 1, ox: 0, oy: 0, canvas: 0, news: 0, pip: 0 };
    if (m === 'canvas') return { ...base, x: BOX.left, y: BOX.top, w: BOX.width, h: BOX.height, r: BOX.radius, dy: BOX.top - BOX.y0, canvas: 1,
      cap: BOX.top - (BOX.capGap || 175) };
    // news: the caption sits in the speaker's half just under the chin (never above the head on a dark panel)
    if (m === 'news') return { ...base, x: 0, y: 960, w: 1080, h: 960, r: 0, dy: 960 - NEWS.y0, news: 1, cap: NEWS.capY };
    // pip (editorial): the whole frame scales down into a rounded card on a cream canvas; the face sits ~42% down the card
    if (m === 'pip') return { ...base, x: PIP.left, y: PIP.top, w: PIP.width, h: PIP.height, r: PIP.radius, dy: 0, s: PIP.scale,
      ox: PIP.left + PIP.width / 2 - PIP.face[0] * PIP.scale, oy: PIP.top + PIP.height * PIP.faceY - PIP.face[1] * PIP.scale, pip: 1,
      cap: STYLE.captions.center_y };
    return { ...base, x: 0, y: 0, w: 1080, h: 1920, r: 0, dy: 0, cap: STYLE.captions.center_y };
  }
  function stateAt(t) {             // interpolated geometry + the layout we're in / heading into
    let k = -1; SEG.forEach((sg, i) => { if (t >= sg[0] - leadOf(sg)) k = i; });
    const cur = k < 0 ? 'full' : SEG[k][1], prev = k > 0 ? SEG[k - 1][1] : cur;
    // per-segment transition: [time, mode, { trans }]  'morph' (default: geometry eases), 'slide' (jump to the new layout,
    // the speaker card slides in from the right; use it when something covers the jump, e.g. a chapter card), 'cut'
    const tr = (k >= 0 && SEG[k][2] && SEG[k][2].trans) || 'morph';
    const raw = k < 0 ? 1 : FX.clamp((t - (SEG[k][0] - leadOf(SEG[k]))) / durOf(SEG[k]));
    const p = tr === 'morph' ? easeIO(raw) : 1;
    const a = geom(prev), b = geom(cur), g = {};
    for (const key of Object.keys(b)) g[key] = a[key] + (b[key] - a[key]) * p;
    g.slide = tr === 'slide' ? Math.pow(1 - raw, 3) * 900 : 0;
    return { ...g, mode: cur, prev, p: tr === 'morph' ? p : (raw > 0 ? 1 : 0), opt: (k >= 0 && SEG[k][2]) || {}, optPrev: (k > 0 && SEG[k - 1][2]) || {},
      capFrom: a.cap, capTo: b.cap, moving: tr === 'morph' && raw > 0 && raw < 1 };
  }
  // capMode (default: style.json captions.mode, else 'word'): 'word' (one word at a time in canvas/full) | 'off' | 'chunk' (the 2-4 word chunk everywhere, at a fixed spot in full)
  // capMove: 'glide' (the caption slides to its new spot with the move) | 'fade' (fades out where it was, back in at the new
  // spot, so it never slides across the face)
  function layout({ segments, box = {}, news = {}, pip = {}, capMode = (window.STYLE.captions.mode || 'word'), cream = 'var(--paper)', capMove = 'glide' }) {
    PIP = { left: 275, top: 880, width: 530, height: 640, radius: 36, scale: 0.56, face: [540, 960], faceY: 0.42, border: 'var(--accent-light)', ...pip };
    SEG = segments.slice().sort((a, b) => a[0] - b[0]);
    // a short whoosh peaking in the middle of every layout move (none for a straight cut)
    SEG.forEach((s, k) => { if (k && s[1] !== SEG[k - 1][1] && !(s[2] && s[2].trans === 'cut'))
      FX.cue('whoosh-short', s[0] - leadOf(s) + durOf(s) / 2, { src: 'KAL.layout ' + s[1] }); });
    BOX = { top: 1250, left: 48, width: 984, height: 640, radius: 40, y0: 830, capGap: 175, ...box };   // y0 = source row at the box top
    NEWS = { y0: 700, capY: 1508, top: 'dark', ...news };          // y0 = source row at the seam (head just under it); capY = caption under the chin
    CAP.style.setProperty('display', 'none', 'important');      // KAL draws its own captions per layout
    footage.style.visibility = 'hidden';                         // the speaker layer below draws the footage in every layout
    window.POP_EXIT_LIFT = 18;                                   // elements lift up a little as they leave
    let after = footage;
    const base = (cls, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; stage.insertBefore(d, after.nextSibling); after = d; return d; };
    const canvas = base('klay kcanvas');
    const NTOP = NEWS.top === 'light' ? 'var(--canvas)' : NEWS.top === 'dark' ? '#0d0d0d' : NEWS.top;   // or any colour
    const ntop = base('kntop'); ntop.style.background = NTOP;
    const creamBg = base('kcream'); creamBg.style.background = cream;
    const frame = base('kframe');                                                  // the box's soft shadow (clip-path can't cast one)
    const spk = base('kspk', '<img alt="">'); const spkImg = spk.firstChild;
    const clip = base('kclip', '<img alt="">'); const clipImg = clip.firstChild;      // the head breaking out above the box
    const seam = base('kseam');
    window.__baseLayer = seam;
    const cap = add('', ''); cap.id = 'kcap'; cap.dataset.role = 'caption';   // audited for safe areas, exempt from headroom
    const ws = window.WORDS, caps = window.CAPS;
    const covered = (w) => caps.some((c) => w.s >= c.s - 0.06 && w.s < c.e);
    const CZ = window.STYLE.captions.censor || {};   // the same swear-word stars captions.py uses, for one-word captions
    const censor = (w) => { const k = w.toLowerCase().replace(/[^a-z]/g, ''); return CZ[k] ? w.replace(new RegExp(k, 'i'), CZ[k]) : w; };
    BEAT.custom((t) => {
      const g = stateAt(t), src = footage.getAttribute('src'), i = Math.round(t * STYLE.fps);
      if (src) FX.setSrc(spkImg, src);
      const X = g.x + g.slide;
      spk.style.clipPath = `inset(${g.y.toFixed(1)}px ${(1080 - X - g.w).toFixed(1)}px ${(1920 - g.y - g.h).toFixed(1)}px ${X.toFixed(1)}px round ${g.r.toFixed(1)}px)`;
      const { z, S, OX, OY } = xform(t, g);                     // punch-in / close-wide framing (full frame only)
      spkImg.style.transformOrigin = '0 0';
      spkImg.style.transform = `translate(${OX.toFixed(1)}px, ${OY.toFixed(1)}px) scale(${S.toFixed(4)})`;
      window.__spkX = z.s !== 1 ? { S, OX, OY } : null;           // the impact cutout (components.js) follows the zoom: no doubled head
      creamBg.style.display = g.pip > 0.001 ? 'block' : 'none';
      // backgrounds stay solid (the speaker frame grows/shrinks over them)
      canvas.style.display = g.canvas > 0.001 ? 'block' : 'none'; canvas.style.opacity = '1';
      const fr = Math.max(g.canvas, g.pip);
      frame.style.display = fr > 0.001 ? 'block' : 'none';
      Object.assign(frame.style, { left: X.toFixed(1) + 'px', top: g.y.toFixed(1) + 'px', width: g.w.toFixed(1) + 'px', height: g.h.toFixed(1) + 'px',
        borderRadius: g.r.toFixed(1) + 'px', opacity: fr.toFixed(3),
        boxShadow: `0 0 0 ${(5 * g.pip).toFixed(1)}px ${PIP.border}, 0 30px 70px -30px rgba(0,0,0,.45)` });
      ntop.style.display = g.news > 0.001 ? 'block' : 'none';     // news <-> canvas: the dark panel slides up/out over the canvas
      const nTop = (g.mode === 'news' ? g.opt : g.optPrev).top;    // per-segment panel colour: [t, 'news', { top: 'dark' | 'var(--paper)' }]
      if (nTop) ntop.style.background = nTop === 'dark' ? '#0d0d0d' : nTop === 'light' ? 'var(--canvas)' : nTop; else ntop.style.background = NTOP;
      ntop.style.transform = g.canvas > 0.001 || NEWS.drop || (g.mode === 'news' ? g.opt : g.optPrev).drop ? `translateY(${(-(1 - g.news) * 980).toFixed(1)}px)` : 'none';   // news.drop: panel drops in from full too (Editorial)
      seam.style.display = g.news > 0.5 ? 'block' : 'none';
      const breakout = g.canvas > 0.001 && g.y > 300;        // only while the box sits low enough for the head to poke out
      clip.style.display = breakout ? 'block' : 'none';
      if (breakout) { clip.style.height = g.y.toFixed(1) + 'px'; clipImg.style.transform = `translateY(${g.dy.toFixed(1)}px)`;
        FX.setSrc(clipImg, `assets/fg/${String(i).padStart(5, '0')}.png`); }
      // captions: one word (canvas/full) or the 2-4 word chunk (news); hidden wherever captions.json hides them
      const m = g.p < 0.5 ? g.prev : g.mode;
      let txt = '';
      const oneWord = capMode === 'small' || capMode === 'bold';    // one-word caption modes: never the 2-4 word chunk
      if ((m === 'news' && !oneWord) || capMode === 'chunk') { const c = caps.find((x) => t >= x.s && t < x.e); txt = c ? c.t : ''; }
      else {
        for (let k = 0; k < ws.length; k++) {
          const w = ws[k], end = Math.min(ws[k + 1] ? ws[k + 1].s - 0.04 : END, w.e + 0.35);
          if (t >= w.s - 0.04 && t < end && covered(w)) { txt = censor(w.w.replace(/[,;:]$/, '')); break; }
        }
      }
      if (capMode === 'off' || (window.CAP_SUPPRESS || []).some(([a, b]) => t >= a && t < b)) txt = '';   // another caption tier owns this moment
      cap.className = 'ui ' + m + (capMode === 'chunk' ? ' chunk' : capMode === 'word' ? '' : ' ' + capMode) + (txt && window.CAP_KEY && window.CAP_KEY(txt) ? ' key' : '');
      if (cap.dataset.t !== txt) { cap.dataset.t = txt; cap.innerHTML = txt ? window.capHTML(txt) : ''; }
      cap.style.display = txt ? 'block' : 'none';
      const cy = typeof window.__capSmallY === 'function' ? window.__capSmallY(t) : window.__capSmallY;   // Minimalist: under the chin
      let y = capMode === 'small' && cy && g.canvas < 0.001 && g.news < 0.001 && g.pip < 0.001 ? cy : g.cap;
      if (capMode === 'small' && y === cy && window.__spkX) y = Math.min(1470, window.__spkX.OY + window.__spkX.S * cy);   // close shot: stay under the chin
      cap.style.opacity = '1';
      if (capMove === 'fade' && g.moving && Math.abs(g.capTo - g.capFrom) > 1) {
        // a caption on a split's panel only shows while the panel is fully there: it goes the moment the panel starts to
        // lift, and comes back once the panel has nearly landed (else it would sit on the face for a few frames)
        const fromPanel = g.prev === 'news', toPanel = g.mode === 'news';
        y = g.p < 0.5 ? g.capFrom : g.capTo;
        cap.style.opacity = (g.p < 0.5 ? (fromPanel ? 0 : FX.clamp(1 - g.p / 0.4)) : toPanel ? FX.clamp((g.p - 0.93) / 0.07) : FX.clamp((g.p - 0.6) / 0.4)).toFixed(3);
      }
      cap.style.top = y.toFixed(1) + 'px';                    // glides with the layout move (or fades across it)
    });
    // for safezone.mjs (head moves with the layout) and cutout.py --auto (canvas needs the head cut out on every frame)
    window.__headShift = (t) => stateAt(t).dy;
    window.__headMap = (t) => { const { S, OX, OY } = xform(t, stateAt(t)); return [S, OX, OY]; };   // screen = (OX + S*x, OY + S*y)
    KAL.cutouts = SEG.map(([s, mode], k) => mode === 'canvas' ? [Math.max(0, s - LEAD), k + 1 < SEG.length ? SEG[k + 1][0] + MORPH : END] : null)
      .filter(Boolean).map(([at, until]) => ({ at, until, text: 'canvas head' }));
  }

  // ---------------------------------------------------------------- punch-in zoom (full frame), centred on the face
  // KAL.punch({ at, until, scale: 1.12 }) eases in over 0.22 s, holds, eases out over 0.22 s. Don't punch while a card or a
  // behind-the-head word is up (the cutout would not scale with it).
  const PUNCH = [];
  function punch({ at, until, scale = 1.12 }) { PUNCH.push({ at, until, scale }); FX.cue('whoosh-short', at + 0.11, { src: 'KAL.punch' }); }
  // close/wide framing: every cut in the first cut alternates wide (1) and close (scale),
  // a hard change on the cut, never mid-shot. cuts = window.CUTS (scripts/cuts.py). Shots shorter than minShot keep the
  // previous framing so it never flickers; skip = [[a, b]] ranges that stay wide (e.g. while a word sits behind the head).
  const FRAMING = [];
  function framing({ cuts = window.CUTS || [], scale = 1.15, minShot = 1.4, startClose = false, skip = [] }) {
    let close = startClose, last = -1e9; FRAMING.length = 0; FRAMING.push([0, close ? scale : 1]);
    for (const c of cuts.slice().sort((a, b) => a - b)) {
      if (c - last < minShot) continue;
      close = !close; last = c; FRAMING.push([c, close ? scale : 1]);
    }
    FRAMING.skip = skip;
  }
  function frameAt(t) {
    if ((FRAMING.skip || []).some(([a, b]) => t >= a && t < b)) return 1;
    let s = 1; for (const [c, v] of FRAMING) if (t >= c) s = v; return s;
  }
  function xform(t, g) {
    const z = g.canvas < 0.001 && g.news < 0.001 && g.pip < 0.001 ? zoomAt(t) : { s: 1, ox: 540, oy: 960 };
    return { z, S: g.s * z.s, OX: g.ox + g.slide - (z.s - 1) * z.ox, OY: g.oy + g.dy - (z.s - 1) * z.oy };
  }
  function zoomAt(t) {
    let s = frameAt(t);
    for (const p of PUNCH) if (t >= p.at && t < p.until) {
      const e = Math.min(FX.clamp((t - p.at) / 0.22), FX.clamp((p.until - t) / 0.22));
      s = frameAt(t) * (1 + (p.scale - 1) * easeIO(e));
    }
    const H = window.HEADS, k = H ? Math.round(t / H.step) : -1;
    const top = H && H.top[k] != null ? H.top[k] : 720, l = H && H.left[k] != null ? H.left[k] : 380, r = H && H.right[k] != null ? H.right[k] : 700;
    return { s, ox: (l + r) / 2, oy: top + 230 };
  }

  // ---------------------------------------------------------------- fill the stage + slow drift
  // Scales a card (BEAT.card / ANT.profile / ANT.timeline / KAL.float...) to fill the space between the headline and the
  // caption (default y 400-1000), centred, and gives it a slow ~2% push-in while it holds so the frame never looks frozen.
  function fit(el, { at, until, top = 400, bottom = 1000, fill = 0.9, maxScale = 1.6, drift = 0.02 }) {
    const w = el.offsetWidth || parseFloat(el.style.width) || 960, h = el.offsetHeight || parseFloat(el.style.height) || 300;
    const s = Math.min(maxScale, (1080 * 0.92) / w, ((bottom - top) * fill) / h);
    const inner = document.createElement('div');
    inner.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;transform-origin:0 0`;
    while (el.firstChild) inner.appendChild(el.firstChild);
    el.appendChild(inner);
    el.style.width = (w * s).toFixed(1) + 'px'; el.style.height = (h * s).toFixed(1) + 'px';
    el.style.left = ((1080 - w * s) / 2).toFixed(1) + 'px'; el.style.top = (top + ((bottom - top) - h * s) / 2).toFixed(1) + 'px';
    el.style.borderRadius = (34 * Math.min(s, 1.3)).toFixed(1) + 'px';
    BEAT.custom((t) => { if (t >= at && t < until) inner.style.transform = `scale(${(s * (1 + drift * FX.clamp((t - at) / Math.max(1, until - at)))).toFixed(4)})`; });
    return el;
  }

  // ---------------------------------------------------------------- canvas headline: heavy sans, *serif* / _gold_ accents
  function headline({ lines, at, until, top = 225, size = 66, underline = true, color = 'var(--ink)' }) {
    const el = add('khead', lines.map((l, i) => `<span class="ln">${words(l)}${underline && i === lines.length - 1 ? '<i class="ul"></i>' : ''}</span>`).join(''));
    el.style.top = top + 'px'; el.style.fontSize = size + 'px'; el.style.color = color;
    const lns = [...el.querySelectorAll('.ln')], ul = el.querySelector('.ul');
    BEAT.custom((t) => {
      if (!FX.pop(el, t, at, until, { origin: '50% 0%' })) return;
      lns.forEach((l, i) => { const k = FX.spring(t - at - 0.06 * i); l.style.opacity = FX.clamp((t - at - 0.06 * i) / 0.1).toFixed(3); l.style.transform = `translateY(${((1 - k) * 18).toFixed(1)}px)`; });
      if (ul) { const last = lns[lns.length - 1].querySelectorAll('span'), w = [...last].reduce((s, x) => s + x.offsetWidth + 16, 0) * 0.86;
        const p = FX.outCubic(FX.clamp((t - at - 0.25) / 0.45)); ul.style.width = (w * p).toFixed(1) + 'px'; ul.style.marginLeft = (-w / 2).toFixed(1) + 'px'; }
    });
    return el;
  }

  // ---------------------------------------------------------------- floating white card (any HTML)
  function float({ html, at, until, top = 440, width = 860, height = 420, left = null, cls = '', update = null }) {
    const el = add('kfloat ' + cls, html);
    Object.assign(el.style, { top: top + 'px', left: (left == null ? (1080 - width) / 2 : left) + 'px', width: width + 'px', height: height + 'px' });
    BEAT.custom((t) => { if (FX.pop(el, t, at, until) && update) update(t, el, t - at); });
    return el;
  }

  // ---------------------------------------------------------------- phone mockup playing a reel (image or frame folder)
  //   src: 'assets/x.jpg' | frames: 'assets/clip/' + count (001.jpg..) | nothing = illustrative gradient
  function phone({ at, until, top = 420, height = 620, left = null, src, frames, count = 0, who = '', caption = '', play = false }) {
    const w = Math.round(height * 0.49);
    const heart = '<svg viewBox="0 0 24 24"><path fill="#fff" d="M12 21s-7.5-4.6-9.3-9.5C1.6 8.2 3.6 5 6.9 5c2 0 3.6 1.1 5.1 3 1.5-1.9 3.1-3 5.1-3 3.3 0 5.3 3.2 4.2 6.5C19.5 16.4 12 21 12 21z"/></svg>';
    const bub = '<svg viewBox="0 0 24 24"><path fill="#fff" d="M12 3C6.5 3 2 6.8 2 11.5c0 2.3 1.1 4.4 2.9 5.9L4 21l4.2-2.1c1.2.4 2.5.6 3.8.6 5.5 0 10-3.8 10-8.5S17.5 3 12 3z"/></svg>';
    const el = add('kphone', `<div class="scr" style="background:${GRADS[0]}"><div class="isl"></div><img alt="" style="display:${src || frames ? 'block' : 'none'}">
      ${play ? `<div class="play">${PLAY}</div>` : ''}<div class="rail">${heart}${bub}</div><div class="who">${esc(who)}<small>${esc(caption)}</small></div></div>`);
    Object.assign(el.style, { top: top + 'px', left: (left == null ? (1080 - w) / 2 : left) + 'px', width: w + 'px', height: height + 'px' });
    const img = el.querySelector('img');
    BEAT.custom((t) => {
      if (!FX.pop(el, t, at, until)) return;
      if (frames) FX.setSrc(img, `${frames}${String(Math.max(1, Math.min(count, Math.floor((t - at) * STYLE.fps) + 1))).padStart(3, '0')}.jpg`);
      else if (src) FX.setSrc(img, src);
    });
    return el;
  }

  // ---------------------------------------------------------------- grid of 9:16 reel thumbnails, popping in one by one
  function grid({ at, until, top = 440, n = 6, cols = 3, tileW = 160, tileH = 284, gap = 20, items = [], labels = [], stagger = 0.08 }) {
    const rows = Math.ceil(n / cols), w = cols * tileW + (cols - 1) * gap;
    const el = add('kgrid', Array.from({ length: n }, (_, i) => `<div class="t" style="width:${tileW}px;height:${tileH}px;background:${GRADS[i % GRADS.length]}">${
      items[i] ? `<img src="${items[i]}">` : ''}${PLAY}${labels[i] ? `<b>${esc(labels[i])}</b>` : ''}</div>`).join(''));
    Object.assign(el.style, { top: top + 'px', left: (1080 - w) / 2 + 'px', gridTemplateColumns: `repeat(${cols}, ${tileW}px)`, gap: gap + 'px' });
    const tiles = [...el.children];
    BEAT.custom((t) => {
      if (!FX.pop(el, t, at, until, { disp: 'grid' })) return;
      tiles.forEach((d, i) => { const t0 = at + stagger * i, k = FX.spring(t - t0);
        d.style.opacity = FX.clamp((t - t0) / 0.1).toFixed(3); d.style.transform = `translateY(${((1 - k) * 24).toFixed(1)}px) scale(${(0.86 + 0.14 * k).toFixed(3)})`; });
    });
    void rows;
    return el;
  }

  // ---------------------------------------------------------------- big stat card with a bar chart (e.g. screen time)
  function stat({ at, until, top = 230, width = 900, height = 620, label = '', big = '', sub = '', bars = [], on = -1, days = [], growAt = null }) {
    const html = `<div style="position:absolute;left:44px;top:40px;right:44px"><div class="lbl">${esc(label)}</div><div class="big">${esc(big)}</div><div class="sub">${esc(sub)}</div></div>
      <div class="bars">${bars.map((_, i) => `<i class="${i === on ? 'on' : ''}"></i>`).join('')}</div><div class="days">${days.map((d) => `<span>${esc(d)}</span>`).join('')}</div>`;
    const mx = Math.max(...bars, 1), g0 = growAt == null ? at + 0.2 : growAt;
    return float({ html, at, until, top, width, height, cls: 'kstat', update: (t, el) => {
      el.querySelectorAll('.bars i').forEach((b, i) => { const p = FX.outCubic(FX.clamp((t - g0 - 0.05 * i) / 0.5));
        b.style.height = (190 * bars[i] / mx).toFixed(1) + 'px'; b.style.transform = `scaleY(${p.toFixed(3)})`; });
    } });
  }

  // ---------------------------------------------------------------- text block with gold highlighter sweeping key phrases
  //   text with [phrase] marks; marks: times for each [phrase] in order
  function highlight({ text, marks = [], at, until, top = 230, width = 940, height = 600 }) {
    let k = 0;
    const html = `<div class="khl"><span class="tx">${esc(text).replace(/\[(.+?)\]/g, (_, p) => `<mark data-i="${k++}">${p}</mark>`)}</span></div>`;
    return float({ html, at, until, top, width, height, update: (t, el) => {
      el.querySelectorAll('mark').forEach((m, i) => { const t0 = marks[i] == null ? Infinity : marks[i];
        m.style.setProperty('--k', FX.outCubic(FX.clamp((t - t0) / 0.35)).toFixed(3)); });
    } });
  }

  // ---------------------------------------------------------------- slanted title banner on the news seam (the hook)
  function banner({ lines, at, until, top = 790 }) {
    const el = add('kban', `<div class="bk">${lines.map((l) => `<div>${words(l)}</div>`).join('')}</div>`);
    el.style.top = top + 'px';
    BEAT.custom((t) => {
      const on = t >= at && t < until; show(el, on); if (!on) return;
      const k = FX.spring(t - at), e = FX.clamp((until - t) / 0.18);
      el.style.opacity = (FX.clamp((t - at) / 0.08) * e).toFixed(3);
      el.style.transform = `translateX(${((1 - k) * 420).toFixed(1)}px)`;
    });
    return el;
  }

  const KAL = { layout, fit, punch, framing, zoomAt, headline, float, phone, grid, stat, highlight, banner, modeAt, stateAt, cutouts: [] };
  window.KAL = KAL;
})();
