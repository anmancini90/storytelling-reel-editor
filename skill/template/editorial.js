// editorial.js: EDT.* editorial building blocks (cream + gold): KAL.layout's 'pip' mode (the frame scales into a
// rounded card on a cream canvas), fixed chunk captions, chapter cards, graphs, checklists, end cards, doodles.
// Documented in the comments below.
//
//   EDT.setup({ segments })                    KAL.layout with 'full' / 'pip' segments, chunk captions, cream canvas
//   EDT.words({ lines, until })                serif words built word-by-word as spoken, behind the head (cutout)
//   EDT.battery({ at, until, pct, swapAt })    watch-style battery card: drains to pct, label "Battery" -> "Life energy"
//   EDT.points({ title, items, until })        numbered / question cards that pop in one by one on the canvas
//   EDT.balance({ items, heavy, at, leanAt, until })   balanced bars; on leanAt one grows and the rest shrink + dim
(() => {
  const SERIF = 'var(--font-serif)';
  const css = document.createElement('style');
  css.textContent = `
.kcream { background-image: linear-gradient(color-mix(in srgb, var(--ink) 3.5%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--ink) 3.5%, transparent) 1px, transparent 1px);
  background-size: 54px 54px; }
.edtw { left: 0; width: 1080px; text-align: center; font-family: ${SERIF}; color: var(--ink); line-height: 0.98; letter-spacing: -0.01em;
  text-shadow: 0 0 24px rgba(247,246,243,.85), 0 0 8px rgba(247,246,243,.7); }
.edtw .ln { display: block; white-space: nowrap; }
.edtw .w { display: inline-block; margin: 0 0.12em; }
.edtw .big { font-weight: 600; }
.edtw .outline { color: transparent; -webkit-text-stroke: 2.5px var(--ink); text-shadow: none; }
.edtw .gold { color: var(--accent-dark); font-style: italic; }
.edtc { border-radius: 30px; background: #fff; color: var(--ink); box-shadow: 0 0 0 1px rgba(0,0,0,.06), 0 24px 56px -26px rgba(0,0,0,.35); font-family: var(--font-body), sans-serif; }
.edtb .lbl { position: absolute; left: 0; right: 0; top: 46px; text-align: center; font: 600 26px var(--font-body), sans-serif; letter-spacing: .14em; text-transform: uppercase; color: color-mix(in srgb, var(--ink) 45%, transparent); }
.edtb .bat { position: absolute; left: 50%; top: 116px; width: 300px; height: 150px; margin-left: -166px; border: 10px solid var(--ink); border-radius: 34px; }
.edtb .bat::after { content: ''; position: absolute; right: -32px; top: 40px; width: 16px; height: 50px; border-radius: 0 10px 10px 0; background: var(--ink); }
.edtb .fill { position: absolute; left: 10px; top: 10px; bottom: 10px; border-radius: 18px; background: #c94a3a; }
.edtb .pct { position: absolute; left: 0; right: 0; top: 306px; text-align: center; font: 600 112px/1 ${SERIF}; letter-spacing: -0.02em; }
.edtb .what { position: absolute; left: 0; right: 0; top: 440px; text-align: center; font: 400 54px/1 ${SERIF}; }
.edtb .what s { color: color-mix(in srgb, var(--ink) 40%, transparent); text-decoration-thickness: 3px; }
.edtb .what i { color: var(--accent); }
.edtp .ttl { position: absolute; left: 0; width: 1080px; text-align: center; font: 600 74px/1.05 ${SERIF}; color: var(--ink); letter-spacing: -0.01em; }
.edtp .row { position: absolute; left: 70px; width: 940px; height: 118px; display: flex; align-items: center; gap: 24px; padding: 0 30px; }
.edtp .num { flex: none; width: 58px; height: 58px; border-radius: 50%; background: var(--accent); color: #fff; display: grid; place-items: center; font: 700 28px var(--font-body), sans-serif; }
.edtp .num.q { background: transparent; border: 4px solid var(--accent); color: var(--accent); }
.edtp .tx { font: 500 50px/1.15 ${SERIF}; color: var(--ink); white-space: nowrap; }
.edtl .bar { position: absolute; left: 330px; height: 64px; border-radius: 16px; background: var(--accent-light); transform-origin: 0 50%; }
.edtl .bar.heavy { background: var(--accent); }
.edtl .name { position: absolute; left: 60px; width: 250px; text-align: right; font: 500 48px/64px ${SERIF}; color: var(--ink); }
.edtl .ttl { position: absolute; left: 0; width: 1080px; text-align: center; font: 600 74px/1.05 ${SERIF}; color: var(--ink); }
`;
  document.head.appendChild(css);
  const stage = document.getElementById('stage'), CAP = document.getElementById('cap');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9%]/g, '');
  const suppress = (a, b) => { (window.CAP_SUPPRESS = window.CAP_SUPPRESS || []).push([a, b]); };
  const add = (cls, html = '', before = CAP) => { const el = document.createElement('div'); el.className = 'ui ' + cls; el.innerHTML = html; stage.insertBefore(el, before); return el; };
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);

  // the pip card is 600 wide so a chunk caption (fixed at chest height) sits on the footage, not on the cream
  // split = KAL 'news' with a cream top panel that drops in; the caption stays at its fixed chest spot
  // captions follow the saved style's captions.mode (capMode overrides it); serif text uses the style's serif font
  function setup({ segments, pip = {}, news = {}, cream = 'var(--paper)', capMode }) {
    KAL.layout({ segments, pip: { left: 240, width: 600, height: 640, scale: 0.6, ...pip },
      news: { top: cream, y0: 720, capY: STYLE.captions.center_y, drop: true, ...news }, capMode, cream });
  }

  // ---- serif words, built as spoken (each word: fade + 18 px rise + blur clearing), behind the head.
  // lines: [{ text, size, style: ''|'big'|'outline'|'gold' }]; *word* = gold italic, ~word~ = outline. Words are matched to
  // the transcript in order from `at`; the block sits above the head with the head covering the bottom of the last line.
  // cx / maxWidth: centre and width of the block (put it over the plainest part of the background); the block is
  // scaled down to fit maxWidth. tuck: how much of the last line the head covers (0 = sits fully above the head).
  function words({ lines, at, until, top = null, tuck = 0.15, cx = 540, maxWidth = 980 }) {
    if (!document.getElementById('fg')) ANT.impact({ text: ' ', at: -1, until: -0.5 });
    const el = add('edtw', '', document.getElementById('fg')); el.dataset.role = 'behind';
    ANT.impacts.push({ at, until, cut: true, text: 'editorial words' });
    suppress(at - 0.02, until + 0.05);
    const ws = window.WORDS; let cursor = at - 0.05;
    const toks = [];
    el.innerHTML = lines.map((ln) => `<span class="ln ${ln.style || ''}" style="font-size:${ln.size || 120}px">${ln.text.split(/\s+/).map((raw) => {
      const gold = /^\*.*\*$/.test(raw), out = /^~.*~$/.test(raw), w = raw.replace(/[*~]/g, '');
      const i = ws.findIndex((x) => x.s >= cursor && norm(x.w) === norm(w));
      const t0 = i >= 0 ? ws[i].s : (toks.length ? toks[toks.length - 1] + 0.12 : at);
      if (i >= 0) cursor = ws[i].s + 0.01;
      toks.push(Math.max(at, t0));
      return `<span class="w ${gold ? 'gold' : ''} ${out ? 'outline' : ''}">${esc(w)}</span>`;
    }).join('')}</span>`).join('');
    const spans = [...el.querySelectorAll('.w')];
    let laid = false;
    BEAT.custom((t) => {
      const on = t >= at - 0.02 && t < until + 0.3; el.style.display = on ? 'block' : 'none'; if (!on) return;
      if (!laid) {
        const wMax = Math.max(...[...el.children].map((ln) => ln.scrollWidth)), k = Math.min(1, maxWidth / Math.max(1, wMax));
        [...el.children].forEach((ln) => { ln.style.fontSize = (parseFloat(ln.style.fontSize) * k).toFixed(1) + 'px'; });
        el.style.left = (cx - 540).toFixed(0) + 'px';
        const h = el.offsetHeight, last = el.lastElementChild.offsetHeight, head = window.HEADS ? ANT.headTop(at, until) : 740;
        el.style.top = (top ?? Math.max(STYLE.safe_area.top + 20, head - h + last * tuck)).toFixed(0) + 'px'; laid = true;
      }
      const out = FX.clamp((t - until) / 0.3);
      spans.forEach((s, k) => { const p = easeOut(FX.clamp((t - toks[k]) / 0.35));
        s.style.opacity = (p * (1 - out)).toFixed(3); s.style.transform = `translateY(${((1 - p) * 18 - out * 10).toFixed(1)}px)`;
        s.style.filter = `blur(${((1 - p) * 8 + out * 4).toFixed(1)}px)`; });
    });
    return el;
  }

  // ---- watch battery: drains to pct on `at`, then the label swaps from "Battery" to "Life energy" on swapAt
  // scale < 1 = a compact card that floats above the head over full-frame footage (no layout change)
  function battery({ at, until, drainAt = at, pct = 10, swapAt, top = 230, from = 64, scale = 1 }) {
    const el = add('edtc edtb', `<div class="lbl">Watch</div><div class="bat"><div class="fill"></div></div><div class="pct"></div>
      <div class="what"><span class="a">Battery</span></div>`);
    Object.assign(el.style, { top: top + 'px', left: '190px', width: '700px', height: '560px' });
    const fill = el.querySelector('.fill'), pc = el.querySelector('.pct'), what = el.querySelector('.what');
    BEAT.custom((t) => {
      if (!FX.pop(el, t, at, until, { base: `scale(${scale})` })) return;
      const p = easeOut(FX.clamp((t - drainAt) / 0.9)), v = Math.round(from + (pct - from) * p);
      pc.textContent = v + '%'; fill.style.width = (280 * v / 100).toFixed(1) + 'px';
      fill.style.background = v <= 20 ? '#c94a3a' : '#4caf6a';
      what.innerHTML = t >= swapAt ? '<s>Battery</s>&nbsp; <i>Life energy</i>' : 'Battery';
    });
    return el;
  }

  // ---- numbered (or question) cards on the canvas, one per spoken item. items: [{ text, at }]; marker: 'num' | 'q'
  function points({ title = '', items, at, until, top = 215, marker = 'num', gap = 134 }) {
    const el = add('edtp', `${title ? `<div class="ttl" style="top:0">${esc(title)}</div>` : ''}${items.map((it, i) =>
      `<div class="row edtc" style="top:${(title ? 120 : 0) + i * gap}px"><div class="num ${marker === 'q' ? 'q' : ''}">${marker === 'q' ? '?' : i + 1}</div><div class="tx">${esc(it.text)}</div></div>`).join('')}`);
    Object.assign(el.style, { top: top + 'px', left: '0', width: '1080px', height: ((title ? 120 : 0) + items.length * gap) + 'px' });
    const rows = [...el.querySelectorAll('.row')];
    BEAT.custom((t) => {
      if (!FX.pop(el, t, at, until)) return;
      rows.forEach((r, i) => { const k = FX.spring(t - items[i].at); r.style.display = t >= items[i].at ? 'flex' : 'none';
        r.style.opacity = FX.clamp((t - items[i].at) / 0.12).toFixed(3); r.style.transform = `translateY(${((1 - k) * 24).toFixed(1)}px) scale(${(0.94 + 0.06 * k).toFixed(3)})`; });
    });
    el.dataset.sfx = 'none';
    if (title) FX.cue('pop', at, { src: 'EDT.points title' });
    items.forEach((it) => FX.cue('pop', it.at, { src: 'EDT.points' }));
    return el;
  }

  // ---- balance bars: equal at first; on leanAt the heavy bar grows and the others shrink + dim (the push and pull)
  //   grow / stagger / leanDur: seconds for the bars to grow in, the gap between bars, and the lean (longer = calmer)
  function balance({ title = '', items, heavy, at, leanAt, until, top = 230, grow: growDur = 0.5, stagger = 0.06, leanDur = 0.7 }) {
    const el = add('edtl', `${title ? `<div class="ttl" style="top:0">${esc(title)}</div>` : ''}${items.map((it, i) =>
      `<div class="name" style="top:${130 + i * 92}px">${esc(it)}</div><div class="bar ${it === heavy ? 'heavy' : ''}" style="top:${130 + i * 92}px"></div>`).join('')}`);
    Object.assign(el.style, { top: top + 'px', left: '0', width: '1080px', height: (130 + items.length * 92) + 'px' });
    const bars = [...el.querySelectorAll('.bar')], names = [...el.querySelectorAll('.name')];
    BEAT.custom((t) => {
      if (!FX.pop(el, t, at, until)) return;
      const lq = FX.clamp((t - leanAt) / leanDur), lean = lq * lq * (3 - 2 * lq);
      items.forEach((it, i) => {
        const grow = FX.clamp((t - at - stagger * i) / growDur), base = 380 * easeOut(grow);
        const w = it === heavy ? base + 280 * lean : base * (1 - 0.6 * lean);
        bars[i].style.width = w.toFixed(1) + 'px';
        const dim = it === heavy ? 1 : 1 - 0.45 * lean; bars[i].style.opacity = dim.toFixed(3); names[i].style.opacity = dim.toFixed(3);
      });
    });
    return el;
  }

  // ---- chapter card: full cream screen, icon tile + one serif word (e.g. "Clarity"). Covers the layout underneath,
  // so the next layout can start with trans 'slide' or 'cut' hidden behind it. Captions are off while it's up.
  const ICONS = {
    hourglass: '<path d="M7 3h10M7 21h10M8 3c0 5 8 6 8 9s-8 4-8 9M16 3c0 5-8 6-8 9s8 4 8 9" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round"/>',
    scale: '<path d="M12 4v16M6 20h12M4 8h16M7 8l-3 6h6zM17 8l-3 6h6z" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>',
    heart: '<path d="M12 20s-7-4.4-8.6-8.9C2.4 8 4.3 5 7.3 5c1.9 0 3.3 1 4.7 2.8C13.4 6 14.8 5 16.7 5c3 0 4.9 3 3.9 6.1C19 15.6 12 20 12 20z" fill="none" stroke="var(--accent)" stroke-width="1.8"/>',
    clock: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="var(--accent)" stroke-width="1.8"/><path d="M12 7v5l3.5 2" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round"/>',
  };
  const ccss = document.createElement('style');
  ccss.textContent = `
.edtch-bg { position: absolute; inset: 0; display: none; overflow: hidden; z-index: 55; }
.edtch-bg i { position: absolute; border-radius: 50%; background: rgba(255,255,255,.55); filter: blur(40px); }
.edtch { left: 200px; width: 680px; top: 640px; text-align: center; z-index: 56; }
.edtch .tile { width: 190px; height: 190px; margin: 0 auto; border-radius: 46px; background: #fff; display: grid; place-items: center;
  box-shadow: 0 0 0 1px rgba(0,0,0,.05), 0 26px 50px -24px rgba(0,0,0,.35); }
.edtch .tile svg { width: 110px; height: 110px; }
.edtch .word { margin-top: 56px; font: 600 150px/1 ${SERIF}; color: var(--ink); letter-spacing: -0.01em; }`;
  document.head.appendChild(ccss);
  function chapter({ word, icon = 'clock', at, until, cream = 'var(--paper)' }) {
    const bg = document.createElement('div'); bg.className = 'edtch-bg'; bg.style.background = cream;   // full-screen backdrop (not a UI box)
    bg.innerHTML = '<i style="left:-200px;top:300px;width:900px;height:500px"></i><i style="right:-260px;top:1100px;width:1000px;height:520px"></i>';
    stage.insertBefore(bg, CAP);
    const el = add('edtch', `<div class="tile"><svg viewBox="0 0 24 24">${ICONS[icon] || ICONS.clock}</svg></div><div class="word">${esc(word)}</div>`);
    el.dataset.role = 'behind';   // a full-screen cover: the head is hidden, so no headroom check
    const tile = el.querySelector('.tile'), w = el.querySelector('.word');
    suppress(at - 0.02, until + 0.05);
    BEAT.custom((t) => {
      const on = t >= at && t < until; bg.style.display = on ? 'block' : 'none'; el.style.display = on ? 'block' : 'none'; if (!on) return;
      const out = FX.clamp((t - (until - 0.22)) / 0.22);
      bg.style.opacity = (FX.clamp((t - at) / 0.14) * (1 - out)).toFixed(3);
      const k = FX.spring(t - at - 0.06), q = easeOut(FX.clamp((t - at - 0.2) / 0.4));
      tile.style.opacity = (FX.clamp((t - at - 0.06) / 0.12) * (1 - out)).toFixed(3);
      tile.style.transform = `scale(${(0.7 + 0.3 * k + 0.06 * out).toFixed(3)})`;
      w.style.opacity = (q * (1 - out)).toFixed(3);
      w.style.transform = `translateY(${((1 - q) * 30 - out * 20).toFixed(1)}px)`; w.style.filter = `blur(${((1 - q) * 8).toFixed(1)}px)`;
    });
    return el;
  }

  // =============================================================== toolkit pieces
  const k2 = document.createElement('style');
  k2.textContent = `
.edtwatch { width: 330px; height: 400px; border-radius: 92px; background: #121212; padding: 26px; box-shadow: 0 0 0 4px #2a2a2a, 0 30px 60px -24px rgba(0,0,0,.6); }
.edtwatch .scr { position: relative; width: 100%; height: 100%; border-radius: 66px; background: #000; display: grid; place-items: center; overflow: hidden; }
.edtwatch .ring { position: absolute; width: 230px; height: 230px; border-radius: 50%; }
.edtwatch .ring::after { content: ''; position: absolute; inset: 24px; border-radius: 50%; background: #000; }
.edtwatch .v { position: relative; color: #fff; font: 700 64px/1 var(--font-body), sans-serif; text-align: center; }
.edtwatch .v small { display: block; font: 600 22px var(--font-body), sans-serif; color: #9a9a9a; margin-top: 8px; letter-spacing: .02em; }
.edtdood { position: absolute; inset: 0; pointer-events: none; }
.edtdood text { font-family: "Bradley Hand", "Marker Felt", "Comic Sans MS", cursive; font-weight: 700; }
.edtpill { display: flex; align-items: center; gap: 12px; height: 74px; padding: 0 28px 0 12px; border-radius: 40px; background: #fff;
  box-shadow: 0 0 0 1px rgba(0,0,0,.05), 0 14px 30px -14px rgba(0,0,0,.5); font: 700 34px var(--font-body), sans-serif; color: var(--ink); white-space: nowrap; }
.edtpill i { width: 52px; height: 52px; border-radius: 50%; background: var(--paper); display: grid; place-items: center; font-style: normal; font-size: 30px; }
.edtck .row { position: absolute; left: 70px; width: 940px; height: 110px; display: flex; align-items: center; gap: 24px; padding: 0 30px; border-radius: 28px; background: #fff;
  box-shadow: 0 0 0 1px rgba(0,0,0,.06), 0 20px 46px -24px rgba(0,0,0,.35); font: 500 50px ${SERIF}; color: var(--ink); }
.edtck .box { flex: none; width: 58px; height: 58px; border-radius: 50%; border: 4px solid var(--accent); display: grid; place-items: center; }
.edtck .box svg { width: 34px; height: 34px; }
.edtck .row.hl { background: var(--accent-light); }
.edtcal { border-radius: 30px; background: #fff; overflow: hidden; box-shadow: 0 0 0 1px rgba(0,0,0,.06), 0 26px 56px -26px rgba(0,0,0,.45); font-family: var(--font-body), sans-serif; }
.edtcal .hd { display: flex; height: 70px; align-items: center; border-bottom: 2px solid #f0ece3; padding-left: 70px; }
.edtcal .hd span { flex: 1; text-align: center; font: 700 26px var(--font-body), sans-serif; color: #8b857a; }
.edtcal .hrs { position: absolute; left: 0; top: 70px; width: 70px; bottom: 0; }
.edtcal .hrs span { position: absolute; left: 12px; font: 500 18px var(--font-body), sans-serif; color: #b3ad a2; color: #b3ada2; }
.edtcal .ln { position: absolute; left: 70px; right: 0; height: 2px; background: #f4f1ea; }
.edtcal .blk { position: absolute; border-radius: 12px; padding: 8px 10px; font: 700 22px/1.1 var(--font-body), sans-serif; color: #3b3226; overflow: hidden; }
.edtgr .ttl { position: absolute; left: 0; width: 1080px; text-align: center; font: 600 74px/1.05 ${SERIF}; color: var(--ink); }
.edtgr .ax { position: absolute; font: 500 30px var(--font-body), sans-serif; color: #6d665a; }
.edtgr .pill { position: absolute; padding: 10px 28px; border-radius: 40px; background: var(--accent); color: #fff; font: 700 32px var(--font-body), sans-serif; white-space: nowrap; transform-origin: 50% 100%; }
.edtend .h { position: absolute; left: 0; width: 860px; text-align: center; font: 600 80px/1 ${SERIF}; color: var(--ink); }
.edtend .vc { position: absolute; left: 0; width: 860px; height: 190px; box-sizing: border-box; border-radius: 30px; background: #fff; display: flex; align-items: center; gap: 30px; padding: 22px;
  box-shadow: 0 0 0 1px rgba(0,0,0,.06), 0 26px 56px -26px rgba(0,0,0,.4); }
.edtend .vc .vth { flex: none; width: 146px; height: 146px; border-radius: 20px; overflow: hidden; background: #ddd; }
.edtend .vc .vth img { width: 100%; height: 100%; object-fit: cover; }
.edtend .vc .vtx { flex: 1; min-width: 0; }
.edtend .vc b { display: block; font: 600 46px/1.1 ${SERIF}; color: var(--ink); }
.edtend .vc small { display: block; margin-top: 10px; font: 500 28px var(--font-body), sans-serif; color: #8b857a; }
.edtbroll { position: absolute; inset: 0; display: none; overflow: hidden; z-index: 50; background: #000; }
.edtbroll img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; }
.edtbroll.card { inset: auto; border-radius: 30px; box-shadow: 0 0 0 5px var(--accent-light), 0 30px 70px -30px rgba(0,0,0,.5); }`;
  document.head.appendChild(k2);
  const CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ---- T8 device: a watch face over the footage; the ring + number drain to pct on drainAt, the label swaps on swapAt
  function watch({ at, until, left = 600, top = 220, from = 64, pct = 10, drainAt = at + 0.3, swapAt = null, label = 'Battery', swap = 'Life energy' }) {
    const el = add('edtwatch', `<div class="scr"><div class="ring"></div><div class="v"><span class="n"></span><small class="l"></small></div></div>`);
    Object.assign(el.style, { left: left + 'px', top: top + 'px' });
    const ring = el.querySelector('.ring'), n = el.querySelector('.n'), l = el.querySelector('.l');
    BEAT.custom((t) => {
      if (!FX.pop(el, t, at, until)) return;
      const v = Math.round(from + (pct - from) * easeOut(FX.clamp((t - drainAt) / 0.9)));
      const col = v <= 20 ? '#ff453a' : '#30d158';
      ring.style.background = `conic-gradient(${col} ${v * 3.6}deg, #262626 0)`; n.textContent = v + '%';
      l.textContent = swapAt != null && t >= swapAt ? swap : label; l.style.color = swapAt != null && t >= swapAt ? 'var(--accent-light)' : '#9a9a9a';
    });
    return el;
  }

  // ---- T7 hand-drawn marks that draw on: shapes [{ type: 'circle'|'arrow'|'underline'|'text', at, ... }]
  //   circle: { x, y, w, h }   arrow: { from: [x, y], to: [x, y] }   underline: { x, y, w }   text: { x, y, text, size }
  //   write: true writes text on left to right like chalk (else it fades in). Any shape takes dur (seconds to draw).
  //   Returns the layer; el.strokes = [{ at, dur, type }] for lining up a drawing sound (scripts/chalk.py).
  let DOOD = 0;
  function doodle({ shapes, until, color = 'var(--accent-dark)', width = 7, write = false }) {
    const at0 = Math.min(...shapes.map((s) => s.at)), id = 'dood' + DOOD++;
    const durOf = (s) => s.dur || (s.type !== 'text' ? 0.45 : write ? Math.max(0.3, Math.min(0.9, 0.075 * s.text.length)) : 0.3);
    const wob = (i) => Math.sin(i * 12.9898) * 6;
    const svg = shapes.map((s, i) => {
      if (s.type === 'circle') { const { x, y, w, h } = s, cx = x + w / 2, cy = y + h / 2, rx = w / 2 + 18, ry = h / 2 + 18;
        const pts = Array.from({ length: 30 }, (_, k) => { const a = -2.2 + (k / 29) * 6.9; return [cx + rx * Math.cos(a) + wob(k + i), cy + ry * Math.sin(a) + wob(k * 3 + i)]; });
        return `<path data-i="${i}" d="M${pts.map((p) => p.map((q) => q.toFixed(1)).join(' ')).join(' L')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`; }
      if (s.type === 'arrow') { const [x1, y1] = s.from, [x2, y2] = s.to, mx = (x1 + x2) / 2 + (y2 - y1) * 0.25, my = (y1 + y2) / 2 - (x2 - x1) * 0.25;
        const ang = Math.atan2(y2 - my, x2 - mx), hl = 34, a1 = ang + 2.6, a2 = ang - 2.6;
        return `<path data-i="${i}" d="M${x1} ${y1} Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2} ${y2} M${x2} ${y2} L${(x2 + hl * Math.cos(a1)).toFixed(1)} ${(y2 + hl * Math.sin(a1)).toFixed(1)} M${x2} ${y2} L${(x2 + hl * Math.cos(a2)).toFixed(1)} ${(y2 + hl * Math.sin(a2)).toFixed(1)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`; }
      if (s.type === 'underline') return `<path data-i="${i}" d="M${s.x} ${s.y} q${s.w * 0.3} ${-10} ${s.w * 0.55} 2 t${s.w * 0.45} -4" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
      const sz = s.size || 64;
      if (write) return `<clipPath id="${id}c${i}"><rect x="${s.x - 14}" y="${(s.y - sz * 1.1).toFixed(1)}" width="0" height="${(sz * 1.6).toFixed(1)}"/></clipPath>` +
        `<text data-i="${i}" x="${s.x}" y="${s.y}" font-size="${sz}" fill="${color}" clip-path="url(#${id}c${i})">${esc(s.text)}</text>`;
      return `<text data-i="${i}" x="${s.x}" y="${s.y}" font-size="${sz}" fill="${color}">${esc(s.text)}</text>`;
    }).join('');
    // the layer is only as big as the marks (so the safe-area audit measures the marks, not the whole screen)
    const bx = []; shapes.forEach((s) => {
      if (s.type === 'circle') bx.push([s.x - 30, s.y - 30, s.x + s.w + 30, s.y + s.h + 30]);
      else if (s.type === 'arrow') bx.push([Math.min(s.from[0], s.to[0]) - 50, Math.min(s.from[1], s.to[1]) - 50, Math.max(s.from[0], s.to[0]) + 50, Math.max(s.from[1], s.to[1]) + 50]);
      else if (s.type === 'underline') bx.push([s.x - 10, s.y - 20, s.x + s.w + 10, s.y + 20]);
      else bx.push([s.x - 10, s.y - (s.size || 64), s.x + (s.size || 64) * 0.55 * s.text.length, s.y + 20]); });
    const L0 = Math.max(0, Math.min(...bx.map((b) => b[0]))), T0 = Math.max(0, Math.min(...bx.map((b) => b[1]))),
      R0 = Math.min(1080, Math.max(...bx.map((b) => b[2]))), B0 = Math.min(1920, Math.max(...bx.map((b) => b[3])));
    const el = add('edtdood', `<svg viewBox="${L0} ${T0} ${R0 - L0} ${B0 - T0}" width="${R0 - L0}" height="${B0 - T0}" style="overflow:visible">${svg}</svg>`);
    Object.assign(el.style, { left: L0 + 'px', top: T0 + 'px', width: (R0 - L0) + 'px', height: (B0 - T0) + 'px' }); el.dataset.role = 'behind';   // marks may cross the head on purpose
    const parts = [...el.querySelectorAll('[data-i]')];
    parts.forEach((p) => { if (p.tagName === 'path') { const L = p.getTotalLength ? p.getTotalLength() : 1000; p.dataset.len = L; p.style.strokeDasharray = L; } });
    BEAT.custom((t) => {
      const on = t >= at0 && t < until; el.style.display = on ? 'block' : 'none'; if (!on) return;
      const out = FX.clamp((t - (until - 0.25)) / 0.25);
      parts.forEach((p) => { const i = +p.dataset.i, s = shapes[i], r = FX.clamp((t - s.at) / durOf(s)), q = easeOut(r);
        if (p.tagName === 'path') p.style.strokeDashoffset = (p.dataset.len * (1 - q)).toFixed(1);
        if (p.tagName === 'text' && write) {          // chalk pace: steady, a touch slower at the ends
          const rect = el.querySelector(`#${id}c${i} rect`), w = (p._w = p._w || p.getComputedTextLength() + 28);
          rect.setAttribute('width', (w * r * r * (3 - 2 * r)).toFixed(1));
        }
        p.style.opacity = ((p.tagName === 'path' || write ? (r > 0 ? 1 : 0) : q) * (1 - out)).toFixed(3); });
    });
    el.strokes = shapes.map((s) => ({ at: s.at, dur: durOf(s), type: s.type }));
    el.dataset.sfx = 'none';
    el.strokes.forEach((s) => FX.cue('scribble', s.at, { dur: s.dur, src: 'EDT.doodle ' + s.type }));
    return el;
  }

  // ---- T6 label pills that pop next to the head: items [{ text, icon, at, x, y }]
  function pills({ items, until }) {
    return items.map((it) => {
      const el = add('edtpill', `<i>${it.icon || '•'}</i>${esc(it.text)}`);
      Object.assign(el.style, { left: it.x + 'px', top: it.y + 'px' });
      BEAT.custom((t) => FX.pop(el, t, it.at, until, { disp: 'flex', origin: '50% 50%' }));
      return el;
    });
  }

  // ---- T2 checklist: rows appear (or start listed) and tick in gold on their words; `highlight` row turns gold
  function checklist({ title = '', items, at, until, top = 215, gap = 128, highlight = -1 }) {
    const el = add('edtp edtck', `${title ? `<div class="ttl" style="top:0">${esc(title)}</div>` : ''}${items.map((it, i) =>
      `<div class="row" style="top:${(title ? 120 : 0) + i * gap}px"><div class="box">${CHECK}</div>${esc(it.text)}</div>`).join('')}`);
    Object.assign(el.style, { top: top + 'px', left: '0', width: '1080px', height: ((title ? 120 : 0) + items.length * gap) + 'px' });
    const rows = [...el.querySelectorAll('.row')];
    BEAT.custom((t) => {
      if (!FX.pop(el, t, at, until)) return;
      rows.forEach((r, i) => { const it = items[i], show = it.show ?? at;
        r.style.display = t >= show ? 'flex' : 'none'; const k = FX.spring(t - show); r.style.transform = `translateY(${((1 - k) * 22).toFixed(1)}px)`;
        const tk = FX.clamp((t - it.tick) / 0.2), box = r.firstChild;
        box.style.background = tk > 0 ? `rgba(183,144,75,${tk.toFixed(2)})` : 'transparent'; box.firstChild.style.opacity = tk.toFixed(2);
        box.style.transform = `scale(${(1 + 0.25 * Math.sin(Math.PI * tk)).toFixed(3)})`;
        r.classList.toggle('hl', i === highlight && t >= it.tick + 0.15); });
    });
    el.dataset.sfx = 'none';
    FX.cue('pop', at, { src: 'EDT.checklist' });
    items.forEach((it) => { if (it.tick != null) FX.cue('click', it.tick, { src: 'EDT.checklist tick' }); });
    return el;
  }

  // ---- T3 week calendar: blocks [{ day 0-6, start (row 0..rows), len, label, color, at }] drop into the grid
  function calendar({ blocks, at, until, top = 205, left = 90, width = 900, height = 560, rows = 6, scale = 1, hours = ['6a', '9a', '12p', '3p', '6p', '9p'] }) {
    const colW = (width - 70) / 7, rowH = (height - 70) / rows;
    const el = add('edtcal', `<div class="hd">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="hrs">${hours.map((h, i) => `<span style="top:${(i * rowH + 4).toFixed(0)}px">${h}</span>`).join('')}</div>
      ${Array.from({ length: rows }, (_, i) => `<div class="ln" style="top:${(70 + i * rowH).toFixed(0)}px"></div>`).join('')}
      ${blocks.map((b) => `<div class="blk" style="left:${(70 + b.day * colW + 5).toFixed(0)}px;top:${(70 + b.start * rowH + 4).toFixed(0)}px;width:${(colW - 10).toFixed(0)}px;height:${(b.len * rowH - 8).toFixed(0)}px;background:${b.color || 'var(--accent-light)'}">${esc(b.label)}</div>`).join('')}`);
    Object.assign(el.style, { left: left + 'px', top: top + 'px', width: width + 'px', height: height + 'px' });
    const bl = [...el.querySelectorAll('.blk')];
    BEAT.custom((t) => {
      if (!FX.pop(el, t, at, until, { base: `scale(${scale})` })) return;
      bl.forEach((d, i) => { const k = FX.spring(t - blocks[i].at); d.style.display = t >= blocks[i].at ? 'block' : 'none';
        d.style.opacity = FX.clamp((t - blocks[i].at) / 0.1).toFixed(3); d.style.transform = `translateY(${((1 - k) * -40).toFixed(1)}px)`; });
    });
    return el;
  }

  // ---- T1 line graph: axes, a curve that draws from drawAt to drawEnd, a pill that lands on the line at pillAt
  //   points: [[x, y], ...] in 0..1 (x right, y up); pill: { text, x } (x in 0..1 along the curve)
  function graph({ title = '', points, pill, at, until, drawAt = at + 0.2, drawEnd = drawAt + 1.2, pillAt = drawEnd, xLabels = ['', ''], yLabel = '', top = 215, height = 600 }) {
    const W = 860, H = height - 200, X0 = 110, Y0 = (title ? 130 : 30);
    const P = points.map(([x, y]) => [X0 + x * W, Y0 + (1 - y) * H]);
    const d = P.reduce((s, p, i) => { if (!i) return `M${p[0]} ${p[1]}`; const q = P[i - 1], cx = (q[0] + p[0]) / 2; return s + ` C${cx} ${q[1]} ${cx} ${p[1]} ${p[0]} ${p[1]}`; }, '');
    const el = add('edtgr', `${title ? `<div class="ttl" style="top:0">${esc(title)}</div>` : ''}
      <svg width="1080" height="${height}" style="position:absolute;left:0;top:0"><path d="M${X0} ${Y0} V${Y0 + H} H${X0 + W}" fill="none" stroke="var(--ink)" stroke-width="4"/>
      <path class="cv" d="${d}" fill="none" stroke="var(--ink)" stroke-width="7" stroke-linecap="round"/><circle class="dot" r="11" fill="var(--accent)"/></svg>
      <div class="ax" style="left:${X0 - 10}px;top:${Y0 + H + 14}px">${esc(xLabels[0])}</div><div class="ax" style="left:${X0 + W - 60}px;top:${Y0 + H + 14}px">${esc(xLabels[1])}</div>
      ${yLabel ? `<div class="ax" style="left:${X0 + 14}px;top:${Y0 - 6}px">${esc(yLabel)}</div>` : ''}
      ${pill ? `<div class="pill">${esc(pill.text)}</div>` : ''}`);
    Object.assign(el.style, { left: '0', top: top + 'px', width: '1080px', height: height + 'px' });
    const cv = el.querySelector('.cv'), dot = el.querySelector('.dot'), pl = el.querySelector('.pill');
    let L = 0;
    BEAT.custom((t) => {
      if (!FX.pop(el, t, at, until)) return;
      if (!L) { L = cv.getTotalLength(); cv.style.strokeDasharray = L; }
      const q = easeOut(FX.clamp((t - drawAt) / Math.max(0.3, drawEnd - drawAt)));   // guard: W('word') can match an earlier take cv.style.strokeDashoffset = (L * (1 - q)).toFixed(1);
      const pt = cv.getPointAtLength(L * q); dot.setAttribute('cx', pt.x.toFixed(1)); dot.setAttribute('cy', pt.y.toFixed(1)); dot.style.opacity = q > 0 ? 1 : 0;
      if (pl) { const pp = cv.getPointAtLength(L * pill.x), k = FX.spring(t - pillAt);
        pl.style.display = t >= pillAt ? 'block' : 'none'; pl.style.left = (pp.x - pl.offsetWidth / 2).toFixed(1) + 'px'; pl.style.top = (pp.y - 86).toFixed(1) + 'px';
        pl.style.transform = `scale(${(0.6 + 0.4 * k).toFixed(3)})`; }
    });
    return el;
  }

  // ---- T4 end card: full cream cover with "watch next" cards of the creator's own reels (thumbs: images in page/assets)
  function endcard({ title = 'Watch next', videos, at, until, cream = 'var(--paper)' }) {
    const bg = document.createElement('div'); bg.className = 'edtch-bg'; bg.style.background = cream; stage.insertBefore(bg, CAP);
    const el = add('edtend', `<div class="h" style="top:0">${esc(title)}</div>${videos.map((v, i) =>
      `<div class="vc" style="top:${140 + i * 230}px"><div class="vth">${v.thumb ? `<img src="${v.thumb}">` : ''}</div><div class="vtx"><b>${esc(v.title)}</b><small>${esc(v.sub || '@yourhandle')}</small></div></div>`).join('')}`);
    Object.assign(el.style, { left: '110px', top: '330px', width: '860px', height: (140 + videos.length * 230) + 'px', zIndex: 56 });   // clear of the button column
    el.dataset.role = 'behind';
    const cards = [...el.querySelectorAll('.vc')];
    suppress(at - 0.02, until + 1);
    BEAT.custom((t) => {
      const on = t >= at && t < until; bg.style.display = on ? 'block' : 'none'; bg.style.opacity = FX.clamp((t - at) / 0.2).toFixed(3);
      if (!FX.pop(el, t, at + 0.1, until)) return;
      cards.forEach((c, i) => { const t0 = at + 0.3 + 0.18 * i, k = FX.spring(t - t0); c.style.opacity = FX.clamp((t - t0) / 0.12).toFixed(3);
        c.style.transform = `translateY(${((1 - k) * 30).toFixed(1)}px)`; });
    });
    return el;
  }

  // ---- T9 B-roll insert: the creator's own clip as image frames (assets/<name>/001.jpg..), full screen or in a card.
  //   Make frames: ffmpeg -i clip.mp4 -vf "fps=30,scale=1080:-2" -q:v 3 page/assets/<name>/%03d.jpg
  function broll({ frames, count, at, until, mode = 'full', box = { left: 120, top: 260, width: 840, height: 560 }, kenburns = 0.04 }) {
    const el = document.createElement('div'); el.className = 'edtbroll' + (mode === 'card' ? ' card' : ''); el.innerHTML = '<img alt="">';
    if (mode === 'card') Object.assign(el.style, { left: box.left + 'px', top: box.top + 'px', width: box.width + 'px', height: box.height + 'px' });
    stage.insertBefore(el, CAP);
    const img = el.firstChild;
    BEAT.custom((t) => {
      const on = t >= at && t < until; el.style.display = on ? 'block' : 'none'; if (!on) return;
      el.style.opacity = (FX.clamp((t - at) / 0.12) * FX.clamp((until - t) / 0.12)).toFixed(3);
      FX.setSrc(img, `${frames}${String(Math.max(1, Math.min(count, Math.floor((t - at) * STYLE.fps) + 1))).padStart(3, '0')}.jpg`);
      img.style.transform = `scale(${(1 + kenburns * FX.clamp((t - at) / Math.max(1, until - at))).toFixed(4)})`;
    });
    return el;
  }

  window.EDT = { setup, words, battery, points, balance, chapter, watch, doodle, pills, checklist, calendar, graph, endcard, broll, SERIF };
})();
