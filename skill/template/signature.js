// signature.js: SIG.* building blocks: kinetic hook, two-tier punchline, app window, DM mock. Built on KAL.layout
// (full <-> canvas morph, captions) + ANT.* + BEAT.*. Documented in the comments below.
//
//   SIG.setup({ segments })                  KAL.layout + Signature caption look (thick, bold, gold)
//   SIG.twoTier({ small, big, at, until })   punchline: small line + giant gold keyword (full frame, chest)
//   SIG.side({ words, at, until, side })     1-2 giant words beside the head (auto side = the emptier one)
//   SIG.hook({ lines, at, until })           kinetic opening title behind the head
//   SIG.big({ text, at, until })             giant bold word behind the head (peak moments)
//   SIG.app({ at, until, prompt, typeAt, typeEnd, status })   Claude-style desktop window floating behind the head
//   KAL.punch({ at, until, scale })          punch-in zoom (pair with SIG.side)
(() => {
  const css = document.createElement('style');
  css.textContent = `
.sig2 { left: 540px; text-align: center; white-space: nowrap; transform: translate(-50%, -50%); }
.sig2 .s { display: block; font: 700 46px/1.1 var(--font-body), sans-serif; color: #fff; letter-spacing: -0.02em; text-shadow: 0 2px 14px rgba(0,0,0,.55); }
.sig2 .b { display: inline-block; font: 900 160px/0.95 var(--font-head), sans-serif; letter-spacing: -0.05em; color: var(--accent-light);
  text-shadow: 0 6px 30px rgba(0,0,0,.45); margin-top: 6px; }
.sigside { white-space: nowrap; font: 900 140px/0.92 var(--font-head), sans-serif; letter-spacing: -0.05em; color: var(--ink); }
.sigside span { display: block; }
.sigside .g { color: var(--accent-dark); }
.sigside.dark { color: #fff; text-shadow: 0 6px 30px rgba(0,0,0,.5); } .sigside.dark .g { color: var(--accent-light); }
.sigside.halo { text-shadow: 0 0 22px rgba(247,246,243,.92), 0 0 8px rgba(247,246,243,.85); }
.sigk { left: 0; width: 1080px; white-space: nowrap; font-family: var(--font-head), sans-serif; font-weight: 900;
  text-transform: uppercase; letter-spacing: -0.035em; line-height: 0.84; }
.sigk .ln { position: absolute; left: 0; width: 1080px; text-align: center; white-space: nowrap; }
.sigk .ch { position: relative; display: inline-block; }
.sigk .ch > i { position: absolute; left: 0; top: 0; font-style: normal; }           /* the 3 horizontal strips of a letter */
.sigk .ch > b { visibility: hidden; font-weight: inherit; }                          /* sizing ghost */
.sigk .cur { position: absolute; height: 0.1em; width: 0.5em; bottom: 0.06em; }
.sigdm { left: 70px; width: 940px; border-radius: 30px; background: #fff; color: #0f1419; overflow: hidden; font-family: var(--font-body), sans-serif;
  box-shadow: 0 0 0 1px rgba(0,0,0,.07), 0 30px 70px -26px rgba(0,0,0,.45); }
.sigdm .top { height: 104px; display: flex; align-items: center; gap: 18px; padding: 0 30px; border-bottom: 1px solid #ececec; }
.sigdm .top .av { width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(140deg, #d9a273, #9c5f3a); color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 24px; overflow: hidden; }
.sigdm .top .av img { width: 100%; height: 100%; object-fit: cover; }
.sigdm .top b { display: block; font-size: 29px; } .sigdm .top span { font-size: 22px; color: #737373; }
.sigdm .body { position: absolute; left: 0; right: 0; top: 104px; bottom: 0; padding: 26px 30px; display: flex; flex-direction: column; gap: 14px; }
.sigdm .msg { max-width: 640px; padding: 18px 26px; border-radius: 30px; font-size: 30px; line-height: 1.3; transform-origin: 0 100%; }
.sigdm .msg.me { align-self: flex-end; background: #3797f0; color: #fff; border-bottom-right-radius: 10px; transform-origin: 100% 100%; }
.sigdm .msg.them { align-self: flex-start; background: #efefef; color: #0f1419; border-bottom-left-radius: 10px; }
.sigdm .dots { align-self: flex-start; background: #efefef; border-radius: 30px; padding: 22px 26px; display: flex; gap: 10px; }
.sigdm .dots i { width: 13px; height: 13px; border-radius: 50%; background: #9b9b9b; display: block; }
.sigdm .react { position: absolute; font-size: 30px; background: #fff; border-radius: 20px; padding: 2px 8px; box-shadow: 0 2px 8px rgba(0,0,0,.15); }
.sigapp { position: absolute; left: 70px; width: 940px; border-radius: 26px; overflow: hidden; background: #faf9f5; color: #29261b;
  box-shadow: 0 0 0 1px rgba(0,0,0,.08), 0 40px 90px -30px rgba(0,0,0,.55); font-family: var(--font-body), sans-serif; display: none; }
.sigapp .bar { height: 54px; display: flex; align-items: center; gap: 12px; padding: 0 22px; background: #f0eee6; border-bottom: 1px solid #e3e0d5; }
.sigapp .bar i { width: 15px; height: 15px; border-radius: 50%; display: inline-block; }
.sigapp .bar .crumb { margin-left: 18px; font-size: 22px; color: #73705f; }
.sigapp .side { position: absolute; left: 0; top: 54px; bottom: 0; width: 250px; background: #f3f1ea; border-right: 1px solid #e3e0d5; padding: 22px 18px; font-size: 21px; color: #4d4a3d; }
.sigapp .side div { padding: 9px 10px; border-radius: 10px; } .sigapp .side .on { background: #e7e4d8; }
.sigapp .side .new { color: #c96442; font-weight: 600; }
.sigapp .main { position: absolute; left: 250px; right: 0; top: 54px; bottom: 0; padding: 40px 40px; }
.sigapp .hi { display: flex; align-items: center; justify-content: center; gap: 14px; font: 500 38px var(--font-head), sans-serif; letter-spacing: -0.02em; color: #29261b; margin-top: 30px; }
.sigapp .hi svg { width: 40px; height: 40px; }
.sigapp .box { position: absolute; left: 40px; right: 40px; bottom: 40px; min-height: 120px; border-radius: 22px; background: #fff; border: 1px solid #ddd9cc;
  box-shadow: 0 8px 26px -14px rgba(0,0,0,.25); padding: 22px 24px; font-size: 26px; color: #29261b; }
.sigapp .box .ph { color: #a29f90; } .sigapp .box .caret { display: inline-block; width: 2px; height: 28px; background: #29261b; vertical-align: -5px; margin-left: 2px; }
.sigapp .box .send { position: absolute; right: 18px; bottom: 16px; width: 46px; height: 46px; border-radius: 12px; background: #c96442; display: grid; place-items: center; }
.sigapp .stat { margin-top: 34px; display: none; flex-direction: column; gap: 16px; font-size: 24px; color: #4d4a3d; }
.sigapp .stat div { display: flex; align-items: center; gap: 12px; } .sigapp .stat b { color: #29261b; }
.sigapp .spin { width: 22px; height: 22px; border-radius: 50%; border: 3px solid #e0dccf; border-top-color: var(--accent); display: inline-block; }
`;
  document.head.appendChild(css);
  const stage = document.getElementById('stage'), CAP = document.getElementById('cap');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const add = (cls, html = '') => { const el = document.createElement('div'); el.className = 'ui ' + cls; el.innerHTML = html; stage.insertBefore(el, CAP); return el; };
  const suppress = (a, b) => { (window.CAP_SUPPRESS = window.CAP_SUPPRESS || []).push([a, b]); };
  const STAR = '<svg viewBox="0 0 24 24"><g stroke="#c96442" stroke-width="2.6" stroke-linecap="round">' +
    [0, 30, 60, 90, 120, 150].map((r) => `<line x1="12" y1="3" x2="12" y2="21" transform="rotate(${r} 12 12)"/>`).join('') + '</g></svg>';
  const headAt = (t) => { const H = window.HEADS; if (!H) return { top: 720, left: 380, right: 700 }; const k = Math.round(t / H.step);
    return { top: H.top[k] ?? 720, left: H.left[k] ?? 380, right: H.right[k] ?? 700 }; };

  // capMode (default: the saved style's captions.mode): 'chunk' = captions stay in ONE spot (chest height) as 2-4 word
  // chunks, only hooks/big words replace them; 'word' = one-word captions that move with the layout.
  function setup({ segments, box = {}, news = {}, pip = {}, capMode, cream }) { document.body.classList.add('sig'); KAL.layout({ segments, box, news, pip, capMode, cream }); }

  // ---- punchline: small white line + giant gold keyword at chest height (full frame). Owns the caption slot.
  function twoTier({ small = '', big, at, until, y = 1395 }) {
    const el = add('sig2', `${small ? `<span class="s">${esc(small)}</span>` : ''}<span class="b">${esc(big)}</span>`);
    el.style.top = y + 'px'; el.dataset.role = 'caption';             // a caption tier: safe-area audited, headroom-exempt
    FX.cue('hit', at, { src: 'SIG.twoTier' });                          // the gold punchline word lands like an impact
    const b = el.querySelector('.b');
    suppress(at - 0.02, until);
    let fitted = false;
    const fit = () => {                       // below y 960 the right edge must stay left of x 900 (centred: max 720 wide)
      const w = el.offsetWidth; if (w > 720) { const k = 720 / w; b.style.fontSize = (160 * k).toFixed(0) + 'px';
        const s = el.querySelector('.s'); if (s && s.offsetWidth > 720) s.style.fontSize = (46 * 720 / s.offsetWidth).toFixed(0) + 'px'; }
      fitted = true;
    };
    BEAT.custom((t) => {
      const on = t >= at && t < until; el.style.display = on ? 'block' : 'none'; if (!on) return;
      if (!fitted) fit();
      el.style.opacity = FX.clamp((until - t) / 0.12).toFixed(3);
      const k = window.ANT ? ANT.bounce(t - at - 0.06) : FX.spring(t - at);
      b.style.transform = `scale(${(0.6 + 0.4 * k).toFixed(3)})`; b.style.opacity = FX.clamp((t - at - 0.06) / 0.08).toFixed(3);
    });
    return el;
  }

  // ---- side words: 1-2 giant words next to the head (full frame), on the emptier side, sized to fit the gap
  // bg: 'light' (default; charcoal + deep gold, e.g. a cream wall) | 'dark' (white + light gold, for dark footage)
  // times: optional entrance time per line (e.g. each word as it's spoken); default = staggered from `at`
  // The words tuck `tuck` px behind the head's edge (cutout layer), so they can be bigger on close framing.
  function side({ words, at, until, side: which = 'auto', gold = -1, punch = 0, bg = 'light', times = null, tuck = 22, maxSize = 150 }) {
    const lines = [].concat(words);
    if (!document.getElementById('fg')) ANT.impact({ text: ' ', at: -1, until: -0.5 });      // creates the cutout layer
    const el = document.createElement('div');
    el.className = 'ui sigside' + (bg === 'dark' ? ' dark' : ' halo'); el.dataset.role = 'behind';   // tucked behind the head on purpose
    el.innerHTML = lines.map((w, i) => `<span class="${i === gold ? 'g' : ''}">${esc(w)}</span>`).join('');
    stage.insertBefore(el, document.getElementById('fg'));
    ANT.impacts.push({ at, until, cut: true, text: 'side words' });
    suppress(at - 0.02, until);
    punch = 0;   // disabled: a punch-in moves the footage but not the cutout -> a doubled head (Ant, 2026-10-20)
    const h = headAt((at + until) / 2), z = punch || 1, cx = (h.left + h.right) / 2;
    const L = cx - (cx - h.left) * z, Rr = cx + (h.right - cx) * z;              // head edges after the punch-in
    const roomL = L + tuck - 36, roomR = 1044 - (Rr - tuck);
    const s = which === 'auto' ? (roomL >= roomR ? 'left' : 'right') : which, room = s === 'left' ? roomL : roomR;
    let placed = false;
    const place = () => {                                                          // measured once fonts are in (first frame)
      el.style.fontSize = '140px'; const w0 = el.offsetWidth;
      const fs = Math.max(56, Math.min(maxSize, Math.floor(140 * room / Math.max(1, w0))));
      el.style.fontSize = fs + 'px'; el.style.textAlign = s === 'left' ? 'right' : 'left';
      const hh = lines.length * fs * 0.92, yc = Math.min(h.top + 190, 950 - hh / 2);   // stay above y 960 (button column)
      el.style.top = (yc - hh / 2).toFixed(0) + 'px';
      if (s === 'left') el.style.right = Math.min(1080 - 36 - el.offsetWidth * 0 , 1080 - (L + tuck)).toFixed(0) + 'px';
      else el.style.left = Math.max(36, Rr - tuck).toFixed(0) + 'px';
      const r = el.getBoundingClientRect();                                        // keep it on screen
      if (r.left < 36) { el.style.right = ''; el.style.left = '36px'; }
      if (r.right > 1044) { el.style.left = ''; el.style.right = '36px'; }
      placed = true;
    };
    BEAT.custom((t) => {
      const on = t >= at && t < until; el.style.display = on ? 'block' : 'none'; if (!on) return;
      if (!placed) place();
      [...el.children].forEach((sp, i) => { const t0 = times ? times[i] : at + 0.07 * i, k = window.ANT ? ANT.bounce(t - t0) : FX.spring(t - t0);
        sp.style.opacity = (FX.clamp((t - t0) / 0.07) * FX.clamp((until - t) / 0.12)).toFixed(3);
        sp.style.transform = `translateX(${((1 - k) * (s === 'left' ? -60 : 60)).toFixed(1)}px)`; });
    });
    return el;
  }

  // ---- kinetic hook title behind the head (lines drop in letter by letter); big bold word behind the head
  function hook({ lines, at, until, size = 150, top = null, color = 'var(--ink)', gap = 0.18, halo = true }) {
    // the last line tucks ~35% behind the head; earlier lines stack above it
    const H = window.HEADS, base = top ?? (H ? Math.max(STYLE.safe_area.top + 20, ANT.headTop(at, until) - size * (lines.length * 0.95 - 0.35)) : 330);
    lines.forEach((l, i) => ANT.impact({ text: l, at: at + gap * i, until, size, top: Math.round(base + i * size * 0.95), color, halo }));
    suppress(at - 0.02, until);
  }
  function big({ text, at, until, size = 230, color = 'var(--ink)', halo = true }) { suppress(at - 0.02, until); return ANT.impact({ text, at, until, size, color, halo }); }

  // ---- Claude-style desktop window floating behind the head (full frame); types the prompt, then shows status lines
  // brand: 'claude' (warm Claude-desktop look) | 'neutral' (generic app, e.g. Codex: no Claude mark, ink accent)
  function app({ at, until, prompt = '', typeAt = at + 0.4, typeEnd = typeAt + 1.6, status = [], top = 250, height = 640, brand = 'claude',
                 crumb = 'Reels  /  New chat', recents = ['Q4 scripts', 'Hook research', 'Carousel ideas', 'Thumbnail tests'],
                 greet = brand === 'claude' ? 'What are we making today?' : 'What should we build?', newLabel = brand === 'claude' ? '+ New chat' : '+ New task',
                 nav = brand === 'claude' ? ['Chats', 'Projects', 'Reels'] : ['Tasks', 'Projects', 'Storefront'] }) {
    const accent = brand === 'claude' ? '#c96442' : '#1f1f1f';
    const el = document.createElement('div'); el.className = 'ui sigapp'; el.dataset.role = 'behind';   // behind the head on purpose
    el.innerHTML = `<div class="bar"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i><span class="crumb">${esc(crumb)}</span></div>
      <div class="side"><div class="new" style="color:${accent}">${esc(newLabel)}</div>${nav.map((n, i) => `<div class="${i === nav.length - 1 ? 'on' : ''}">${esc(n)}</div>`).join('')}<div style="margin-top:14px;color:#8d8a7b;font-size:18px">Recents</div>${recents.map((r) => `<div>${esc(r)}</div>`).join('')}</div>
      <div class="main"><div class="hi">${brand === 'claude' ? STAR : ''}${esc(greet)}</div><div class="stat">${status.map((s) => `<div><span class="spin"></span><span>${esc(s.text)}</span></div>`).join('')}</div>
      <div class="box"><span class="ph">How can I help you today?</span><span class="tx"></span><i class="caret"></i><div class="send" style="background:${accent}"><svg viewBox="0 0 24 24" width="24" height="24"><path fill="#fff" d="M12 4l7 7h-4.5v9h-5v-9H5z"/></svg></div></div></div>`;
    Object.assign(el.style, { top: top + 'px', height: height + 'px' });
    // behind the head: under ANT's cutout layer, above the footage / layout base layers
    if (!document.getElementById('fg')) ANT.impact({ text: ' ', at: -1, until: -0.5 });   // creates the cutout layer
    stage.insertBefore(el, document.getElementById('fg'));
    ANT.impacts.push({ at, until, cut: true, text: 'app window' });            // needs the cutout on these frames too
    const tx = el.querySelector('.tx'), ph = el.querySelector('.ph'), caret = el.querySelector('.caret'), st = el.querySelector('.stat');
    BEAT.custom((t) => {
      if (!FX.pop(el, t, at, until)) return;
      const n = Math.round(FX.clamp((t - typeAt) / (typeEnd - typeAt)) * prompt.length);
      tx.textContent = prompt.slice(0, n); ph.style.display = n ? 'none' : 'inline';
      caret.style.display = t < typeEnd + 0.3 ? 'inline-block' : 'none';
      const shown = status.filter((s) => t >= s.at);
      st.style.display = shown.length ? 'flex' : 'none';
      [...st.children].forEach((d, i) => { d.style.display = t >= status[i].at ? 'flex' : 'none'; });
    });
    return el;
  }

  // ---- kinetic hook: a justified two-line block behind the head.
  // Line 1 TYPES on (about a letter per frame, each letter rising out of its baseline, underscore cursor leading); line 2
  // SLAMS in whole (bigger, same width); short hold; SLICE exit: each letter splits into 3 horizontal strips that shear
  // sideways and vanish, left to right. lines: [{ text, at, mode: 'type'|'slam' }]. Captions are off underneath.
  function kinetic({ lines, until, width = 960, color = 'var(--ink)', cursor = true, rate = 0.034, exit = 'slice', halo = false, top = null, gap = 0.02, tuck = 0.8 }) {
    if (!document.getElementById('fg')) ANT.impact({ text: ' ', at: -1, until: -0.5 });   // creates the cutout layer
    const el = document.createElement('div'); el.className = 'sigk'; el.style.cssText = 'position:absolute;left:0;top:0';   // plain wrapper; each line is audited
    el.style.color = color; if (halo) el.style.textShadow = '0 0 22px rgba(247,246,243,.9), 0 0 8px rgba(247,246,243,.8)';
    stage.insertBefore(el, document.getElementById('fg'));
    const at0 = lines[0].at;
    ANT.impacts.push({ at: at0, until, cut: true, text: 'kinetic hook' });
    suppress(at0 - 0.02, until + 0.26);   // captions return once the exit has finished
    const L = lines.map((ln) => {
      const d = document.createElement('div'); d.className = 'ui ln'; d.dataset.role = 'behind';
      d.innerHTML = [...ln.text].map((c) => c === ' ' ? '<span class="ch sp">&nbsp;</span>'
        : `<span class="ch"><b>${esc(c)}</b><i style="clip-path:inset(0 0 66% 0)">${esc(c)}</i><i style="clip-path:inset(33% 0 33% 0)">${esc(c)}</i><i style="clip-path:inset(66% 0 0 0)">${esc(c)}</i></span>`).join('');
      if (ln.mode !== 'slam' && cursor) d.insertAdjacentHTML('beforeend', '<span class="cur" style="background:' + color + '"></span>');
      el.appendChild(d);
      return { ...ln, el: d, chars: [...d.querySelectorAll('.ch')], cur: d.querySelector('.cur') };
    });
    let laid = false;
    const layout = () => {                     // every line scaled to the same width (justified block); stacked above the head
      let y = 0; const tops = [];
      L.forEach((ln) => { ln.el.style.fontSize = '100px'; const w = ln.el.scrollWidth || 1;
        ln.fs = Math.max(60, Math.min(260, 100 * width / ln.chars.reduce((s, c) => s + c.offsetWidth, 0) || 100));
        ln.el.style.fontSize = ln.fs.toFixed(1) + 'px'; void w; tops.push(y); y += ln.fs * 0.84 + ln.fs * gap; });
      const total = y, head = window.HEADS ? ANT.headTop(at0, until) : 720;
      const base = top ?? Math.max(STYLE.safe_area.top + 16, head - total + L[L.length - 1].fs * 0.84 * tuck);   // the head covers the bottom of the last line (tuck 0-1)
      L.forEach((ln, i) => { ln.el.style.top = (base + tops[i]).toFixed(1) + 'px'; });
      laid = true;
    };
    const easeOut = (x) => 1 - Math.pow(1 - x, 3);
    BEAT.custom((t) => {
      const on = t >= at0 - 0.01 && t < until + 0.25; L.forEach((ln) => { ln.el.style.display = on ? 'block' : 'none'; }); if (!on) return;
      if (!laid) layout();
      let order = 0; const nAll = L.reduce((s, ln) => s + ln.chars.length, 0);
      L.forEach((ln) => {
        const n = ln.chars.length;
        ln.chars.forEach((c, i) => {
          const k = order++;
          // ---- in
          let p, dy, sc = 1;
          if (ln.mode === 'slam') { p = FX.clamp((t - ln.at) / 0.1); sc = 1.22 - 0.22 * easeOut(p); dy = 0; }
          else { const t0 = ln.at + rate * i; p = FX.clamp((t - t0) / 0.07); dy = (1 - easeOut(p)) * 0.55; }
          // ---- out (slice): strips shear apart, staggered left -> right across the whole block
          const t1 = until + (k / Math.max(1, nAll - 1)) * 0.16, q = exit === 'slice' ? FX.clamp((t - t1) / 0.08) : 0;
          const vis = p > 0 && q < 1;
          c.style.visibility = vis ? 'visible' : 'hidden';
          if (!vis) return;
          c.style.opacity = (Math.min(1, p * 2.5) * (1 - q)).toFixed(3);
          c.style.transform = `translateY(${(dy * 100).toFixed(1)}%) scale(${sc.toFixed(3)})`;
          const s = c.children;   // b, i, i, i (spaces have none)
          if (s.length === 4) [1, 2, 3].forEach((j, jj) => { const dir = jj === 1 ? 1 : -1; s[j].style.transform = `translateX(${(dir * q * (60 + 40 * jj)).toFixed(1)}px)`; });
        });
        if (ln.cur) {   // cursor sits right after the last typed letter; hides shortly after the line finishes
          const typed = ln.chars.filter((c, i) => t >= ln.at + rate * i).length, done = ln.at + rate * n;
          const show = t >= ln.at - 0.03 && t < done + 0.12;
          ln.cur.style.display = show ? 'block' : 'none';
          if (show) { const last = ln.chars[Math.max(0, typed - 1)], x = typed ? last.offsetLeft + last.offsetWidth : ln.chars[0].offsetLeft;
            ln.cur.style.left = (x + 0.04 * ln.fs).toFixed(1) + 'px'; }
        }
      });
    });
    return el;
  }

  // ---- DM conversation (Instagram/Threads style): messages pop in on their words; a typing indicator before each reply.
  // with: { name, handle, initials | avatar }; messages: [{ from: 'me'|'them', text, at, react? }]
  function dm({ with: who, messages, at, until, top = 210, height = 500 }) {
    const el = document.createElement('div'); el.className = 'ui sigdm';
    el.innerHTML = `<div class="top"><div class="av">${who.avatar ? `<img src="${who.avatar}">` : esc(who.initials || who.name[0])}</div><div><b>${esc(who.name)}</b><span>${esc(who.handle || '')}</span></div></div>
      <div class="body">${messages.map((m) => `<div class="dots" data-for="${m.from}"><i></i><i></i><i></i></div><div class="msg ${m.from}">${esc(m.text)}</div>`).join('')}</div>`;
    el.style.top = top + 'px'; el.style.height = height + 'px';
    stage.insertBefore(el, CAP);
    const msgs = [...el.querySelectorAll('.msg')], dots = [...el.querySelectorAll('.dots')];
    BEAT.custom((t) => {
      if (!FX.pop(el, t, at, until)) return;
      messages.forEach((m, i) => {
        const prev = i ? messages[i - 1].at + 0.25 : -1e9;                      // "..." before a reply, never overlapping the last message
        const typing = m.from === 'them' && t >= Math.max(m.at - 0.9, prev) && t < m.at;
        dots[i].style.display = typing ? 'flex' : 'none';
        if (typing) [...dots[i].children].forEach((d, k) => { d.style.opacity = (0.35 + 0.65 * Math.max(0, Math.sin((t * 6 - k * 0.9)))).toFixed(2); });
        const on = t >= m.at; msgs[i].style.display = on ? 'block' : 'none';
        if (on) { const s = FX.spring(t - m.at); msgs[i].style.opacity = FX.clamp((t - m.at) / 0.1).toFixed(3);
          msgs[i].style.transform = `scale(${(0.86 + 0.14 * s).toFixed(3)})`; }
      });
    });
    return el;
  }

  window.SIG = { setup, twoTier, side, hook, big, app, kinetic, dm };
})();
