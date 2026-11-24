// components.js: reusable reel components (ANT.*, built on the BEAT runtime). Loaded before beats.js.
// Documented in the comments below.
//
//   ANT.hook({ lines: ["You can't fit an entire", "*person* into a bio."], until })   kinetic headline, word by word
//   ANT.impact({ text, at, until, size, top:'auto', serif, color:'auto', quiet })   big word behind the head (cutout.py --auto
//     cuts the speaker out and picks white/dark for color 'auto'; heads.py for top:'auto'; quiet hides the captions meanwhile)
//   ANT.profile({ ...creator, at, until, bio|stats|follow })    Instagram-style profile card (typing bio / counter / Follow tap)
//   ANT.timeline({ title, labels, at, until, fillAt, fillEnd }) gold progress timeline with thumbnails + a % metric
//   ANT.chips({ items: [[text, at], ...], until })             stacked label chips with a gold edge
(() => {
  const SERIF = 'var(--font-serif)';
  const css = document.createElement('style');
  css.textContent = `
.impact { left: 0; width: 1080px; text-align: center; white-space: nowrap; font-family: var(--font-hook), sans-serif; font-weight: 800;
  letter-spacing: -0.05em; line-height: 1; color: var(--ink); }
.impact.ondark { text-shadow: 0 4px 26px rgba(0,0,0,.35), 0 0 4px rgba(0,0,0,.2); }   /* white word over a dark background */
.impact.halo { text-shadow: 0 0 22px rgba(247,246,243,.9), 0 0 8px rgba(247,246,243,.8); }   /* readable over busy/dark backgrounds */
.impact.serif { font-family: ${SERIF}; font-style: italic; font-weight: 600; letter-spacing: -0.02em; }
.impact span { display: inline-block; white-space: pre; }
#fg { position: absolute; inset: 0; width: 1080px; height: 1920px; display: none; }
.hook { left: 0; width: 1080px; text-align: center; white-space: nowrap; font-family: var(--font-hook), sans-serif; font-weight: 800;
  font-size: 70px; letter-spacing: -0.04em; line-height: 1; color: var(--ink); }
.hook span { display: inline-block; margin: 0 9px; }
.hook .acc { font-family: ${SERIF}; font-style: italic; font-weight: 600; letter-spacing: 0; color: #fff; background: var(--accent);
  padding: 6px 22px 12px; border-radius: 10px; font-size: 80px; }
.prof .av { position: absolute; border-radius: 50%; padding: 5px; background: conic-gradient(from 200deg, #feda75, #fa7e1e, #d62976, #962fbf, #4f5bd5, #feda75); }
.prof .av i { display: grid; place-items: center; width: 100%; height: 100%; border-radius: 50%; border: 5px solid #18181b;
  background: linear-gradient(140deg, #d9a273, #9c5f3a); font-style: normal; font-weight: 700; color: #fff; overflow: hidden; }
.prof .av i img { width: 100%; height: 100%; object-fit: cover; }
.prof .nm { position: absolute; font-size: 34px; font-weight: 700; }
.prof .hd2 { position: absolute; font-size: 27px; color: rgba(255,255,255,.62); }
.prof .bio { position: absolute; font-size: 30px; line-height: 1.38; white-space: pre-line; color: rgba(255,255,255,.94); }
.prof .caret { display: inline-block; width: 3px; height: 30px; background: #fff; margin-left: 2px; vertical-align: -4px; }
.th { position: absolute; border-radius: 14px; overflow: hidden; background: linear-gradient(160deg, #e2b688 0%, #a8673f 55%, #4a2b1c 100%); }
.th img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.th svg { position: absolute; left: 50%; top: 50%; width: 46px; height: 46px; margin: -23px 0 0 -20px; }
.th b { position: absolute; left: 12px; bottom: 10px; font-size: 22px; font-weight: 600; }
.prof .stats { position: absolute; display: flex; gap: 0; }
.prof .stats div { width: 210px; text-align: center; }
.prof .stats b { display: block; font-size: 40px; font-weight: 700; font-variant-numeric: tabular-nums; }
.prof .stats span { font-size: 25px; color: rgba(255,255,255,.62); }
.prof .btn { position: absolute; height: 62px; border-radius: 14px; display: grid; place-items: center; font-size: 28px; font-weight: 600; }
.prof .fb { background: #0095F6; color: #fff; } .prof .fb.on { background: #363639; }
.prof.light .fb.on { background: #efefef; color: var(--ink); }
.prof .fol.land { color: var(--accent-light); } .prof.light .fol.land { color: var(--accent); }
.prof .ring { position: absolute; width: 84px; height: 84px; border-radius: 50%; background: rgba(255,255,255,.32); border: 3px solid rgba(255,255,255,.85); display: none; }
.tl .rail { position: absolute; left: 80px; width: 800px; top: 236px; height: 6px; border-radius: 3px; background: rgba(255,255,255,.18); }
.tl .fill { position: absolute; left: 80px; top: 236px; height: 6px; border-radius: 3px; background: linear-gradient(90deg, var(--accent-dark), var(--accent) 55%, var(--accent-light)); }
.tl .node { position: absolute; top: 227px; width: 24px; height: 24px; margin-left: -12px; border-radius: 50%; background: #3a3a3e; border: 3px solid rgba(255,255,255,.35); }
.tl .lab { position: absolute; top: 268px; width: 200px; margin-left: -100px; text-align: center; font-size: 25px; color: rgba(255,255,255,.62); }
.tl .th { width: 74px; height: 132px; margin-left: -37px; top: 82px; border-radius: 12px; }
.tl .th svg { width: 26px; height: 26px; margin: -13px 0 0 -11px; }
.tl .pct { color: var(--accent-light); font-variant-numeric: tabular-nums; }
.chip { left: 540px; height: 110px; border-radius: 16px; background: rgba(20,20,24,.78); -webkit-backdrop-filter: blur(22px); backdrop-filter: blur(22px);
  box-shadow: 0 0 0 1px rgba(255,255,255,.12) inset, 0 18px 44px -18px rgba(0,0,0,.55); align-items: center; padding: 0 40px 0 46px;
  color: #fff; font-size: 52px; font-weight: 700; letter-spacing: -0.02em; white-space: nowrap; font-family: var(--font-hook), sans-serif; }
.card.light { background: #fff; color: var(--ink); -webkit-backdrop-filter: none; backdrop-filter: none;
  box-shadow: 0 0 0 1px rgba(0,0,0,.07), 0 26px 60px -24px rgba(0,0,0,.32); }
.card.light .hd .sub, .prof.light .hd2, .tl.light .lab, .prof.light .stats span { color: color-mix(in srgb, var(--ink) 55%, transparent); }
.prof.light .bio { color: #222; } .prof.light .caret { background: var(--ink); } .prof.light .av i { border-color: #fff; }
.prof.light .btn[style*="363639"] { background: #efefef !important; color: var(--ink); }
.prof.light .ring { background: rgba(0,0,0,.12); border-color: rgba(0,0,0,.45); }
.tl.light .rail { background: rgba(0,0,0,.1); } .tl.light .node { background: #ddd; border-color: rgba(0,0,0,.15); } .tl.light .pct { color: var(--accent-dark); }
.chip::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 12px; border-radius: 16px 0 0 16px; background: var(--accent); }
`;
  document.head.appendChild(css);

  const stage = document.getElementById('stage'), footage = document.getElementById('a'), CAP = document.getElementById('cap');
  const PLAY = '<svg viewBox="0 0 24 24"><path fill="#fff" d="M7 4.5v15l12-7.5z"/></svg>';
  const show = (el, on, disp = 'block') => { el.style.display = on ? disp : 'none'; };
  const add = (cls, before = CAP) => { const el = document.createElement('div'); el.className = 'ui ' + cls; stage.insertBefore(el, before); return el; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  // bouncier spring than FX.spring (~18% overshoot) for letters that "land"
  const bounce = (t) => { if (t <= 0) return 0; const k = 260, c = 15, w0 = Math.sqrt(k), z = c / (2 * w0), wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t)); };
  const avatar = (c, size, font) => `<div class="av" style="left:30px;top:30px;width:${size}px;height:${size}px"><i style="font-size:${font}px">${
    c.avatar ? `<img src="${c.avatar}">` : esc(c.initials || c.name.split(' ').map((p) => p[0]).join('').slice(0, 2))}</i></div>`;

  // ---- kinetic hook headline: each word pops in when it is spoken. *word* = serif accent on a gold block.
  // Words are matched to the transcript in order from `from` (seconds); a word not found keeps the previous word's time.
  function hook({ lines, until, from = 0, top = 300, lineGap = 100 }) {
    let cursor = from, last = from;
    const ws = window.WORDS;
    lines.forEach((line, li) => {
      const words = line.split(/\s+/).map((raw) => {
        const acc = /^\*.*\*[.,!?]*$/.test(raw), w = raw.replace(/\*/g, '');
        const i = ws.findIndex((x) => x.s >= cursor - 0.05 && norm(x.w) === norm(w));
        if (i >= 0) { last = ws[i].s; cursor = ws[i].e; }
        return { w, acc, at: last - 0.04 };
      });
      const el = add('hook'); el.style.top = (top + li * lineGap) + 'px';
      el.innerHTML = words.map((x) => `<span class="${x.acc ? 'acc' : ''}">${esc(x.w)}</span>`).join('');
      const spans = [...el.children];
      BEAT.custom((t) => {
        const on = t >= words[0].at && t < until; show(el, on);
        if (!on) return;
        el.style.opacity = FX.clamp((until - t) / 0.18).toFixed(3);
        spans.forEach((s, i) => {
          const k = FX.spring(t - words[i].at);
          s.style.opacity = FX.clamp((t - words[i].at) / 0.1).toFixed(3);
          s.style.transform = `translateY(${((1 - k) * 26).toFixed(1)}px) scale(${(0.9 + 0.1 * k).toFixed(3)})`;
        });
      });
    });
  }

  // ---- impact word behind the speaker's head: letters gravity-drop in. Needs page/assets/fg/NNNNN.png cutout frames
  // covering [at, until] (make them with scripts/cutout.py). Without them the word simply sits in front.
  let fg = null; const IMPACT = [];
  // top: 'auto' (needs scripts/heads.py) sits the word so the head covers only the bottom ~20% of the letters.
  function headTop(t0, t1) {     // highest the head gets in [t0, t1] (smallest y), from window.HEADS
    const H = window.HEADS; if (!H) return null;
    let best = null;
    for (let k = Math.floor(t0 / H.step); k <= Math.ceil(t1 / H.step); k++) { const y = H.top[k]; if (y != null && (best == null || y < best)) best = y; }
    return best;
  }
  // color 'auto' (default): white over a dark background, the style's ink over a light one. cutout.py --auto measures the
  // background behind the word and writes page/tones.js; until it has run, the word is ink.
  // quiet (default true): the small captions step aside while the word is up (it says the same thing)
  function impact({ text, at, until, size = 170, top = 'auto', color = 'auto', serif = false, stagger = 0.035, drop = 150, halo = false, quiet = true }) {
    if (top === 'auto') {
      const h = headTop(at, until);
      top = h == null ? 560 : Math.max(STYLE.safe_area.top + 10, Math.round(h - size * (serif ? 0.75 : 0.85)));
    }
    if (!fg) {
      fg = document.createElement('img'); fg.id = 'fg'; fg.alt = '';
      stage.insertBefore(fg, (window.__baseLayer || footage).nextSibling);   // above any layout base layers (KAL)
      BEAT.custom((t) => {
        const on = IMPACT.some((w) => t >= w.at && t < w.until && w.cut);
        show(fg, on);
        if (on) FX.setSrc(fg, `assets/fg/${String(Math.round(t * STYLE.fps)).padStart(5, '0')}.png`);
        const X = window.__spkX;                              // zoomed footage (KAL punch/framing): move the cutout with it
        fg.style.transformOrigin = '0 0'; fg.style.transform = on && X ? `translate(${X.OX.toFixed(1)}px, ${X.OY.toFixed(1)}px) scale(${X.S.toFixed(4)})` : '';
      });
    }
    const dark = color === 'auto' && (window.IMPACT_TONES || {})[at.toFixed(2)] === 'dark';
    const el = add('impact' + (serif ? ' serif' : '') + (halo ? ' halo' : '') + (dark ? ' ondark' : ''), fg);   // under the cutout
    el.dataset.sfx = 'none'; FX.cue('hit', at, { src: 'ANT.impact' });
    el.style.cssText = `top:${top}px;font-size:${size}px;color:${color !== 'auto' ? color : dark ? '#ffffff' : 'var(--ink)'}`;
    el.innerHTML = [...text].map((ch) => `<span>${esc(ch)}</span>`).join('');
    const letters = [...el.children];
    if (until > 0) IMPACT.push({ at, until, cut: true, text, top, size, auto: color === 'auto' });
    if (until > 0 && quiet) (window.CAP_SUPPRESS = window.CAP_SUPPRESS || []).push([at - 0.02, until]);   // (a negative window only creates the cutout layer)
    BEAT.custom((t) => {
      const on = t >= at && t < until; show(el, on);
      if (!on) return;
      el.style.opacity = FX.clamp((until - t) / 0.12).toFixed(3);
      letters.forEach((s, i) => {
        const t0 = at + stagger * i, k = bounce(t - t0);
        s.style.opacity = FX.clamp((t - t0) / 0.06).toFixed(3);
        s.style.transform = `translateY(${(-(1 - k) * drop).toFixed(1)}px)`;
      });
    });
    return el;
  }

  // ---- Instagram-style profile card. Pick one mode:
  //   bio:    { text, typeAt, typeEnd, thumbAt?, thumbLabel? }   bio types in; a reel thumbnail pops in at thumbAt
  //   stats:  { posts, followers, following, countAt, countEnd }  follower count ticks up and lands gold
  //   follow: { followers, hoverAt, tapAt }                       finger ring hovers, taps Follow -> Following, count +1
  // creator: { name, handle, initials?, avatar? (assets/x.jpg) }
  function profile({ creator, at, until, top = 200, left = 60, width = 960, theme = 'dark', bio, stats, follow }) {
    const c = creator, fmt = (n) => Number(n).toLocaleString('en-US');
    const head = (y1, y2) => `${avatar(c, bio ? 128 : 120, bio ? 44 : 42)}
      <div class="nm" style="left:${bio ? 186 : 176}px;top:${y1}px">${esc(c.name)}</div><div class="hd2" style="left:${bio ? 186 : 176}px;top:${y2}px">${esc(c.handle)}</div>`;
    let html, height, update;
    if (bio) {
      height = 350;
      html = `${head(52, 100)}<div class="bio" style="left:32px;top:186px"><span class="tx"></span><i class="caret"></i></div>` +
        (bio.thumbAt != null ? `<div class="th" style="left:784px;top:30px;width:146px;height:260px">${bio.thumb ? `<img src="${bio.thumb}">` : ''}${PLAY}<b>${esc(bio.thumbLabel || '▶ 1.2K')}</b></div>` : '');
      update = (t, el) => {
        const n = Math.round(FX.clamp((t - bio.typeAt) / (bio.typeEnd - bio.typeAt)) * bio.text.length);
        el.querySelector('.tx').textContent = bio.text.slice(0, n);
        el.querySelector('.caret').style.display = n < bio.text.length ? 'inline-block' : 'none';
        const th = el.querySelector('.th'); if (!th) return;
        const s = FX.spring(t - bio.thumbAt);
        th.style.display = t >= bio.thumbAt ? 'block' : 'none';
        th.style.opacity = FX.clamp((t - bio.thumbAt) / 0.12).toFixed(3);
        th.style.transform = `translateY(${((1 - s) * 22).toFixed(1)}px) scale(${(0.9 + 0.1 * s).toFixed(3)})`;
      };
    } else if (stats) {
      height = 300;
      html = `${head(46, 94)}<div class="stats" style="left:165px;top:178px"><div><b>${fmt(stats.posts)}</b><span>posts</span></div>` +
        `<div><b class="fol">0</b><span>followers</span></div><div><b>${fmt(stats.following)}</b><span>following</span></div></div>`;
      update = (t, el) => {
        const p = FX.outCubic(FX.clamp((t - stats.countAt) / (stats.countEnd - stats.countAt))), b = el.querySelector('.fol');
        b.textContent = fmt(Math.round(stats.followers * p));
        b.classList.toggle('land', t >= stats.countEnd);
        b.style.transform = `scale(${(1 + 0.18 * Math.sin(Math.PI * FX.clamp((t - stats.countEnd) / 0.35))).toFixed(3)})`;
      };
    } else {
      const f = follow; height = 330;
      html = `${head(40, 86)}<div class="hd2" style="left:176px;top:124px;color:#fff"><b class="cnt" style="font-weight:700"></b> followers</div>
        <div class="btn fb" style="left:30px;top:228px;width:440px"></div>
        <div class="btn" style="left:488px;top:228px;width:440px;background:#363639">Message</div><div class="ring"></div>`;
      update = (t, el) => {
        const fb = el.querySelector('.fb'), followed = t >= f.tapAt + 0.08;
        fb.textContent = followed ? 'Following ⌄' : 'Follow';
        fb.classList.toggle('on', followed);
        fb.style.transform = `scale(${(t >= f.tapAt && t < f.tapAt + 0.3 ? 1 - 0.05 * Math.sin(Math.PI * (t - f.tapAt) / 0.3) : 1).toFixed(3)})`;
        el.querySelector('.cnt').textContent = fmt(t >= f.tapAt + 0.3 ? f.followers + 1 : f.followers);
        const ring = el.querySelector('.ring'), vis = t >= f.hoverAt && t < f.tapAt + 0.5;
        ring.style.display = vis ? 'block' : 'none';
        if (!vis) return;
        const s = FX.spring(t - f.hoverAt), press = t >= f.tapAt ? Math.sin(Math.PI * FX.clamp((t - f.tapAt) / 0.3)) : 0;
        ring.style.left = (208 + (1 - s) * 260).toFixed(1) + 'px'; ring.style.top = (217 + (1 - s) * 90).toFixed(1) + 'px';
        ring.style.transform = `scale(${(1 - 0.25 * press).toFixed(3)})`;
        ring.style.opacity = (FX.clamp((t - f.hoverAt) / 0.15) * (1 - FX.clamp((t - f.tapAt - 0.3) / 0.2))).toFixed(3);
      };
    }
    if (follow) FX.cue('tap', follow.tapAt, { src: 'ANT.profile follow' });   // the card itself pops (automatic)
    return BEAT.card({ cls: 'card prof' + (theme === 'light' ? ' light' : ''), top, left, width, height, html, at, until, update });
  }

  // ---- progress timeline: rail fills gold from fillAt to fillEnd, each node lights + its thumbnail pops, a % metric climbs.
  function timeline({ title, app = 'instagram', labels = ['1 video', '10 videos', '50 videos', '100 videos'], thumbs = [],
                      metric = 'connection', from = 4, to = 92, suffix = '%', at, until, fillAt, fillEnd, top = 200, theme = 'dark' }) {
    const n = labels.length, X = labels.map((_, i) => Math.round(80 + (800 * i) / (n - 1)));
    return BEAT.card({
      cls: 'card tl' + (theme === 'light' ? ' light' : ''), top, height: 330,
      html: `<div class="hd">${app ? FX.tile(app, 40, 11) : ''}${esc(title)}<div class="r">${esc(metric)} <span class="pct"></span></div></div>
        <div class="rail"></div><div class="fill"></div>
        ${X.map((x, i) => `<div class="th" style="left:${x}px">${thumbs[i] ? `<img src="${thumbs[i]}">` : ''}${PLAY}</div><div class="node" style="left:${x}px"></div><div class="lab" style="left:${x}px">${esc(labels[i])}</div>`).join('')}`,
      at, until,
      update: (t, el) => {
        const p = FX.outCubic(FX.clamp((t - fillAt) / (fillEnd - fillAt)));
        el.querySelector('.fill').style.width = (800 * p).toFixed(1) + 'px';
        el.querySelector('.pct').textContent = Math.round(from + (to - from) * p) + suffix;
        const nodes = el.querySelectorAll('.node'), ths = el.querySelectorAll('.th');
        X.forEach((x, i) => {
          const hitT = fillAt + (fillEnd - fillAt) * (1 - Math.cbrt(1 - i / (n - 1))), lit = t >= hitT - 0.02 && (i > 0 || t >= fillAt);
          nodes[i].style.background = lit ? 'var(--accent-light)' : '#3a3a3e';
          nodes[i].style.borderColor = lit ? '#fff' : 'rgba(255,255,255,.35)';
          const k = lit ? FX.spring(t - hitT) : 0;
          ths[i].style.opacity = (lit ? FX.clamp((t - hitT) / 0.12) : 0).toFixed(3);
          ths[i].style.transform = `translateY(${((1 - k) * 18).toFixed(1)}px) scale(${(0.88 + 0.12 * k).toFixed(3)})`;
        });
      },
    });
  }

  // ---- stacked label chips: each pops in on its word and stacks below the previous; all leave together at `until`.
  function chips({ items, until, top = 236, gap = 130 }) {
    return items.map(([text, at], i) => {
      const el = add('chip'); el.textContent = text; el.style.top = (top + i * gap) + 'px';
      el.dataset.sfx = 'none'; FX.cue('click', at, { src: 'ANT.chips' });
      BEAT.custom((t) => FX.pop(el, t, at, until, { base: 'translateX(-50%)', disp: 'flex', origin: '50% 50%' }));
      return el;
    });
  }

  window.ANT = { hook, impact, profile, timeline, chips, bounce, headTop, SERIF, impacts: IMPACT };
})();
