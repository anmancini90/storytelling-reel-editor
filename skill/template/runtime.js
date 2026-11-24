// Deterministic frame compositor: the renderer calls window.__frame(i) for every output frame.
// beats.js describes WHAT appears WHEN (keyed to spoken words) using the BEAT helpers below.
(() => {
  const S = window.STYLE, FPS = S.fps, C = S.captions, SAFE = S.safe_area;
  const $ = (s, r = document) => r.querySelector(s);
  const stage = $('#stage'), A = $('#a'), CAP = $('#cap');
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const outCubic = (t) => 1 - (1 - t) ** 3;
  // Apple-style spring (stiffness 170, damping 20: ~6% overshoot, settles in ~0.45 s)
  const spring = (t) => { if (t <= 0) return 0; const k = 170, c = 20, w0 = Math.sqrt(k), z = c / (2 * w0), wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t)); };

  // captions style from style.json
  const r = document.documentElement.style;
  r.setProperty('--cap-font', `"${C.font_family}"`); r.setProperty('--cap-weight', C.weight); r.setProperty('--cap-size', C.size_px + 'px');
  r.setProperty('--cap-track', C.tracking_em + 'em'); r.setProperty('--cap-lh', C.line_height); r.setProperty('--cap-color', C.color);
  r.setProperty('--cap-y', C.center_y + 'px');
  // optional caption look (style.json captions): case, italic, outline, shadow, box behind the words, pop-in
  const SHADOWS = { none: 'none', soft: '0 2px 10px rgba(0,0,0,.55)', strong: '0 3px 14px rgba(0,0,0,.75), 0 0 4px rgba(0,0,0,.6)' };
  r.setProperty('--cap-case', { upper: 'uppercase', lower: 'lowercase' }[C.case] || 'none');
  r.setProperty('--cap-style', C.italic ? 'italic' : 'normal');
  r.setProperty('--cap-shadow', SHADOWS[C.shadow] || C.shadow || 'none');
  r.setProperty('--cap-stroke', C.outline_px ? `${C.outline_px * 2}px ${C.outline_color || '#000'}` : '0 transparent');
  r.setProperty('--cap-box', C.box || 'transparent');
  r.setProperty('--cap-pad', C.box ? '0.08em 0.32em 0.12em' : '0');

  // ---- the creator's colours and fonts (style.json palette / fonts). Every building block uses these variables,
  // so a style changes the accent, the dark text, the light panels and the type everywhere at once.
  const GOLD = { accent: '#b7904b', accent_light: '#dec68f', accent_dark: '#845f1e', key: '#f2c14e' };
  const PAL = Object.assign({ ink: '#161514', paper: '#f5f1e9', canvas: '#ecebe8' }, (S.palette || {}).accent ? {} : GOLD, S.palette || {});
  const rgb = (h) => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const mixHex = (a, b, k) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * k).toString(16).padStart(2, '0')).join('');
  PAL.accent_light = PAL.accent_light || mixHex(PAL.accent, '#ffffff', 0.45);   // only the accent given: derive the rest
  PAL.accent_dark = PAL.accent_dark || mixHex(PAL.accent, '#000000', 0.4);
  PAL.key = PAL.key || PAL.accent_light;
  for (const [k, v] of Object.entries(PAL)) if (!k.startsWith('_')) r.setProperty('--' + k.replace(/_/g, '-'), v);
  const FN = Object.assign({ hook: 'TikTok Sans', headline: 'Hanken Grotesk', body: 'Inter', serif: 'Baskerville', mono: 'Menlo' }, S.fonts || {});
  r.setProperty('--font-hook', `"${FN.hook}"`); r.setProperty('--font-head', `"${FN.headline}"`); r.setProperty('--font-body', `"${FN.body}"`);
  r.setProperty('--font-serif', `"${FN.serif}", Baskerville, "Times New Roman", serif`); r.setProperty('--font-mono', `"${FN.mono}", Menlo, monospace`);
  window.PAL = PAL;

  // ---- caption keywords (style.json captions.keywords; numbers too unless numbers_are_keywords is false) in the key colour
  const normK = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const KEYS = new Set((C.keywords || []).flatMap((k) => k.split(/\s+/)).map(normK).filter(Boolean));
  if (KEYS.size || C.numbers_are_keywords) window.CAP_KEY = (w) => (C.numbers_are_keywords !== false && /\d/.test(w)) || KEYS.has(normK(w));
  r.setProperty('--cap-key', C.keyword_color ? (PAL[C.keyword_color] || C.keyword_color) : PAL.key);
  const escH = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const capHTML = (txt) => `<span class="c">${txt.split(' ').map((w) => window.CAP_KEY && window.CAP_KEY(w) ? `<span class="k">${escH(w)}</span>` : escH(w)).join(' ')}</span>`;
  window.capHTML = capHTML;   // layouts.js draws its captions with it too

  // ---- word lookup: W('overnight') = start time of the first "overnight"; W('this', 25) = first "this" at/after 25 s
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const W = (text, after = 0) => {
    const words = norm(text).length ? text.split(/\s+/).map(norm) : [];
    const ws = window.WORDS;
    for (let i = 0; i < ws.length; i++) {
      if (ws[i].s < after - 0.05) continue;
      if (words.every((x, k) => ws[i + k] && norm(ws[i + k].w) === x)) return ws[i].s;
    }
    throw new Error(`W(): "${text}" not found after ${after}s`);
  };
  const WE = (text, after = 0) => { // end time of the phrase's last word
    const n = text.split(/\s+/).length, s = W(text, after), i = window.WORDS.findIndex((w) => w.s === s);
    return window.WORDS[i + n - 1].e;
  };
  const END = window.NFRAMES / FPS;

  // ---- loading frames/images deterministically
  const loads = [];
  const setSrc = (img, u) => { if (img.getAttribute('src') !== u) { img.setAttribute('src', u); loads.push(img.decode().catch(() => 0)); } };

  // ---- pop in on t0 (fade .12 s, scale .92 -> 1, rise 22 px with the spring), out over the last .18 s before t1
  function pop(el, t, t0, t1, { origin = '50% 0%', base = '', disp = 'block' } = {}) {
    const on = t >= t0 && t < t1;
    el.style.display = on ? disp : 'none';
    if (!on) return false;
    const s = spring(t - t0), e = clamp((t1 - t) / 0.18);
    el.style.opacity = (clamp((t - t0) / 0.12) * e).toFixed(3);
    el.style.transformOrigin = origin;
    const lift = (window.POP_EXIT_LIFT || 0) * (1 - e) * (1 - e);   // optional: lift up while fading out (KAL sets it)
    el.style.transform = `${base} translateY(${((1 - s) * 22 - lift).toFixed(2)}px) scale(${(0.92 + 0.08 * s - 0.03 * (1 - e)).toFixed(4)})`;
    return true;
  }

  // ---- app tiles (real logos via Simple Icons paths)
  const P = window.ICON_PATHS || {};
  const APPS = {
    tiktok: { bg: '#000', layers: [['#25F4EE', -0.9, -0.6], ['#FE2C55', 0.9, 0.6], ['#fff', 0, 0]] },
    instagram: { bg: 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fd5949 45%, #d6249f 60%, #285AEB 90%)', fill: '#fff' },
    youtube: { bg: '#fff', fill: '#FF0000' }, claude: { bg: '#F4F0E6', fill: '#D97757' }, imessage: { bg: '#34C759', fill: '#fff' },
    gmail: { bg: '#fff', fill: '#EA4335' }, stripe: { bg: '#635BFF', fill: '#fff' }, shopify: { bg: '#fff', fill: '#7AB55C' },
    x: { bg: '#000', fill: '#fff' }, whatsapp: { bg: '#25D366', fill: '#fff' }, spotify: { bg: '#000', fill: '#1ED760' },
  };
  function tile(app, size = 72, radius = Math.round(size * 0.235)) {
    const a = APPS[app], g = Math.round(size * 0.6);
    if (!a || !P[app]) { // unknown app: letter tile (or pass {img:'assets/logo.png'})
      if (app && app.img) { const sc = app.scale || 100;   // any logo: {img:'assets/logo.svg', bg:'#FF6243', scale:70}
        return `<div class="tile" style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${app.bg || '#fff'}"><img src="${app.img}" style="width:${sc}%;height:${sc}%;object-fit:contain"></div>`; }
      return `<div class="tile" style="width:${size}px;height:${size}px;border-radius:${radius}px;background:#3a3a3c;color:#fff;font-weight:700;font-size:${Math.round(size * 0.45)}px">${String(app || '?')[0].toUpperCase()}</div>`;
    }
    const paths = a.layers ? a.layers.map(([f, x, y]) => `<path fill="${f}" transform="translate(${x},${y})" d="${P[app]}"/>`).join('')
      : `<path fill="${a.fill}" d="${P[app]}"/>`;
    return `<div class="tile" style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${a.bg}"><svg viewBox="0 0 24 24" style="width:${g}px;height:${g}px">${paths}</svg></div>`;
  }
  const MOON = '<svg viewBox="0 0 24 24"><path fill="#BF9DFF" d="M20.5 14.8A8.5 8.5 0 0 1 9.2 3.5a8.5 8.5 0 1 0 11.3 11.3z"/></svg>';

  // ---- beat registry
  const beats = [];
  const make = (cls, html, css = '') => { const d = document.createElement('div'); d.className = 'ui ' + cls; d.innerHTML = html; d.style.cssText = css; stage.insertBefore(d, CAP); return d; };
  const groups = {};

  const BEAT = {
    // iOS notification banner. Banners in the same group stack: a newer one pushes the older ones down (like iOS).
    notify({ app, title, body, at, until, top = 270, group = 'n', time = 'now' }) {
      const el = make('nt', `${tile(app)}<div class="tx"><div class="t1">${title}<span>${time}</span></div><div class="t2">${body}</div></div>`);
      el.dataset.sfx = 'none'; cue('notify', at, { src: 'BEAT.notify' });
      const me = { at }; (groups[group] = groups[group] || []).push(me);
      beats.push((t) => {
        const shift = groups[group].filter((o) => o.at > at && t >= o.at).reduce((s, o) => s + 148 * spring(t - o.at), 0);
        pop(el, t, at, until, { base: `translateY(${(top + shift).toFixed(1)}px)`, disp: 'flex' });
      });
      return el;
    },
    // iOS Focus pill, e.g. Sleep
    pill({ text = 'Sleep', icon = MOON, at, until, top = 200 }) {
      const el = make('pill', `${icon || ''}${text}`, `top:${top}px`);
      beats.push((t) => pop(el, t, at, until, { base: 'translateX(-50%)', disp: 'flex' }));
      return el;
    },
    // The app/AI talks back. oneLine puts the signature on the same line (saves ~40 px of height).
    bubble({ app = 'claude', text, sig = '', at, until, top, left = 60, oneLine = false }) {
      const el = make('say' + (oneLine ? ' one' : ''), `${tile(app, 56, 15)}<div class="bb"><div class="q">${text}${oneLine && sig ? `<span class="by">${sig}</span>` : ''}</div>${!oneLine && sig ? `<div class="by">${sig}</div>` : ''}</div>`,
        `top:${top}px;left:${left}px`);
      beats.push((t) => pop(el, t, at, until, { origin: '0% 100%', disp: 'flex' }));
      return el;
    },
    // Glass card with a header and a grid of images or playing frame sequences (e.g. "the 6 ads I made").
    // items: [{src:'assets/x.jpg'} | {frames:'assets/ad1/', count:100}]  (frames = 001.jpg..NNN.jpg, played from the card's start)
    grid({ app = null, title = '', sub = '', right = '', items, cols = 3, tileW = 224, tileH = 126, gap = 16, at, until, top = 200, left = null, stagger = 0.07 }) {
      const rows = Math.ceil(items.length / cols), w = cols * tileW + (cols - 1) * gap + 64, h = 72 + rows * tileH + (rows - 1) * gap + 22;
      const x = left == null ? Math.round((1080 - w) / 2) : left;
      const el = make('card', `<div class="hd">${app ? tile(app, 40, 11) : ''}${title}<span class="sub">${sub}</span><div class="r">${right}</div></div>` +
        `<div class="grid" style="left:32px;top:72px;grid-template-columns:repeat(${cols},${tileW}px);gap:${gap}px"></div>`, `top:${top}px;left:${x}px;width:${w}px;height:${h}px`);
      const g = $('.grid', el);
      const cells = items.map((it) => { const d = document.createElement('div'); d.className = 'v'; d.style.cssText = `width:${tileW}px;height:${tileH}px`; d.innerHTML = '<img>'; g.appendChild(d); return d; });
      beats.push((t) => {
        if (!pop(el, t, at, until)) return;
        cells.forEach((d, i) => {
          const t0 = at + stagger * i, p = outCubic(clamp((t - t0) / 0.28)), it = items[i];
          d.style.opacity = p.toFixed(3); d.style.transform = `scale(${(0.9 + 0.1 * p).toFixed(3)})`;
          const u = it.frames ? `${it.frames}${String(Math.max(1, Math.min(it.count, Math.floor((t - t0) * FPS) + 1))).padStart(3, '0')}.jpg` : it.src;
          setSrc($('img', d), u);
        });
      });
      return el;
    },
    // A real screen: a screenshot (src) or a recording (frames + count) in a browser window, for "my app" / "this site".
    //   mode 'card'  a window above the head (top/height fit the strip over the head); scroll pans down the page
    //        'split' fills the top half, edge to edge: pair it with a 'news' layout segment over the same at..until
    //        'full'  a full-screen cutaway: a big window on a dark backdrop; the voice and captions carry on
    //   focus [x, y] (0-1): the point of the image kept in view; zoom > 1 crops in around it; scroll [y0, y1] moves the
    //   focus down the page over the hold; push: slow push-in over the hold. bar: browser bar (url = its address text).
    screen({ src, frames, count = 0, mode = 'card', at, until, top, height, width, focus = [0.5, 0.25], zoom = 1, scroll = null,
      push = 0.04, bar = mode !== 'split', url = '' }) {
      const M = { card: [210, 230, 960], split: [0, 960, 1080], full: [300, 1150, 1000] }[mode];
      top = top ?? M[0]; height = height ?? M[1]; width = width ?? M[2];
      const bh = bar ? 46 : 0, bg = mode === 'full' ? make('scrn-bg', '') : null;
      const el = make('scrn ' + mode, `${bar ? `<div class="bar"><i></i><i></i><i></i>${url ? `<span>${url}</span>` : ''}</div>` : ''}<div class="vp" style="top:${bh}px"><img alt=""></div>`,
        `left:${(1080 - width) / 2}px;top:${top}px;width:${width}px;height:${height}px`);
      const img = $('img', el);
      el.dataset.sfx = 'none'; if (bg) bg.dataset.sfx = 'none';
      // the whoosh peaks as the window lands (one frame in: it is on screen from its first frame), never after it
      if (mode === 'full') { cue('whoosh-long', at + 0.04, { src: 'BEAT.screen in' }); cue('whoosh-long', until - 0.09, { src: 'BEAT.screen out' }); }
      else cue('whoosh-short', at + 0.04, { src: 'BEAT.screen' });
      beats.push((t) => {
        const on = t >= at && t < until, fade = clamp((t - at) / 0.15) * clamp((until - t) / 0.18);
        if (bg) { bg.style.display = on ? 'block' : 'none'; bg.style.opacity = fade.toFixed(3); }
        if (mode === 'split') { el.style.display = on ? 'block' : 'none'; el.style.opacity = fade.toFixed(3); if (!on) return; }
        else if (!pop(el, t, at, until, { origin: '50% 50%' })) return;
        setSrc(img, frames ? `${frames}${String(Math.max(1, Math.min(count, Math.floor((t - at) * FPS) + 1))).padStart(3, '0')}.jpg` : src);
        const q = clamp((t - at) / Math.max(0.5, until - at)), e = q * q * (3 - 2 * q);
        const pos = `${(focus[0] * 100).toFixed(2)}% ${((scroll ? scroll[0] + (scroll[1] - scroll[0]) * e : focus[1]) * 100).toFixed(2)}%`;
        img.style.objectPosition = pos; img.style.transformOrigin = pos;
        img.style.transform = `scale(${(zoom * (1 + push * q)).toFixed(4)})`;
      });
      return el;
    },
    // Instagram comment sheet: types `word` into the box, posts it, the like lands. For "Comment X for Y" CTAs.
    comment({ handle = 'you', account = 'yourname', word, at, typeEnd, until = END + 1, top = 200 }) {
      const AV = '<svg viewBox="0 0 60 60" width="100%" height="100%"><circle cx="30" cy="23" r="11" fill="#8e8e93"/><path d="M8 54c3-11 12-17 22-17s19 6 22 17z" fill="#8e8e93"/></svg>';
      const el = make('cmt', `<div class="grab"></div><div class="h">Comments</div><div class="line"></div>
        <div class="row"><div class="av">${AV}</div><div><div class="who">${handle}<span>now</span></div><div class="msg">${word}</div><div class="rp">Reply</div></div>
        <svg class="hrt" viewBox="0 0 24 24"><path class="hp" d="M12 20.3s-7.6-4.6-9.2-9.4C1.8 7.6 3.8 4.5 7 4.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.2 0 5.2 3.1 4.2 6.4-1.6 4.8-9.2 9.4-9.2 9.4z" fill="none" stroke="#a8a8a8" stroke-width="1.8"/></svg></div>
        <div class="in"><div class="av">${AV}</div><div class="field"><span class="ph">Add a comment for ${account}...</span><b class="ty"></b><i class="caret"></i></div><div class="post">Post</div></div>`, `top:${top}px`);
      // sounds: the build lands on the sheet, it slides up, the word types, it posts, the like lands
      el.dataset.sfx = 'none';
      cue('riser', at, { src: 'BEAT.comment' }); cue('swipe', at + 0.3, { src: 'BEAT.comment' });
      cue('type', at + 0.12, { dur: typeEnd - at - 0.12, src: 'BEAT.comment' });
      cue('send', typeEnd + 0.35, { src: 'BEAT.comment' }); cue('tap', typeEnd + 1.0, { src: 'BEAT.comment like' });
      beats.push((t) => {
        if (!pop(el, t, at, until)) return;
        const tw0 = at + 0.12, n = clamp(Math.floor((t - tw0) / ((typeEnd - tw0) / word.length)) + 1, 0, word.length), posted = t >= typeEnd + 0.35;
        $('.ty', el).textContent = posted ? '' : word.slice(0, t >= tw0 ? n : 0);
        $('.ph', el).style.display = (t >= tw0 && !posted) ? 'none' : 'inline';
        $('.caret', el).style.display = posted ? 'none' : (Math.floor(t * 2.4) % 2 === 0 ? 'inline-block' : 'none');
        $('.post', el).classList.toggle('on', !posted && n === word.length);
        const row = $('.row', el); row.style.display = posted ? 'flex' : 'none';
        if (posted) {
          const s = spring(t - typeEnd - 0.35); row.style.opacity = clamp((t - typeEnd - 0.35) / 0.15).toFixed(3); row.style.transform = `translateY(${((1 - s) * 18).toFixed(1)}px)`;
          const liked = t >= typeEnd + 1.0, hp = $('.hp', row);
          hp.setAttribute('fill', liked ? '#FF3040' : 'none'); hp.setAttribute('stroke', liked ? '#FF3040' : '#a8a8a8');
          $('.hrt', row).style.transform = liked ? `scale(${(0.6 + 0.4 * spring(t - typeEnd - 1.0)).toFixed(3)})` : 'none';
        }
      });
      return el;
    },
    // Anything else: a glass card with your own HTML; update(t, el, k) runs every frame while it is on screen (k = seconds since `at`).
    card({ html, at, until, top = 200, left = 60, width = 960, height = 300, update = null, cls = 'card' }) {
      const el = make(cls, html, `top:${top}px;left:${left}px;width:${width}px;height:${height}px`);
      beats.push((t) => { if (pop(el, t, at, until) && update) update(t, el, t - at); });
      return el;
    },
    custom(fn) { beats.push(fn); },
  };
  // ---- sound cues: every building block says where a sound goes (scripts/sound_design.py turns them into the sound
  // track). t = when the sound's hit or peak lands; span roles (type, scribble) start at t and last dur.
  window.CUES = [];
  const cue = (role, t, o = {}) => { window.CUES.push({ t: Math.round(t * 1000) / 1000, role, ...(o.dur != null ? { dur: Math.round(o.dur * 1000) / 1000 } : {}), src: o.src || '' }); };
  window.BEAT = BEAT; window.W = W; window.WE = WE; window.END = END;
  window.FX = { spring, outCubic, clamp, pop, tile, setSrc, MOON, cue };

  // ---- frame loop
  const q = new URLSearchParams(location.search), FR = q.get('frames');
  if (q.get('zones')) for (const z of [[0, 0, 1080, SAFE.top], [0, SAFE.bottom, 1080, 1920 - SAFE.bottom], [SAFE.rail_x, SAFE.rail_from_y, 1080 - SAFE.rail_x, SAFE.bottom - SAFE.rail_from_y]]) {
    const d = document.createElement('div'); d.className = 'zone'; d.style.cssText = `left:${z[0]}px;top:${z[1]}px;width:${z[2]}px;height:${z[3]}px`; stage.appendChild(d);
  }
  // cues mode (render.mjs <project> cues): note every .ui element the code shows, so anything that appears without an
  // explicit cue still gets a sound (data-sfx="<role>" picks it, data-sfx="none" opts out; captions never)
  const TRACK = q.get('cues'), shown = new WeakSet();
  window.__appears = [];
  window.__calls = [];
  window.__auditBlocks = () => {   // index.html calls this before beats.js: note every building block beats.js runs
    if (!TRACK) return;
    const SKIP = new Set(['setup', 'layout', 'framing', 'custom', 'keys', 'suppress']);
    for (const ns of ['BEAT', 'TXT', 'ANT', 'KAL', 'EDT', 'SIG', 'CLD', 'MIN', 'VIS']) {
      const o = window[ns];
      if (!o) continue;
      for (const k of Object.keys(o)) {
        const f = o[k];
        if (typeof f !== 'function' || SKIP.has(k)) continue;
        o[k] = function (...a) {
          const p = a[0] || {}, it = Array.isArray(p.items) && p.items.length ? p.items[0] : null;
          const at = p.at ?? (it ? (Array.isArray(it) ? it[1] : it.at) : undefined) ?? p.from
            ?? (Array.isArray(p.shapes) && p.shapes.length ? Math.min(...p.shapes.map((s) => s.at)) : undefined);
          window.__calls.push({ block: `${ns}.${k}`, at: at ?? null, until: p.until ?? null });
          return f.apply(this, a);
        };
      }
    }
  };
  function track(t) {
    for (const el of stage.querySelectorAll('.ui')) {
      if (el.dataset.role === 'caption' || el.dataset.sfx === 'none') continue;
      const on = !!el.style.display && el.style.display !== 'none';
      if (on && !shown.has(el)) window.__appears.push({ t: Math.round(t * 1000) / 1000, cls: el.className.replace(/^ui\s*/, ''), sfx: el.dataset.sfx || '' });
      if (on) shown.add(el); else shown.delete(el);
    }
  }
  function render(i) {
    const t = i / FPS;
    if (FR) setSrc(A, `${FR}/${String(i).padStart(5, '0')}.jpg`);
    beats.forEach((b) => b(t));
    if (TRACK) track(t);
    const quiet = C.mode === 'off' || (window.CAP_SUPPRESS || []).some(([a, b]) => t >= a && t < b);   // a headline says it already
    const c = quiet ? null : window.CAPS.find((x) => t >= x.s && t < x.e), txt = c ? c.t : '';
    if (CAP.dataset.t !== txt) { CAP.dataset.t = txt; CAP.innerHTML = txt ? capHTML(txt) : ''; }
    if (C.animation === 'pop' && c) {   // pop: each chunk scales .9 -> 1 and fades in over ~0.1 s
      const k = clamp((t - c.s) / 0.1); CAP.firstChild.style.cssText = `display:inline-block;opacity:${k.toFixed(3)};transform:scale(${(0.9 + 0.1 * outCubic(k)).toFixed(4)})`;
    }
  }
  window.__start = () => {
    window.__ready = Promise.all([document.fonts.load(`${C.weight} ${C.size_px}px "${C.font_family}"`), document.fonts.ready]).then(() => true);
    window.__frame = async (i) => { await window.__ready; loads.length = 0; render(i); await Promise.all(loads); return true; };
  };
})();
