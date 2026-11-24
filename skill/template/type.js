// type.js: TXT.show, styled text whose looks live in the style (style.json "text" presets), so a creator's titles,
// labels, big numbers, text cards and code lines look the same in every edit. Loaded after runtime.js.
//
//   TXT.show({ lines, at, until, preset = 'title', top = 300, left = null, width = 960, gap = 0.08 })
//     lines: ['Turning 30', { text: 'are you *done*?', preset: 'label', size: 60 }]   a line can switch preset or override
//            any key below; *word* = the preset's accent colour
//     top: y of the first line's top (keep it above the head and below y 192); left: null = centred, or the x of a
//     left-aligned block 'width' wide
//
// Preset keys (style.json → text → <name>), all optional:
//   font      'hook' | 'headline' | 'body' | 'serif' | 'mono' (the style's fonts) or a font name
//   weight, size_px, italic, case ('as_written' | 'upper' | 'lower'), tracking_em, line_height
//   color, accent (colour of *words*; a palette name like 'accent' or a hex colour)
//   outline_px, outline_color, shadow ('none' | 'soft' | 'strong' | any CSS text-shadow)
//   box (colour behind the block, e.g. 'paper' or '#000000cc'), box_radius, pad_px
//   align     'center' | 'left' (default: left inside a box, else the block's own alignment)
//   in        'pop' (spring in, whole line) | 'word' (word by word) | 'type' (letter by letter) | 'cut'
//   quiet     true = hide the captions while it's up (the text says the same thing)
(() => {
  const S = window.STYLE, PAL = window.PAL || {};
  const BASE = { font: 'hook', weight: 800, size_px: 96, italic: false, case: 'as_written', tracking_em: -0.03, line_height: 1.06,
    color: '#ffffff', accent: 'accent', outline_px: 0, outline_color: '#000000', shadow: 'soft', box: null, box_radius: 18, pad_px: 0,
    in: 'pop', quiet: true };
  const PRESETS = S.text || {};
  const SHADOWS = { none: 'none', soft: '0 3px 16px rgba(0,0,0,.45), 0 0 3px rgba(0,0,0,.3)', strong: '0 4px 18px rgba(0,0,0,.75), 0 0 5px rgba(0,0,0,.6)' };
  const FONTS = { hook: 'var(--font-hook)', headline: 'var(--font-head)', body: 'var(--font-body)', serif: 'var(--font-serif)', mono: 'var(--font-mono)' };
  const col = (c) => (c == null ? null : PAL[c] || c);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const stage = document.getElementById('stage'), CAP = document.getElementById('cap');
  const css = document.createElement('style');
  css.textContent = `.txt { white-space: nowrap; } .txt .ln { display: block; } .txt .w { display: inline-block; white-space: pre; }
.txt .box { display: inline-block; }`;
  document.head.appendChild(css);
  const suppress = (a, b) => { (window.CAP_SUPPRESS = window.CAP_SUPPRESS || []).push([a, b]); };

  function look(name, over = {}) {
    const p = { ...BASE, ...(PRESETS[name] || {}), ...over };
    if (!PRESETS[name] && !['title', 'label', 'number', 'card', 'code'].includes(name)) console.error(`TXT: no preset "${name}" in style.json text`);
    return p;
  }
  function lineCSS(p) {
    return [`font-family:${FONTS[p.font] || `"${p.font}"`}, sans-serif`, `font-weight:${p.weight}`, `font-size:${p.size_px}px`,
      `font-style:${p.italic ? 'italic' : 'normal'}`, `letter-spacing:${p.tracking_em}em`, `line-height:${p.line_height}`,
      `color:${col(p.color)}`, `text-transform:${{ upper: 'uppercase', lower: 'lowercase' }[p.case] || 'none'}`,
      `text-shadow:${p.box ? 'none' : SHADOWS[p.shadow] || p.shadow}`,
      p.outline_px ? `-webkit-text-stroke:${p.outline_px * 2}px ${col(p.outline_color)};paint-order:stroke fill` : ''].join(';');
  }
  function show({ lines, at, until, preset = 'title', top = 300, left = null, width = 960, gap = 0.08 }) {
    const L = lines.map((ln) => (typeof ln === 'string' ? { text: ln } : ln)).map((ln) => ({ ...ln, p: look(ln.preset || preset, ln) }));
    const p0 = L[0].p, el = document.createElement('div');
    el.className = 'ui txt';
    el.style.cssText = left == null ? `left:0;width:1080px;text-align:center;top:${top}px` : `left:${left}px;width:${width}px;text-align:left;top:${top}px`;
    const inner = L.map((ln, i) => { let on = false;   // *one or more words* = accent; a star inside a word (f*ck) stays
      return `<span class="ln" style="${lineCSS(ln.p)}">` + ln.text.split(/\s+/).map((raw) => {
        const open = raw.startsWith('*') && raw.length > 1, close = /.\*[.,!?:;'"]*$/.test(raw) && (open || on);
        const acc = on || open; on = acc && !close;
        const w = acc ? raw.replace(/^\*/, '').replace(/\*([.,!?:;'"]*)$/, '$1') : raw;
        return `<span class="w"${acc ? ` style="color:${col(ln.p.accent)}"` : ''}>${esc(w)}</span>`;
      }).join(' ') + '</span>'; }).join('');
    const al = p0.align || (p0.box ? 'left' : '');   // lines inside a box (terminal, card) line up on the left
    const bx = (p0.box ? `background:${col(p0.box)};border-radius:${p0.box_radius}px;padding:${p0.pad_px || Math.round(p0.size_px * 0.35)}px ${p0.pad_px || Math.round(p0.size_px * 0.55)}px;` : '') + (al ? `text-align:${al}` : '');
    el.innerHTML = `<div class="box" style="${bx}">${inner}</div>`;
    stage.insertBefore(el, CAP);
    if (L.some((ln) => ln.p.quiet)) suppress(at - 0.02, until);
    const lns = [...el.querySelectorAll('.ln')], words = lns.map((l) => [...l.querySelectorAll('.w')]);
    const texts = words.map((ws) => ws.map((w) => w.textContent));
    // sound cues: one pop as the text appears, plus typing under every line that types on (same timing as below)
    el.dataset.sfx = 'none';
    FX.cue('pop', at, { src: 'TXT.show' });
    L.reduce((t0, ln, i) => { const m = ln.p.in, n = texts[i].join(' ').length;
      if (m === 'type') FX.cue('type', t0, { dur: n * 0.035, src: 'TXT.show' });
      return t0 + (m === 'word' ? words[i].length * 0.12 : m === 'type' ? n * 0.035 : 0) + gap; }, at);
    BEAT.custom((t) => {
      if (!FX.pop(el, t, at, until, { origin: '50% 50%', base: '', disp: 'block' })) return;
      let t0 = at;
      lns.forEach((l, i) => {
        const mode = L[i].p.in;
        if (mode === 'word' || mode === 'type') {
          words[i].forEach((w, k) => {
            const tw = t0 + (mode === 'word' ? k * 0.12 : 0);
            if (mode === 'type') { const n = Math.max(0, Math.floor((t - t0) / 0.035) - texts[i].slice(0, k).join(' ').length);
              w.textContent = texts[i][k].slice(0, n); w.style.opacity = 1; }
            else { const s = FX.spring(t - tw); w.style.opacity = FX.clamp((t - tw) / 0.1).toFixed(3); w.style.transform = `translateY(${((1 - s) * 20).toFixed(1)}px)`; }
          });
          t0 += mode === 'word' ? words[i].length * 0.12 : texts[i].join(' ').length * 0.035;
        } else if (mode === 'cut') { l.style.opacity = t >= t0 ? 1 : 0; }
        else { const s = FX.spring(t - t0); l.style.opacity = FX.clamp((t - t0) / 0.1).toFixed(3); l.style.transform = `translateY(${((1 - s) * 22).toFixed(1)}px) scale(${(0.94 + 0.06 * s).toFixed(4)})`; }
        t0 += gap;
      });
    });
    return el;
  }
  window.TXT = { show, look };
})();
