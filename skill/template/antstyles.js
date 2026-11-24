// antstyles.js: two ready-made combinations of the building blocks (MIN.* minimal, VIS.* visual), plus the pieces
// they add (proof cards, follow card, the smooth push into a split).
// Both run on KAL.layout and reuse ANT.* / KAL.* / EDT.* / SIG.* pieces; this file adds what they were missing.
//
//   MIN.setup({ segments, keywords, framing })    'small' word captions under the chin (keywords + numbers in gold),
//                                                 close/wide framing on every cut (KAL.framing, needs scripts/cuts.py)
//   MIN.hook({ lines: ['3 months', '*0 users*'], sub, at, until })   pain-number headline above the head (*accent*)
//   MIN.word({ text, at, until })              the one big word behind the head, caption hidden while it's up
//   MIN.proof({ frames, count, crop, place: 'above'|'below', at, until, label })   a real screen, cropped to the part
//                                                 that matters, in a card above (or below) the head: never over the face
//   MIN.follow({ at, until, note })               small follow pill at the end; "Follow" taps to "Following"
//   VIS.setup({ segments, keywords, framing })    'bold' one-word captions (every layout), close/wide framing
//   VIS.screen({ frames, count, at, until, top, height })   a real screen recording in a clean phone, for a cream/dark split
(() => {
  const SANS = 'var(--font-head), var(--font-body), sans-serif';
  const css = document.createElement('style');
  css.textContent = `
body.noserif .edtw, body.noserif .edtb .pct, body.noserif .edtb .what, body.noserif .edtp .ttl, body.noserif .edtl .ttl, body.noserif .edtch .word,
body.noserif .edtgr .ttl, body.noserif .edtend .h, body.noserif .khead .serif, body.noserif .impact.serif, body.noserif .hook .acc {
  font-family: ${SANS} !important; font-style: normal !important; font-weight: 800 !important; letter-spacing: -0.03em !important; }
body.noserif .edtp .tx, body.noserif .edtl .name, body.noserif .edtck .row, body.noserif .edtend .vc b {
  font-family: ${SANS} !important; font-style: normal !important; font-weight: 700 !important; letter-spacing: -0.02em !important; }
#kcap.small { font-size: calc(var(--cap-size) * 0.9); }
.minhook { left: 0; width: 1080px; text-align: center; font-family: ${SANS}; color: #fff; letter-spacing: -0.03em; }
.minhook .ln { display: block; font-weight: 800; line-height: 1.02; text-shadow: 0 3px 18px rgba(0,0,0,.45), 0 0 3px rgba(0,0,0,.35); }
.minhook .ln .acc { color: var(--acc); }
.minhook .sub { display: inline-block; margin-top: 18px; padding: 8px 20px; border-radius: 30px; background: color-mix(in srgb, var(--ink) 62%, transparent); font: 700 32px/1.2 ${SANS};
  letter-spacing: -0.01em; color: #fff; text-shadow: none; }
.minproof { border-radius: 30px; overflow: hidden; background: #111; box-shadow: 0 0 0 4px rgba(255,255,255,.9), 0 30px 70px -24px rgba(0,0,0,.6); }
.minproof img { position: absolute; left: 0; top: 0; transform-origin: 0 0; max-width: none; }
.minproof .lab { position: absolute; left: 18px; top: 16px; padding: 6px 16px; border-radius: 20px; background: color-mix(in srgb, var(--ink) 78%, transparent); color: #fff; font: 700 26px ${SANS}; }
.minfollow { border-radius: 60px; background: #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.06), 0 24px 60px -24px rgba(0,0,0,.55); font-family: ${SANS}; color: var(--ink); }
.minfollow .row { display: flex; align-items: center; gap: 22px; padding: 16px 18px 16px 16px; }
.minfollow .av { flex: none; width: 92px; height: 92px; border-radius: 50%; background: #ddd center/cover; box-shadow: 0 0 0 3px var(--accent-light); }
.minfollow .tx { flex: 1; min-width: 0; } .minfollow b { display: block; font-size: 36px; font-weight: 800; letter-spacing: -0.02em; }
.minfollow small { display: block; font-size: 26px; color: #7a7366; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.minfollow .btn { flex: none; padding: 18px 34px; border-radius: 40px; background: var(--accent); color: #fff; font-size: 32px; font-weight: 800; }
.minfollow .btn.done { background: var(--canvas); color: var(--ink); }
.visscreen { border-radius: 54px; background: #0d0d0d; padding: 14px; box-shadow: 0 30px 80px -30px rgba(0,0,0,.6); }
.visscreen .scr { position: relative; width: 100%; height: 100%; border-radius: 42px; overflow: hidden; background: #222; }
.visscreen img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
.visscreen .isl { position: absolute; left: 50%; top: 14px; width: 110px; height: 32px; margin-left: -55px; border-radius: 20px; background: #000; z-index: 2; }`;
  document.head.appendChild(css);
  const stage = document.getElementById('stage'), CAP = document.getElementById('cap');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const add = (cls, html = '') => { const el = document.createElement('div'); el.className = 'ui ' + cls; el.innerHTML = html; stage.insertBefore(el, CAP); return el; };
  const suppress = (a, b) => { (window.CAP_SUPPRESS = window.CAP_SUPPRESS || []).push([a, b]); };
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const headAt = (t) => { const H = window.HEADS; if (!H) return { top: 720, left: 380, right: 700 }; const k = Math.round(t / H.step);
    return { top: H.top[k] ?? 720, left: H.left[k] ?? 380, right: H.right[k] ?? 700 }; };
  const headTopIn = (a, b) => { const H = window.HEADS; if (!H) return 720; let m = 1e9;
    for (let k = Math.floor(a / H.step); k <= Math.ceil(b / H.step); k++) if (H.top[k] != null) m = Math.min(m, H.top[k]); return m === 1e9 ? 720 : m; };

  // keywords (+ any word with a digit) turn gold in the captions
  function keys(list) {
    const K = new Set(list.flatMap((k) => k.split(/\s+/)).map(norm).filter(Boolean));
    window.CAP_KEY = (w) => /\d/.test(w) || K.has(norm(w));
  }
  // the caption line under the chin, per shot (between cuts) so it only moves on a cut: 80th percentile of the chin
  // estimate (head top + 1.35 x head width) across the shot, plus a gap; kept between y 1180 and 1440
  function chinLine(a, b) {
    const H = window.HEADS; if (!H) return 1330;
    const ys = [];
    for (let k = Math.floor(a / H.step); k <= Math.ceil(b / H.step); k++)
      if (H.top[k] != null && H.left[k] != null) ys.push(H.top[k] + 1.35 * (H.right[k] - H.left[k]));
    if (!ys.length) return 1330; ys.sort((x, y) => x - y);
    return Math.max(1180, Math.min(1440, Math.round(ys[Math.floor(ys.length * 0.8)] + 60)));
  }
  const MOVES = [];          // caption spot overrides while a card sits below the head: [a, b, y]

  // the smooth push (Ant, 2026-11-02): a split's panel slides down from the top and pushes his head down over `dur` s,
  // starting `lead` s before the cue word; going back, his head rises and the panel slides up. Graphics in the split come in
  // once the push settles and leave before the head rises: MIN.inside(cue, nextCue) gives that [at, until].
  const PUSH = { in: { trans: 'morph', dur: 0.7, lead: 0.45, drop: true }, out: { trans: 'morph', dur: 0.7, lead: 0.3 } };
  const MIN = {
    PUSH,
    inside(cue, nextCue, { pin = PUSH.in, pout = PUSH.out } = {}) { return [cue - pin.lead + pin.dur + 0.05, nextCue - pout.lead - 0.05]; },
    setup({ segments = [[0, 'full']], keywords = [], framing = {}, news = {} } = {}) {
      document.body.classList.add('antmin', 'noserif');
      segments = segments.map(([t, m, o = {}]) => [t, m, { ...(m === 'full' ? MIN.PUSH.out : MIN.PUSH.in), ...o }]);   // Minimalist: the smooth push
      KAL.layout({ segments, news: { top: 'dark', capY: 1488, ...news }, capMode: 'small', capMove: 'fade' });   // 60 px words stay above y 1536
      keys(keywords);
      const edges = [0, ...(window.CUTS || []), END + 1], shots = edges.slice(1).map((b, i) => [edges[i], b, chinLine(edges[i], b)]);
      window.__capSmallY = (t) => { for (const [a, b, y] of MOVES) if (t >= a && t < b) return y;
        for (const [a, b, y] of shots) if (t >= a && t < b) return y; return 1330; };
      if (framing !== false) KAL.framing({ ...framing });
    },
    hook({ lines, sub = '', at = 0.05, until, top = 250, size = 112, accent = 'var(--key)', quiet = true, gap = 0.12 }) {
      const el = add('minhook', lines.map((l) => `<span class="ln" style="font-size:${size}px">${esc(l).replace(/\*(.+?)\*/g, '<span class="acc">$1</span>')}</span>`).join('')
        + (sub ? `<span class="sub">${esc(sub)}</span>` : ''));
      el.style.top = top + 'px'; el.style.setProperty('--acc', accent);
      const parts = [...el.querySelectorAll('.ln, .sub')];
      if (quiet) suppress(at, until);              // the headline says it: no duplicate caption under it
      BEAT.custom((t) => {
        if (!FX.pop(el, t, at, until)) return;
        parts.forEach((p, i) => { const t0 = at + gap * i, k = FX.spring(t - t0);
          p.style.opacity = FX.clamp((t - t0) / 0.1).toFixed(3); p.style.transform = `translateY(${((1 - k) * 24).toFixed(1)}px) scale(${(0.92 + 0.08 * k).toFixed(3)})`; });
      });
      return el;
    },
    // the one big word behind the head (ANT.impact) with its caption hidden: never the same word twice on screen
    word({ text, at, until, size = 170, halo = true, color }) {
      suppress(at - 0.3, until);
      return ANT.impact({ text, at, until, size, halo, ...(color ? { color } : {}) });
    },
    // frames: 'assets/<clip>/' with 001.jpg.. (ffmpeg -i rec.mp4 -vf fps=30,scale=1080:-2 assets/<clip>/%03d.jpg), or src: one image.
    // crop: { x, y, w, h } in frame pixels, the part to show; cropTo: a second crop to pan to over the hold (scrolling).
    proof({ frames, count = 0, src, frameW = 1080, crop, cropTo = null, place = 'above', at, until, label = '', width = null, height = null, left = 40, radius = 30 }) {
      if (width == null) width = place === 'below' ? 850 : 940;        // below y 960 the right column (x > 900) is the buttons' zone
      const h0 = height || (place === 'above' ? Math.max(300, Math.min(560, headTopIn(at, until) - 240)) : 420);
      const top = place === 'above' ? 210 : 1536 - 24 - h0;
      const el = add('minproof', `<img alt="">${label ? `<div class="lab">${esc(label)}</div>` : ''}`);
      Object.assign(el.style, { left: (place === 'below' ? left : (1080 - width) / 2) + 'px', top: top + 'px', width: width + 'px', height: h0 + 'px', borderRadius: radius + 'px' });
      if (place === 'below') { MOVES.push([at, until, top - 62]); el.dataset.role = 'below'; }
      const img = el.querySelector('img'), c0 = crop || { x: 0, y: 0, w: frameW, h: frameW * h0 / width };
      BEAT.custom((t) => {
        if (!FX.pop(el, t, at, until)) return;
        if (frames) FX.setSrc(img, `${frames}${String(Math.max(1, Math.min(count, Math.floor((t - at) * STYLE.fps) + 1))).padStart(3, '0')}.jpg`);
        else if (src) FX.setSrc(img, src);
        const q = cropTo ? FX.clamp((t - at - 0.4) / Math.max(0.5, until - at - 0.9)) : 0, e = q * q * (3 - 2 * q);
        const c = cropTo ? { x: c0.x + (cropTo.x - c0.x) * e, y: c0.y + (cropTo.y - c0.y) * e, w: c0.w + (cropTo.w - c0.w) * e } : c0;
        const s = width / c.w;                    // crop width fills the card
        img.style.width = frameW + 'px'; img.style.transform = `translate(${(-c.x * s).toFixed(1)}px, ${(-c.y * s).toFixed(1)}px) scale(${s.toFixed(4)})`;
      });
      return el;
    },
    follow({ at, until = END + 1, name = 'Your Name', handle = '@yourhandle', note = '', avatar = '', top = 230, width = 760, tapAt = null }) {
      const el = add('minfollow', `<div class="row"><div class="av" style="background-image:url('${avatar}')"></div><div class="tx"><b>${esc(name)}</b><small>${esc(note || handle)}</small></div><div class="btn">Follow</div></div>`);
      Object.assign(el.style, { left: ((1080 - width) / 2) + 'px', top: top + 'px', width: width + 'px' });
      const btn = el.querySelector('.btn'), tap = tapAt == null ? at + 1.1 : tapAt;
      FX.cue('tap', tap, { src: 'MIN.follow tap' });   // the card itself pops (automatic)
      BEAT.custom((t) => {
        if (!FX.pop(el, t, at, until)) return;
        const done = t >= tap; btn.textContent = done ? 'Following' : 'Follow'; btn.classList.toggle('done', done);
        const k = t >= tap - 0.12 && t < tap + 0.1 ? 0.92 : 1; btn.style.transform = `scale(${k})`;
      });
      return el;
    },
  };

  const VIS = {
    setup({ segments = [[0, 'full']], keywords = [], framing = {}, news = {}, pip = {}, box = {}, cream } = {}) {
      document.body.classList.add('antvis', 'noserif');
      KAL.layout({ segments, news: { top: 'dark', ...news }, pip, box, capMode: 'bold', cream });
      keys(keywords);
      if (framing !== false) KAL.framing({ ...framing });
    },
    // a real screen recording in a clean phone (no fake app chrome), for the top half of a split or the canvas
    screen({ frames, count = 0, src, at, until, top = 215, height = 690, left = null, drift = 0.03 }) {
      const w = Math.round((height - 28) * 9 / 19.5) + 28;
      const el = add('visscreen', '<div class="scr"><div class="isl"></div><img alt=""></div>');
      Object.assign(el.style, { top: top + 'px', left: (left == null ? (1080 - w) / 2 : left) + 'px', width: w + 'px', height: height + 'px' });
      const img = el.querySelector('img');
      BEAT.custom((t) => {
        if (!FX.pop(el, t, at, until)) return;
        if (frames) FX.setSrc(img, `${frames}${String(Math.max(1, Math.min(count, Math.floor((t - at) * STYLE.fps) + 1))).padStart(3, '0')}.jpg`);
        else if (src) FX.setSrc(img, src);
        img.style.transform = `scale(${(1 + drift * FX.clamp((t - at) / Math.max(1, until - at))).toFixed(4)})`;
      });
      return el;
    },
  };
  window.MIN = MIN; window.VIS = VIS;
})();
