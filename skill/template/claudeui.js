// claudeui.js: Claude desktop app mockups for "tell Claude..." moments (Ant, 2026-11-02: "pretty close to looking like that
// UI"). Built from the real app's layout: macOS title bar with the chat title and Share, user messages in a beige bubble on
// the right, Claude's replies as plain text with the orange spark under the latest one, and the message box at the bottom
// (+ and tools on the left; model, mic and the orange send button on the right). Replies use the app's sans chat font
// (Ant never uses serif). Dictation per Anthropic's docs: the mic on the right of the message box highlights, the
// placeholder reads "Listening...", and the words appear in the box as they're spoken.
//
//   CLD.chat({ at, until, messages, title, greet, fresh: true, theme: 'light'|'dark', chrome: 'window'|'bare', left, top, width, height })
//     fresh: starts on the new-chat screen (greeting, message box in the middle); when the first message is sent the box
//     drops to the bottom and the title changes, like the app
//     messages: [{ from: 'me', text, at, type: [start, end] }   typed into the box from start to end, sent at `at`
//                { from: 'claude', text, at, think: 0.5, stream: 1.0 }]   spark thinks for `think` s, then streams the text
//   CLD.dictate({ at, until, listenAt, words: [[text, t], ...], greet, theme, chrome, box: 'only'|'window', left, top, width, height })
(() => {
  const css = document.createElement('style');
  css.textContent = `
.cld { position: absolute; overflow: hidden; border-radius: 28px; font-family: "Inter", -apple-system, sans-serif; display: none;
  box-shadow: 0 0 0 1px rgba(0,0,0,.10), 0 40px 90px -30px rgba(0,0,0,.6); --bg: #faf9f5; --ink: #141413; --mute: #73726c; --ph: #9c9a92;
  --bub: #f0eee6; --box: #ffffff; --line: rgba(31,30,29,.14); --acc: #c6613f; --spark: #d97757; background: var(--bg); color: var(--ink); }
.cld.dark { --bg: #262624; --ink: #faf9f5; --mute: #a6a39a; --ph: #8d8b84; --bub: #141413; --box: #30302e; --line: rgba(222,220,209,.15); }
.cld .bar { position: absolute; left: 0; right: 0; top: 0; height: 74px; display: flex; align-items: center; padding: 0 24px; gap: 12px; }
.cld .bar i { width: 17px; height: 17px; border-radius: 50%; flex: none; }
.cld .bar .side { margin-left: 18px; width: 30px; height: 30px; } .cld .bar .side path { stroke: var(--mute); }
.cld .bar .ttl { position: absolute; left: 0; right: 0; text-align: center; font-size: 25px; font-weight: 500; color: var(--ink); letter-spacing: -0.01em; pointer-events: none; }
.cld .bar .ttl svg { width: 18px; height: 18px; vertical-align: -1px; margin-left: 6px; } .cld .bar .ttl svg path { stroke: var(--mute); }
.cld .bar .share { margin-left: auto; padding: 8px 20px; border-radius: 12px; border: 1.5px solid var(--line); font-size: 22px; font-weight: 500; color: var(--ink); position: relative; }
.cld .feed { position: absolute; left: 0; right: 0; display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden; padding: 0 34px; }
.cld .msg { overflow: hidden; flex: none; } .cld .msg > div { padding-top: 26px; }
.cld .me > div { display: flex; justify-content: flex-end; }
.cld .me p { margin: 0; max-width: 82%; padding: 18px 24px; border-radius: 24px; background: var(--bub); font-size: 31px; line-height: 1.38; letter-spacing: -0.01em; }
.cld .ai p { margin: 0; font-size: 31px; line-height: 1.5; letter-spacing: -0.01em; white-space: pre-line; padding-right: 20px; }
.cld .ai .sp { width: 40px; height: 40px; margin-top: 14px; display: none; }
.cld .spark path { fill: var(--spark); }
.cld .box { position: absolute; left: 26px; right: 26px; bottom: 26px; border-radius: 26px; background: var(--box); border: 1.5px solid var(--line);
  box-shadow: 0 10px 30px -16px rgba(0,0,0,.28); padding: 22px 24px 18px; }
.cld .box .tx { min-height: 44px; font-size: 30px; line-height: 1.42; color: var(--ink); letter-spacing: -0.01em; }
.cld .box .tx .ph { color: var(--ph); } .cld .box .caret { display: inline-block; width: 2.5px; height: 34px; background: var(--ink); vertical-align: -6px; margin-left: 2px; }
.cld .box .row { display: flex; align-items: center; gap: 12px; margin-top: 14px; }
.cld .box .ic { width: 50px; height: 50px; border-radius: 13px; border: 1.5px solid var(--line); display: grid; place-items: center; flex: none; }
.cld .box .ic svg { width: 26px; height: 26px; } .cld .box .ic path, .cld .box .ic circle, .cld .box .ic rect { stroke: var(--mute); fill: none; }
.cld .box .model { margin-left: auto; font-size: 23px; color: var(--mute); display: flex; align-items: center; gap: 6px; }
.cld .box .model svg { width: 16px; height: 16px; } .cld .box .model path { stroke: var(--mute); }
.cld .box .mic { border: none; width: 50px; height: 50px; border-radius: 13px; display: grid; place-items: center; position: relative; }
.cld .box .mic svg { width: 28px; height: 28px; position: relative; } .cld .box .mic path, .cld .box .mic rect { stroke: var(--mute); fill: none; }
.cld .box .mic.on { background: rgba(198,97,63,.14); } .cld .box .mic.on path, .cld .box .mic.on rect { stroke: var(--acc); }
.cld .box .mic .ring { position: absolute; inset: 0; border-radius: 13px; box-shadow: 0 0 0 0 rgba(198,97,63,.35); }
.cld .box .send { width: 52px; height: 52px; border-radius: 14px; background: var(--acc); display: grid; place-items: center; flex: none; }
.cld .box .send svg { width: 26px; height: 26px; } .cld .box .send path { stroke: #fff; fill: none; }
.cld .hello { position: absolute; left: 0; right: 0; text-align: center; font-size: 46px; font-weight: 500; letter-spacing: -0.02em; display: flex; justify-content: center; align-items: center; gap: 16px; }
.cld .hello svg { width: 50px; height: 50px; }
.cld .me p, .cld .ai p { font-size: 33px; }`;
  document.head.appendChild(css);
  const stage = document.getElementById('stage'), CAP = document.getElementById('cap');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ease = (x) => x * x * (3 - 2 * x);
  // the spark: 12 rounded rays of uneven length around a small hub
  const SPARK = (() => {
    const L = [10.5, 8.2, 10, 7.6, 10.8, 8.4, 9.6, 7.8, 10.6, 8, 10.2, 7.4];
    const d = L.map((len, i) => { const a = (i / 12) * Math.PI * 2 - Math.PI / 2, w = 1.25, c = Math.cos(a), s = Math.sin(a), px = -s * w, py = c * w;
      const x1 = 12 + c * 1.2, y1 = 12 + s * 1.2, x2 = 12 + c * len, y2 = 12 + s * len;
      return `M${(x1 + px).toFixed(2)} ${(y1 + py).toFixed(2)} L${(x2 + px * 0.55).toFixed(2)} ${(y2 + py * 0.55).toFixed(2)} A${(w * 0.55).toFixed(2)} ${(w * 0.55).toFixed(2)} 0 0 0 ${(x2 - px * 0.55).toFixed(2)} ${(y2 - py * 0.55).toFixed(2)} L${(x1 - px).toFixed(2)} ${(y1 - py).toFixed(2)} Z`; }).join(' ');
    return `<svg class="spark" viewBox="0 0 24 24"><path d="${d}"/><circle cx="12" cy="12" r="2.2" style="fill:var(--spark)"/></svg>`;
  })();
  const I = {
    side: '<svg class="side" viewBox="0 0 24 24"><path d="M4 5h16v14H4zM9 5v14" fill="none" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke-width="2" stroke-linecap="round"/></svg>',
    tools: '<svg viewBox="0 0 24 24"><path d="M4 8h10M18 8h2M4 16h3M11 16h9" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="8" r="2" stroke-width="2"/><circle cx="9" cy="16" r="2" stroke-width="2"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" stroke-width="2"/><path d="M12 8v4l3 2" stroke-width="2" stroke-linecap="round"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3.5" width="6" height="11" rx="3" stroke-width="2"/><path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v2.5" stroke-width="2" stroke-linecap="round"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  const bar = (title) => `<div class="bar"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i>${I.side}
    <div class="ttl">${esc(title)}${I.chev}</div><div class="share">Share</div></div>`;
  const box = (model) => `<div class="box"><div class="tx"></div><div class="row"><div class="ic">${I.plus}</div><div class="ic">${I.tools}</div><div class="ic">${I.clock}</div>
    <div class="model">${esc(model)}${I.chev}</div><div class="mic"><i class="ring"></i>${I.mic}</div><div class="send">${I.up}</div></div></div>`;
  function frame({ at, until, theme, chrome, left, top, width, height, title, model, cls = '' }) {
    const el = document.createElement('div'); el.className = `ui cld ${theme} ${cls}`;
    el.innerHTML = (chrome === 'window' ? bar(title) : '') + box(model);
    Object.assign(el.style, { left: left + 'px', top: top + 'px', width: width + 'px', height: height + 'px' });
    stage.insertBefore(el, CAP);
    return el;
  }
  // the message box: placeholder, typed text with a caret, or live dictation; the send button fades when there's nothing to send
  function boxState(el, t, { text = '', ph = 'Reply to Claude…', caret = false, listening = false, since = 0 }) {
    const tx = el.querySelector('.box .tx'), mic = el.querySelector('.mic'), send = el.querySelector('.send'), ring = el.querySelector('.ring');
    tx.innerHTML = text ? esc(text) + (caret ? '<i class="caret"></i>' : '') : `<span class="ph">${esc(ph)}</span>`;
    tx.scrollTop = tx.scrollHeight;                 // long dictation: keep the newest words in view
    send.style.opacity = text ? '1' : '0.45';
    mic.classList.toggle('on', listening);
    const pulse = listening ? (Math.sin((t - since) * 7) * 0.5 + 0.5) : 0;
    ring.style.boxShadow = `0 0 0 ${(pulse * 7).toFixed(1)}px rgba(198,97,63,${(0.28 * (1 - pulse * 0.6)).toFixed(3)})`;
  }

  // new-chat layout: q = 0 greeting + box in the middle of the window, q = 1 box at the bottom (a chat in progress)
  function place(el, q) {
    const b = el.querySelector('.box'), h = el.querySelector('.hello'), H = el.offsetHeight, bh = b.offsetHeight;
    const mid = H * 0.5 - bh * 0.3, bottom = 26 + (mid - 26) * (1 - q);
    b.style.top = 'auto'; b.style.bottom = bottom.toFixed(1) + 'px';
    if (h) { h.style.top = (H - bottom - bh - 120).toFixed(1) + 'px'; h.style.opacity = FX.clamp(1 - q * 2.5).toFixed(3); h.style.display = q < 1 ? 'flex' : 'none'; }
  }
  const hello = (el, greet) => { const h = document.createElement('div'); h.className = 'hello'; h.innerHTML = SPARK + esc(greet); el.appendChild(h); return h; };

  function chat({ at, until, messages, title = 'New chat', greet = 'Good evening', fresh = true, model = 'Opus 5.5', theme = 'light', chrome = 'window',
                  left = 110, top = 330, width = 780, height = 1090 }) {
    const el = frame({ at, until, theme, chrome, left, top, width, height, title: fresh ? 'New chat' : title, model });
    if (fresh) hello(el, greet);
    const ttl = el.querySelector('.ttl'), sent0 = fresh ? Math.min(...messages.filter((m) => m.from === 'me').map((m) => m.at)) : -1e9;
    const feed = document.createElement('div'); feed.className = 'feed'; el.insertBefore(feed, el.querySelector('.box'));
    const col = document.createElement('div'); col.style.cssText = 'flex:none;padding-bottom:24px'; feed.appendChild(col);
    feed.style.justifyContent = 'flex-start';     // like the app: the chat starts at the top and scrolls once it fills
    const M = messages.map((m) => {
      const w = document.createElement('div'); w.className = 'msg ' + (m.from === 'me' ? 'me' : 'ai');
      w.innerHTML = m.from === 'me' ? `<div><p>${esc(m.text)}</p></div>` : `<div><p></p><div class="sp">${SPARK}</div></div>`;
      col.appendChild(w);
      const think = m.from === 'me' ? 0 : (m.think ?? 0.5), stream = m.stream ?? Math.max(0.6, m.text.split(/\s+/).length * 0.06);
      return { ...m, w, inner: w.firstChild, p: w.querySelector('p'), sp: w.querySelector('.sp'), show: m.at - think, think, stream, words: m.text.split(/(\s+)/) };
    });
    const boxEl = el.querySelector('.box');
    el.dataset.role = 'cover';      // covers the speaker's face on purpose
    BEAT.custom((t) => {
      if (!FX.pop(el, t, at, until)) return;
      place(el, ease(FX.clamp((t - sent0) / 0.35)));
      if (ttl) ttl.firstChild.textContent = t >= sent0 ? title : 'New chat';
      feed.style.top = (chrome === 'window' ? 74 : 10) + 'px'; feed.style.bottom = (boxEl.offsetHeight + 40) + 'px';
      const lastAi = M.filter((m) => m.from === 'claude' && t >= m.show).pop();
      M.forEach((m) => { if (m.sp) {                          // the spark sits under Claude's latest reply; it turns while it thinks/writes
        const latest = m === lastAi; m.sp.style.display = latest ? 'block' : 'none'; if (!latest) return;
        const busy = t < m.at + m.stream; const s = m.sp.firstChild;
        s.style.transform = busy ? `rotate(${((t - m.show) * 140).toFixed(1)}deg) scale(${(0.86 + 0.14 * Math.sin((t - m.show) * 9)).toFixed(3)})` : 'none';
      } });
      M.forEach((m) => {
        const on = t >= m.show; m.w.style.display = on ? 'block' : 'none'; if (!on) return;
        if (m.from === 'claude') {
          const r = FX.clamp((t - m.at) / m.stream), n = Math.ceil(r * m.words.length);
          m.p.textContent = t < m.at ? '' : m.words.slice(0, n).join('');
          m.p.style.display = t < m.at ? 'none' : 'block';
        }
        const k = ease(FX.clamp((t - m.show) / 0.28));           // the message grows in, so the chat scrolls up smoothly
        m.w.style.height = (m.inner.offsetHeight * k).toFixed(1) + 'px'; m.inner.style.opacity = k.toFixed(3);
      });
      col.style.transform = `translateY(${(-Math.max(0, col.offsetHeight - feed.clientHeight)).toFixed(1)}px)`;
      // the message box: the next message of mine types in, then it's sent
      const typing = M.find((m) => m.from === 'me' && m.type && t >= m.type[0] && t < m.at);
      if (typing) { const n = Math.round(FX.clamp((t - typing.type[0]) / (typing.type[1] - typing.type[0])) * typing.text.length);
        boxState(el, t, { text: typing.text.slice(0, n), caret: Math.floor(t * 2.4) % 2 === 0 || n < typing.text.length }); }
      else boxState(el, t, {});
    });
    return el;
  }

  // dictation: box 'only' = just the message box (a card under the chin); 'window' = a new chat (greeting + the box)
  function dictate({ at, until, listenAt = at + 0.4, words = [], greet = 'Good evening', model = 'Opus 5.5', theme = 'light', chrome = 'window', box: mode = 'only',
                     left = 60, top = 1150, width = 830, height = null }) {
    const only = mode === 'only';
    const el = frame({ at, until, theme, chrome: only ? 'none' : chrome, left, top, width, height: height || 1090, title: 'New chat', model, cls: only ? 'only' : '' });
    if (only) { const b = el.querySelector('.box'); Object.assign(b.style, { position: 'relative', left: '0', right: '0', top: '0', bottom: '0', borderRadius: '28px', border: 'none', boxShadow: 'none' });
      el.style.background = 'var(--box)'; el.style.height = 'auto'; el.dataset.role = 'below';     // the card is just the box, as tall as its text
      Object.assign(el.querySelector('.tx').style, { maxHeight: '129px', overflow: 'hidden' }); }
    else { hello(el, greet); el.dataset.role = 'cover'; }
    BEAT.custom((t) => {
      if (!FX.pop(el, t, at, until)) return;
      if (!only) place(el, 0);
      const said = words.filter(([, wt]) => t >= wt).map(([w]) => w).join(' ');
      if (t < listenAt) boxState(el, t, { ph: 'How can I help you today?' });
      else boxState(el, t, { text: said, ph: 'Listening…', listening: true, since: listenAt, caret: !!said });
    });
    return el;
  }

  window.CLD = { chat, dictate, SPARK };
})();
