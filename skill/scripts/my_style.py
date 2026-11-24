"""Put the creator's style together (Build my style, step 4) and keep it.

Usage ($PY = the skill's Python):
  my_style.py status                  the saved style (locked or not) and the reference videos (broken down or not)
  my_style.py compare [ref ...]       the reference videos' measured numbers side by side (default: every one that has a
                                      breakdown.md; a ref is its folder name or a unique part of it)
  my_style.py pick <group> --clip <video> [--at SEC] [--text "spoken words"]
                                      renders every option of <group> in my-style/options.json on the same frame of the
                                      creator's own clip -> my-style/pick-<group>.jpg (one labelled panel per option)
  my_style.py check                   checks my-style/style.json: colours, sizes, the safe area, fonts on this Mac
  my_style.py lock | unlock           lock after the creator approves the test stills; unlock to rebuild

Files in <workspace>/01_Styles/my-style/:
  style.md      the style in plain words (reference/style-builder.md says what goes in it)
  style.json    only the settings that differ from the skill's base style.json; every new edit starts from base + this
  options.json  the open choices while the style is being put together:
                {"captions": {"A": {"label": "One white word, chest height (video 1)",
                                    "style": {"captions": {"mode": "word", "size_px": 64}},
                                    "text": "words to show", "beats": "ANT.hook({ lines: ['...'], at: 0, until: 9 });"}}}
                `style` is merged over base + style.json for that panel only; `beats` is optional page code drawn at t=0
                (any building block; start at 0, shown at 2.5 s; until 9); `text` overrides --text for that panel.
  changes.md    dated lines for every change the creator makes permanent later
"""
import argparse
import datetime
import glob
import json
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)
sys.dont_write_bytecode = True
sys.path.insert(0, HERE)
import workspace  # noqa: E402

RE_HOME = os.environ.get("REEL_EDITOR_HOME", os.path.expanduser("~/.reel-editor"))
PAGE_FILES = ("index.html", "runtime.js", "icons.js", "components.js", "layouts.js", "signature.js", "editorial.js",
              "antstyles.js", "claudeui.js", "type.js")
BUNDLED_FONTS = {"tiktok sans", "inter", "hanken grotesk"}
SHOW = 75   # options are drawn from t=0 and shown at 2.5 s (30 fps), once every pop-in has landed


def merge(a, b):
    """b over a: dicts merge key by key, anything else is replaced."""
    out = dict(a)
    for k, v in b.items():
        out[k] = merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


def merge_style(base, over):
    """A style layered over another. A new accent without its lighter/darker shades drops the old shades, so the page
    works them out from the new accent instead of keeping the old ones."""
    out = merge(base, {k: v for k, v in over.items() if not k.startswith("_") and k != "locked"})
    pal = over.get("palette") or {}
    if "accent" in pal:
        for k in ("accent_light", "accent_dark", "key"):
            if k not in pal:
                out["palette"].pop(k, None)
    return out


def style_dir(required=True):
    ws, problem = workspace.current()
    if problem:
        if required:
            sys.exit(problem)
        return None
    return os.path.join(ws, "01_Styles", "my-style")


def load(with_mine=True):
    """(style, note): the skill's base style.json with the creator's my-style/style.json over it."""
    base = json.load(open(os.path.join(SKILL, "style.json")))
    d = style_dir(required=False) if with_mine else None
    p = os.path.join(d, "style.json") if d else None
    if not p or not os.path.exists(p):
        return base, "base look (no saved style yet)"
    mine = json.load(open(p))
    note = f"my style ({'locked ' + mine['locked'] if mine.get('locked') else 'not locked yet'}): {p}"
    return merge_style(base, mine), note


def refs_dir():
    ws, problem = workspace.current()
    if problem:
        sys.exit(problem)
    return os.path.join(ws, "01_Styles", "references")


def find_refs(names):
    allr = sorted(d for d in glob.glob(os.path.join(refs_dir(), "*")) if os.path.isfile(os.path.join(d, "source.json")))
    if not names:
        return [d for d in allr if os.path.exists(os.path.join(d, "breakdown.md"))]
    out = []
    for n in names:
        hit = [d for d in allr if n.lower() in os.path.basename(d).lower()]
        if len(hit) != 1:
            sys.exit(f"REF NOT FOUND: '{n}' matches {len(hit)} reference folders. Run: my_style.py status")
        out.append(hit[0])
    return out


def status():
    d = style_dir()
    sj = os.path.join(d, "style.json")
    if os.path.exists(sj):
        mine = json.load(open(sj))
        print(f"STYLE: {d} ({'LOCKED ' + mine['locked'] if mine.get('locked') else 'not locked yet'})")
    else:
        print(f"STYLE: none yet ({d}/style.json doesn't exist)")
    if os.path.exists(os.path.join(d, "options.json")):
        print("OPEN CHOICES: " + ", ".join(json.load(open(os.path.join(d, "options.json"))).keys()))
    print("REFERENCES:")
    for r in sorted(glob.glob(os.path.join(refs_dir(), "*"))):
        if not os.path.isfile(os.path.join(r, "source.json")):
            continue
        s = json.load(open(os.path.join(r, "source.json")))
        bd = "breakdown" if os.path.exists(os.path.join(r, "breakdown.md")) else "NO BREAKDOWN"
        why = f' why: "{s["why"]}"' if s.get("why") else ""
        only = f" only: {','.join(s['only'])}" if s.get("only") else ""
        print(f"  {os.path.basename(r)}  [{bd}]{why}{only}")


def compare(names):
    refs = find_refs(names)
    if len(refs) < 2:
        sys.exit("Need at least 2 broken-down reference videos to compare.")
    rows = [("", lambda a, s: s.get("creator", "?").lstrip("@")),
            ("frame", lambda a, s: a["file"].get("frame", "")),
            ("measured s", lambda a, s: f"{a['measured_s']:.0f}"),
            ("why", lambda a, s: (s.get("why") or "-")[:22]),
            ("only", lambda a, s: ",".join(s.get("only") or []) or "all"),
            ("cuts / 10 s", lambda a, s: a["pacing"]["cuts_per_10s"]),
            ("median shot s", lambda a, s: a["pacing"]["median_shot_s"]),
            ("words / min", lambda a, s: a["speech"]["words_per_min"]),
            ("pauses > .6 s", lambda a, s: a["speech"]["pauses_over_0_6s"]),
            ("speaker share", lambda a, s: a["framing"]["speaker_on_screen_share"]),
            ("speaker size", lambda a, s: a["framing"]["speaker_size_share_median"]),
            ("caption share", lambda a, s: (a.get("captions") or {}).get("on_screen_share", "-")),
            ("caption px", lambda a, s: (a.get("captions") or {}).get("line_height_px", "-")),
            ("caption y", lambda a, s: (a.get("captions") or {}).get("centre_y", "-")),
            ("words at once", lambda a, s: (a.get("captions") or {}).get("words_per_line", "-")),
            ("all caps", lambda a, s: (a.get("captions") or {}).get("all_caps_share", "-")),
            ("caption colour", lambda a, s: (a.get("captions") or {}).get("colour_on_dark", "-")),
            ("brightness", lambda a, s: a["look"]["brightness_0_255"]),
            ("saturation", lambda a, s: a["look"]["saturation_0_255"]),
            ("palette", lambda a, s: " ".join(c for c, _ in a["look"]["palette"][:3])),
            ("music", lambda a, s: re.sub(r"\s*\(.*?\)", "", a["audio"]["music_bed"])[:26]),
            ("sfx hits", lambda a, s: len(a["audio"]["likely_sfx_s"]))]
    cols = []
    for r in refs:
        a = json.load(open(os.path.join(r, "analysis.json")))
        s = json.load(open(os.path.join(r, "source.json")))
        cols.append([str(f(a, s)) for _, f in rows])
    w0 = max(len(n) for n, _ in rows)
    ws = [max(len(c[k]) for k in range(len(rows))) for c in cols]
    for i, (n, _) in enumerate(rows):
        print(n.ljust(w0) + "  " + "  ".join(c[i].ljust(ws[j])[:28] for j, c in enumerate(cols)))
    print("\nThe numbers only. Each breakdown.md says what they mean and which building block makes it here.")


def grab_frame(clip, at, out):
    info = json.loads(subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", clip],
                                     capture_output=True, text=True).stdout or "{}")
    v = next((s for s in info.get("streams", []) if s.get("codec_type") == "video"), None)
    if not v:
        sys.exit(f"No video in {clip}")
    dur = float(info["format"]["duration"])
    at = dur / 2 if at is None else min(max(0.0, at), max(0.0, dur - 0.05))
    vf = "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920"
    if v.get("color_transfer") in ("arib-std-b67", "smpte2084"):
        vf = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p," + vf
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{at:.3f}", "-i", clip, "-frames:v", "1", "-vf", vf, "-q:v", "2", out],
                       capture_output=True, text=True)
    if r.returncode or not os.path.exists(out):
        sys.exit(f"Couldn't grab a frame at {at:.1f}s from {clip}:\n{r.stderr[-800:]}")
    return at


def words_at(clip, at):
    """The creator's own words around `at`, when an edit folder with a transcript exists for this clip."""
    for p in glob.glob(os.path.join(os.path.dirname(os.path.abspath(clip)), "*-edit", "data", "words.json")) + \
            glob.glob(os.path.join(os.path.dirname(os.path.abspath(clip)), "edit", "data", "words.json")):
        ws = json.load(open(p))
        near = [w["w"] for w in ws if at - 0.2 <= w["s"] <= at + 1.2]
        if near:
            return " ".join(near[:3])
    return None


def pick(group, clip, at, text):
    d = style_dir()
    op = os.path.join(d, "options.json")
    if not os.path.exists(op):
        sys.exit(f"NO OPTIONS: write {op} first (format at the top of this script).")
    opts = json.load(open(op)).get(group)
    if not opts:
        sys.exit(f"NO OPTIONS for '{group}' in {op}. Groups there: {', '.join(json.load(open(op)).keys())}")
    clip = os.path.abspath(clip)
    if not os.path.exists(clip):
        sys.exit(f"Clip not found: {clip}")
    base, _ = load()
    work = os.path.join(d, ".pick", group)
    shutil.rmtree(work, ignore_errors=True)
    os.makedirs(work)
    frame = os.path.join(work, "frame.jpg")
    at = grab_frame(clip, at, frame)
    text = text or words_at(clip, at) or "this changed everything"
    manifest = []
    for key, o in opts.items():
        st = merge_style(base, o.get("style", {}))
        st["fps"] = 30
        pdir = os.path.join(work, key)
        for sub in ("page", "frames"):
            os.makedirs(os.path.join(pdir, sub), exist_ok=True)
        for f in PAGE_FILES:
            shutil.copy2(os.path.join(SKILL, "template", f), os.path.join(pdir, "page", f))
        shutil.copytree(os.path.join(SKILL, "fonts"), os.path.join(pdir, "page", "fonts"), dirs_exist_ok=True)
        shutil.copytree(os.path.join(SKILL, "template", "assets"), os.path.join(pdir, "page", "assets"), dirs_exist_ok=True)
        shutil.copy2(frame, os.path.join(pdir, "frames", f"{SHOW:05d}.jpg"))
        t = o.get("text", text)
        tw = t.split()
        if st["captions"].get("mode") in ("word", "bold", "small"):
            t = max(tw, key=len) if tw else t
        words = [{"w": w, "s": round(i * 0.3, 2), "e": round(i * 0.3 + 0.28, 2)} for i, w in enumerate(tw)]
        json.dump({"fps": 30, "nframes": SHOW + 1}, open(os.path.join(pdir, "project.json"), "w"))
        open(os.path.join(pdir, "page", "data.js"), "w").write(
            f"window.STYLE={json.dumps(st)};window.NFRAMES={SHOW + 1};window.WORDS={json.dumps(words)};"
            f"window.CAPS={json.dumps([{'s': 0, 'e': 10, 't': t}])};")
        open(os.path.join(pdir, "page", "heads.js"), "w").write("window.HEADS=null;")
        open(os.path.join(pdir, "page", "cuts.js"), "w").write("window.CUTS=[];")
        open(os.path.join(pdir, "page", "beats.js"), "w").write(o.get("beats", "") + "\n")
        fonts = sorted({st["captions"]["font_family"], *(v for k, v in st.get("fonts", {}).items() if not k.startswith("_"))})
        manifest.append({"dir": pdir, "key": key, "label": o.get("label", key), "fonts": fonts, "frame": SHOW})
    out = os.path.join(d, f"pick-{group}.jpg")
    json.dump(manifest, open(os.path.join(work, "manifest.json"), "w"), indent=1)
    r = subprocess.run(["node", os.path.join(HERE, "pick.mjs"), os.path.join(work, "manifest.json"), out], text=True)
    if r.returncode:
        sys.exit("Rendering the options failed (see above).")
    print(f"{len(manifest)} options at {at:.1f}s of {os.path.basename(clip)} -> {out}")


def check():
    d = style_dir()
    p = os.path.join(d, "style.json")
    if not os.path.exists(p):
        sys.exit(f"NO STYLE: {p} doesn't exist yet.")
    try:
        mine = json.load(open(p))
    except ValueError as e:
        sys.exit(f"BROKEN: {p} isn't valid JSON: {e}")
    st, _ = load()
    bad, warn = [], []
    hexre = re.compile(r"^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
    for k, v in (mine.get("palette") or {}).items():
        if not isinstance(v, str) or not hexre.match(v):
            bad.append(f"palette.{k} = {v!r}: use a hex colour like #d9fd0d")
    C, SAFE = st["captions"], st["safe_area"]
    if C.get("color") and not hexre.match(str(C["color"])):
        bad.append(f"captions.color = {C['color']!r}: use a hex colour")
    if not 28 <= C["size_px"] <= 160:
        bad.append(f"captions.size_px {C['size_px']}: keep it between 28 and 160")
    half = C["size_px"] * C.get("line_height", 1.12) / 2
    if not SAFE["top"] + half <= C["center_y"] <= SAFE["bottom"] - half:
        bad.append(f"captions.center_y {C['center_y']}: the caption would cross into the TikTok/Reels zones "
                   f"(keep it between {SAFE['top'] + half:.0f} and {SAFE['bottom'] - half:.0f})")
    if C["center_y"] < 1100:
        warn.append(f"captions.center_y {C['center_y']} is high: check stills that it stays off the face")
    for k, ok in (("mode", ("chunk", "word", "bold", "small", "off")), ("case", ("as_spoken", "upper", "lower", None)),
                  ("animation", ("cut", "pop", None))):
        if C.get(k) not in ok and not (k == "mode" and C.get(k) is None):
            bad.append(f"captions.{k} = {C.get(k)!r}: one of {', '.join(str(x) for x in ok if x)}")
    if not 1 <= C["max_words"] <= 5:
        bad.append(f"captions.max_words {C['max_words']}: 1 to 5")
    if C.get("mode") == "off":
        warn.append("captions are off: most people watch muted; say so to the creator")
    fonts = {C["font_family"], *(v for k, v in (st.get("fonts") or {}).items() if not k.startswith("_"))}
    have = installed_fonts()
    for f in sorted(fonts):
        if f.lower() not in BUNDLED_FONTS and have and not any(re.sub(r"\s", "", f.lower()) in h for h in have):
            bad.append(f"font '{f}' isn't on this Mac (bundled: TikTok Sans, Inter, Hanken Grotesk; or a Mac font like "
                       f"Baskerville, Futura, Avenir Next, Didot, Helvetica Neue, Georgia, Menlo)")
    A = st.get("audio") or {}
    from sound_kit import ROLES   # the sound kit's roles (scripts/sound_kit.py)
    for r in A.get("sfx_roles") or []:
        if r not in ROLES:
            bad.append(f"audio.sfx_roles has '{r}': not a sound role (roles: {' '.join(ROLES)})")
    if A.get("sfx_intensity", "balanced") not in ("subtle", "balanced", "punchy"):
        bad.append(f"audio.sfx_intensity = {A.get('sfx_intensity')!r}: subtle, balanced or punchy")
    if not isinstance(A.get("voice_polish", True), bool):
        bad.append(f"audio.voice_polish = {A.get('voice_polish')!r}: true or false")
    for x in warn:
        print("WARNING:", x)
    if bad:
        print("\n".join("PROBLEM: " + x for x in bad))
        sys.exit(1)
    print(f"STYLE OK: {p}")


def installed_fonts():
    names = set()
    for root in ("/System/Library/Fonts", "/System/Library/Fonts/Supplemental", "/Library/Fonts",
                 os.path.expanduser("~/Library/Fonts")):
        for f in glob.glob(os.path.join(root, "*")):
            names.add(re.sub(r"[\s_-]", "", os.path.splitext(os.path.basename(f))[0].lower()))
    if names:   # system fonts whose file names don't say their family
        names |= {"sfpro", "sfprodisplay", "sfprotext", "sfmono", "newyork"}
    return names


def lock(on):
    d = style_dir()
    p = os.path.join(d, "style.json")
    if not os.path.exists(p):
        sys.exit(f"NO STYLE: {p} doesn't exist yet.")
    mine = json.load(open(p))
    md = os.path.join(d, "style.md")
    text = open(md).read() if os.path.exists(md) else ""
    text = re.sub(r"^\*\*Locked\*\*.*\n\n?", "", text, flags=re.M)
    if on:
        day = datetime.date.today().isoformat()
        mine["locked"] = day
        text = re.sub(r"^(# .*\n)", rf"\1\n**Locked** {day} after the test stills. Rebuild or change it any time.\n", text, count=1) \
            if text.startswith("# ") else f"**Locked** {day} after the test stills.\n\n" + text
        print(f"LOCKED {day}: every new edit starts from this style.")
    else:
        mine.pop("locked", None)
        print("UNLOCKED: rebuild it, then lock again after new test stills.")
    json.dump(mine, open(p, "w"), indent=2)
    open(md, "w").write(text)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status")
    c = sub.add_parser("compare")
    c.add_argument("refs", nargs="*")
    p = sub.add_parser("pick")
    p.add_argument("group")
    p.add_argument("--clip", required=True)
    p.add_argument("--at", type=float)
    p.add_argument("--text")
    sub.add_parser("check")
    sub.add_parser("lock")
    sub.add_parser("unlock")
    a = ap.parse_args()
    if a.cmd == "status":
        status()
    elif a.cmd == "compare":
        compare(a.refs)
    elif a.cmd == "pick":
        pick(a.group, a.clip, a.at, a.text)
    elif a.cmd == "check":
        check()
    else:
        lock(a.cmd == "lock")


if __name__ == "__main__":
    main()
