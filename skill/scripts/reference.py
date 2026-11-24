"""Reference videos for Build my style (SKILL.md): fetch a reel from a link or a file, then measure it so Claude can
break down its style with reference/style-breakdown.md.

Usage:
  python reference.py add "<link or file>" [--why "what you like"] [--only captions,pacing] [--link URL] [--creator NAME]
  python reference.py measure <reference folder>    measure again (e.g. after putting video.mp4 in the folder by hand)
  python reference.py list                          every reference: creator, why, aspects, measured, broken down

add makes <workspace>/01_Styles/references/<date>_<creator>_<id>/ (the same video added again reuses its folder),
downloads the video with yt-dlp (links) or copies it (files), writes source.md + source.json, then measures it.

measure writes into the reference folder (the video stays there, on this Mac, for study only):
  hook.jpg          the first 3 seconds, 4 frames a second
  shots-NN.jpg      one frame per shot (more for long shots), each labelled with its shot number and time
  data/words.json   the spoken words with times (transcribe.py)
  analysis.json     the numbers; analysis.md says them in plain words, with the transcript
Aspects (for --only): hook story pacing framing captions text broll look music sfx ending.
Every number is an estimate from the file; the contact sheets are there to check them by eye. Positions and sizes are
on a 1080x1920 frame, like the edits (landscape videos: a 1920x1080 frame). Long videos (a YouTube video, a podcast)
are downloaded and measured over their first 5 minutes only.
"""
import argparse
import datetime
import difflib
import glob
import hashlib
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True     # keep the skill folder clean (no __pycache__)
sys.path.insert(0, HERE)
import seg        # noqa: E402  (Apple Vision person masks, for framing)
import workspace  # noqa: E402

ASPECTS = ["hook", "story", "pacing", "framing", "captions", "text", "broll", "look", "music", "sfx", "ending"]
VIDEO_EXT = (".mp4", ".mov", ".m4v", ".webm", ".mkv")
LIMIT = 300.0            # seconds measured (and downloaded, for long videos)
FMT = "bv*[height<=1920][width<=1920]+ba/b[height<=1920][width<=1920]/b"    # 1080p is plenty; never 4K
BLOCKED_HINTS = ("login", "log in", "sign in", "rate-limit", "rate limit", "private", "cookies", "not available",
                 "restricted", "age", "unavailable", "403", "429")


def run(cmd, text=True):
    return subprocess.run(cmd, capture_output=True, text=text)


def refs_root():
    path, problem = workspace.current()
    if problem:
        sys.exit(problem)
    return os.path.join(path, "01_Styles", "references")


# ------------------------------------------------------------------------------------------------------------ fetch
def ytdlp():
    if shutil.which("yt-dlp"):
        return ["yt-dlp"]
    if run([sys.executable, "-c", "import yt_dlp"]).returncode == 0:
        return [sys.executable, "-m", "yt_dlp"]
    return None


def fail_download(url, err):
    low = (err or "").lower()
    gist = next((ln.strip() for ln in reversed((err or "").splitlines()) if ln.strip()), "no details")[:300]
    ask = ("Ask for the file instead (TikTok: Share > Save video; Instagram: screen-record the reel and save it to the "
           f"Mac; YouTube: any saved copy), then run: reference.py add <file> --link \"{url}\"")
    if any(h in low for h in BLOCKED_HINTS):
        print(f"DOWNLOAD BLOCKED: the site wants a login or is limiting downloads for this video ({gist}).")
    else:
        print(f"DOWNLOAD FAILED: {gist}")
        print(f"If the site changed, update the downloader once and retry: {sys.executable} -m pip install -U yt-dlp")
    print(ask)
    sys.exit(3)


def file_id(path):
    h = hashlib.sha1()
    with open(path, "rb") as f:
        h.update(f.read(1 << 20))
    h.update(str(os.path.getsize(path)).encode())
    return h.hexdigest()[:10]


def add(a):
    root = refs_root()
    only = [x.strip().lower() for x in (a.only or "").split(",") if x.strip()]
    bad = [x for x in only if x not in ASPECTS]
    if bad:
        sys.exit(f"UNKNOWN ASPECT: {', '.join(bad)}. Use: {' '.join(ASPECTS)}")
    src = os.path.expanduser(a.source)
    if os.path.islink(src) and not os.path.exists(src):
        sys.exit(f"BROKEN LINK: {src} points at {os.readlink(src)}, which isn't there any more. Ask where the video is now.")
    if "://" not in src and not os.path.exists(src) and (src.startswith(("/", ".", "~")) or src.lower().endswith(VIDEO_EXT)):
        sys.exit(f"FILE NOT FOUND: {src}. Check the path (drag the file into the chat to paste its exact path).")
    full = None                                                   # the whole video's length, when longer than LIMIT
    if os.path.isfile(src):
        src = os.path.abspath(src)
        vid, creator, title, link, how = file_id(src), a.creator or "file", os.path.basename(src), a.link or "", "file"
    else:
        cmd = ytdlp()
        if not cmd:
            sys.exit("DOWNLOADER MISSING: run setup again (bash <skill>/scripts/setup.sh), or ask for the video file.")
        r = run(cmd + ["-J", "--no-playlist", "--no-warnings", src])
        if r.returncode:
            fail_download(src, r.stderr)
        meta = json.loads(r.stdout)
        vid = meta.get("id") or hashlib.sha1(src.encode()).hexdigest()[:10]
        names = (a.creator, meta.get("uploader_id"), meta.get("channel"), meta.get("uploader"))
        creator = next((str(n).lstrip("@") for n in names if n and not str(n).isdigit()), "unknown")  # Instagram ids are numbers
        title, link, how = (meta.get("title") or meta.get("description") or "")[:120], meta.get("webpage_url") or src, "download"
        if (meta.get("duration") or 0) > LIMIT + 30:
            full = float(meta["duration"])
    vslug = workspace.slug(str(vid))
    found = sorted(glob.glob(os.path.join(root, f"*_{vslug}")))
    folder = found[0] if found else os.path.join(root, f"{datetime.date.today().isoformat()}_{workspace.slug(creator)[:30]}_{vslug}")
    print(("ALREADY HAVE IT: reusing " if found else "NEW REFERENCE: ") + folder)
    fresh = not found
    os.makedirs(folder, exist_ok=True)
    if not videos(folder):
        if how == "file":
            shutil.copy2(src, os.path.join(folder, "video" + os.path.splitext(src)[1].lower()))
        else:
            if full:
                print(f"LONG VIDEO ({full / 60:.0f} min): downloading only the first {LIMIT / 60:.0f} minutes.")
            part = ["--download-sections", f"*0-{LIMIT + 5:.0f}"] if full else []
            r = run(ytdlp() + ["-f", FMT, "--merge-output-format", "mp4", *part,
                               "--no-playlist", "--no-warnings", "-o", os.path.join(folder, "video.%(ext)s"), src])
            if r.returncode or not videos(folder):
                if fresh:
                    shutil.rmtree(folder, ignore_errors=True)
                fail_download(src, r.stderr)
    old = {}
    if os.path.exists(os.path.join(folder, "source.json")):
        old = json.load(open(os.path.join(folder, "source.json")))
    info = {"link": link or old.get("link", ""), "creator": creator, "title": title, "id": str(vid), "fetched": how,
            "why": a.why if a.why is not None else old.get("why", ""), "only": only or old.get("only", []),
            "added": old.get("added", datetime.date.today().isoformat()),
            "full_duration_s": full or old.get("full_duration_s")}
    json.dump(info, open(os.path.join(folder, "source.json"), "w"), indent=1)
    open(os.path.join(folder, "source.md"), "w").write(
        f"# Reference: {creator}\n\n- Link: {info['link'] or '(file, no link)'}\n- Title: {title or '-'}\n"
        f"- Added: {info['added']} ({'downloaded' if how == 'download' else 'from a file'})\n"
        + (f"- Length: {info['full_duration_s'] / 60:.0f} min; only the first {LIMIT / 60:.0f} min were downloaded\n"
           if info["full_duration_s"] else "") +
        f"- Why the creator likes it: {info['why'] or '(not given: break down the whole style)'}\n"
        f"- Take only: {', '.join(info['only']) if info['only'] else 'everything'}\n\n"
        "For study only: never place this video's footage, audio, images or fonts in an edit.\n")
    measure(folder)


def videos(folder):
    return sorted(f for f in glob.glob(os.path.join(folder, "video.*")) if f.lower().endswith(VIDEO_EXT))


# ---------------------------------------------------------------------------------------------------------- measure
def probe(path):
    info = json.loads(run(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", path]).stdout)
    v = next((s for s in info["streams"] if s["codec_type"] == "video"), None)
    if not v:
        sys.exit("NO VIDEO STREAM in " + path)
    num, _, den = (v.get("avg_frame_rate") or "30/1").partition("/")
    fps = float(num) / float(den or 1) if float(num or 0) else 30.0
    w, h = int(v["width"]), int(v["height"])
    rot = int((v.get("tags") or {}).get("rotate", 0) or 0)
    for sd in v.get("side_data_list") or []:
        rot = int(sd.get("rotation", rot) or rot)
    if abs(rot) in (90, 270):
        w, h = h, w
    return {"duration_s": round(float(info["format"]["duration"]), 2), "fps": round(fps, 2), "width": w, "height": h,
            "audio": any(s["codec_type"] == "audio" for s in info["streams"])}


def detect_cuts(path, fps, dur, land=False):
    w, h = (160, 90) if land else (90, 160)
    raw = run(["ffmpeg", "-v", "error", "-t", str(dur), "-i", path, "-vf", f"scale={w}:{h},format=gray", "-f", "rawvideo",
               "-"], text=False).stdout
    n = len(raw) // (w * h)
    if n < 3:
        return []
    X = np.frombuffer(raw[:n * w * h], np.uint8).reshape(n, h, w).astype(np.float32)
    d = np.abs(np.diff(X, axis=0)).mean(axis=(1, 2))
    cuts = []
    for i in range(len(d)):                                   # same rule as cuts.py: a lone one-frame spike
        near = np.r_[d[max(0, i - 12):i], d[i + 1:i + 13]]
        r = d[i] / (np.median(near) + 0.3)
        lone = (i == 0 or d[i - 1] < d[i] / 2) and (i + 1 >= len(d) or d[i + 1] < d[i] / 2)
        t = (i + 1) / fps
        if r > 3.0 and d[i] > 2.5 and lone and t > 0.3 and (not cuts or t - cuts[-1] > 0.2):
            cuts.append(round(t, 2))
    return cuts


def text_bin():
    """the compiled Vision text reader (built once), or None when it can't be built here"""
    swift = os.path.join(HERE, "vision_text.swift")
    if platform.system() != "Darwin" or not shutil.which("swiftc"):
        return None
    tag = hashlib.sha1(open(swift, "rb").read()).hexdigest()[:10]
    exe = os.path.join(seg.BIN_DIR, f"vision_text-{tag}")
    if not os.path.exists(exe):
        os.makedirs(seg.BIN_DIR, exist_ok=True)
        if run(["swiftc", "-O", swift, "-o", exe]).returncode or not os.path.exists(exe):
            return None
    return exe


def kmeans(X, k, iters=12):
    X = X.astype(np.float32)
    if len(X) <= k:
        return X, np.arange(len(X))
    C = X[np.random.default_rng(0).choice(len(X), k, replace=False)].copy()
    for _ in range(iters):
        lab = ((X[:, None, :] - C[None]) ** 2).sum(-1).argmin(1)
        for j in range(k):
            if (lab == j).any():
                C[j] = X[lab == j].mean(0)
    return C, lab


def hexc(c):
    return "#%02x%02x%02x" % tuple(int(max(0, min(255, v))) for v in c)


def text_colour(img, box):
    """(glyph colour, background colour) for a text line: the background is the ring of pixels just outside the box;
    the glyphs are whichever of the box's two colour clusters is further from it."""
    x, y, w, h = (int(round(v)) for v in box)
    W, H = img.size
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    inner = a[max(0, y):min(H, y + h), max(0, x):min(W, x + w)].reshape(-1, 3)
    p = max(4, h // 5)
    outer = a[max(0, y - p):min(H, y + h + p), max(0, x - p):min(W, x + w + p)]
    ring = np.concatenate([outer[:p].reshape(-1, 3), outer[-p:].reshape(-1, 3), outer[:, :p].reshape(-1, 3), outer[:, -p:].reshape(-1, 3)])
    if len(inner) < 40 or len(ring) < 10:
        return None, None
    bg = np.median(ring, axis=0)
    C, _ = kmeans(inner[:: max(1, len(inner) // 4000)], 2)
    glyph = C[int(np.argmax(((C - bg) ** 2).sum(1)))]
    return hexc(glyph), hexc(bg)


def light(hex_):
    r, g, b = (int(hex_[i:i + 2], 16) for i in (1, 3, 5))
    return 0.299 * r + 0.587 * g + 0.114 * b > 140


def median_colour(hexes):
    if not hexes:
        return None
    rgb = np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in hexes])
    return hexc(np.median(rgb, axis=0))


def tokens(s):
    return [t.replace("'", "") for t in re.findall(r"[a-z0-9'*]+", s.lower()) if t.strip("*")]


def heard(tok, near):
    """is this on-screen word one of the nearby spoken words? (starred swears match: f*cked = fucked)"""
    if "*" not in tok:
        return tok in near
    pat = re.compile("^" + re.escape(tok).replace(r"\*", ".+") + "$")
    return any(pat.match(n) for n in near)


def add_time(runs, t, gap=1.0):
    """add time t to a list of [start, end] runs: a new run when the text has been gone for more than gap seconds"""
    if runs and t - runs[-1][1] <= gap:
        runs[-1][1] = max(runs[-1][1], t)
    else:
        runs.append([t, t])


def wav_db(path):
    with wave.open(path) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        sr = w.getframerate()
    b = sr // 20                                                # 50 ms blocks
    n = len(x) // b
    if not n:
        return np.array([]), 0.05
    rms = np.sqrt((x[:n * b].reshape(n, b) ** 2).mean(1)) + 1e-9
    return 20 * np.log10(rms), 0.05


def tonality(path, words):
    """median peak prominence (dB) of the sound between words, 100-4000 Hz: music has tonal peaks (~20-35 dB above the
    local spectrum), steady noise (room, road, wind) doesn't (~10-12 dB). Calibrated 2026-11-23 on a car clip with a
    chord bed (35 dB) vs pink noise (10.5 dB) vs the bare clip (11 dB)."""
    with wave.open(path) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        sr = w.getframerate()
    N, hop = 2048, 800
    lo, hi, k = int(100 * N / sr), int(4000 * N / sr), 15
    spans = np.array([[wd["s"] - 0.1, wd["e"] + 0.1] for wd in words]) if words else np.zeros((0, 2))
    proms = []
    for start in range(0, len(x) - N, hop):
        t0, t1 = start / sr, (start + N) / sr
        if len(spans) and ((t1 > spans[:, 0]) & (t0 < spans[:, 1])).any():
            continue
        p = np.abs(np.fft.rfft(x[start:start + N] * np.hanning(N)))[lo:hi] ** 2 + 1e-12
        if 10 * np.log10(p.mean()) < -90:
            continue
        pad = np.pad(p, k, mode="edge")
        smooth = np.array([np.median(pad[i:i + 2 * k + 1]) for i in range(len(p))])
        proms.append(float(np.sort(10 * np.log10(p / smooth))[-3:].mean()))
        if len(proms) >= 300:
            break
    return float(np.median(proms)) if len(proms) >= 4 else None


def sheet(cells, out, cols=6):
    """cells: [(PIL image, label)], all the same size -> one contact sheet"""
    cw, ch = cells[0][0].size
    rows = (len(cells) + cols - 1) // cols
    im = Image.new("RGB", (cols * (cw + 4) + 4, rows * (ch + 24) + 4), (24, 24, 24))
    dr = ImageDraw.Draw(im)
    for i, (cell, label) in enumerate(cells):
        x, y = 4 + (i % cols) * (cw + 4), 4 + (i // cols) * (ch + 24)
        im.paste(cell, (x, y + 20))
        dr.text((x + 3, y + 4), label, fill=(255, 230, 0))
    im.save(out, quality=85)


def measure(folder):
    folder = os.path.abspath(folder)
    vids = videos(folder)
    if not vids:
        sys.exit(f"NO VIDEO in {folder}: put the video there as video.mp4 (or .mov), then run measure again.")
    path = vids[0]
    if getattr(os.stat(path), "st_flags", 0) & 0x40000000:
        sys.exit(f"NOT DOWNLOADED: {path} is an iCloud placeholder. In Finder: right-click > Download Now, then retry.")
    src = json.load(open(os.path.join(folder, "source.json"))) if os.path.exists(os.path.join(folder, "source.json")) else {}
    meta = probe(path)
    win = min(meta["duration_s"], LIMIT)
    land = meta["width"] > meta["height"]
    RW, RH = (1920, 1080) if land else (1080, 1920)               # the frame positions and sizes are reported on
    CW, CH = (320, 180) if land else (180, 320)                   # contact-sheet cells
    cols = 4 if land else 6
    meta["frame"] = f"{RW}x{RH}"
    notes = []
    full = max(meta["duration_s"], src.get("full_duration_s") or 0)
    if full > LIMIT + 30:
        notes.append(f"Long video ({full / 60:.0f} min): measured the first {LIMIT / 60:.0f} min only, so the ending "
                     "isn't in it.")
    if land:
        notes.append("Landscape (16:9) video: positions and sizes are on a 1920x1080 frame, not a 9:16 reel. "
                     "Translate them for a reel (reference/style-breakdown.md, Landscape references).")
    tmp = os.path.join(folder, "_tmp")
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(tmp)
    for d in ("src", "data"):
        os.makedirs(os.path.join(folder, d), exist_ok=True)
    print(f"Measuring {os.path.basename(folder)}: {meta['duration_s']} s, {meta['width']}x{meta['height']}, {meta['fps']} fps")

    # ---- speech
    words = []
    if meta["audio"]:
        run(["ffmpeg", "-v", "error", "-y", "-t", str(win), "-i", path, "-vn", "-ac", "1", "-ar", "16000",
             os.path.join(folder, "src", "audio16k.wav")])
        r = run([sys.executable, "-I", os.path.join(HERE, "transcribe.py"), folder, "--prompt", (src.get("title") or "")[:200]])
        wj = os.path.join(folder, "data", "words.json")
        if r.returncode == 0 and os.path.exists(wj):
            words = json.load(open(wj))
        else:
            notes.append("Speech not measured: transcription failed (run with the skill's Python, $PY).")
    else:
        notes.append("No audio track.")
    speech = None
    if words:
        span = max(1e-3, words[-1]["e"] - words[0]["s"])
        gaps = [b["s"] - a["e"] for a, b in zip(words, words[1:])]
        speech = {"words": len(words), "first_word_s": round(words[0]["s"], 2), "words_per_min": round(len(words) / span * 60),
                  "pauses_over_0_6s": sum(g > 0.6 for g in gaps), "longest_pause_s": round(max(gaps, default=0), 2)}

    # ---- cuts and shots
    cuts = detect_cuts(path, meta["fps"], win, land)
    edges = [0.0] + cuts + [win]
    shots = [(round(a, 2), round(b, 2)) for a, b in zip(edges, edges[1:]) if b - a > 0.05]
    lens = [b - a for a, b in shots]
    pacing = {"cuts": cuts, "shots": len(shots), "avg_shot_s": round(float(np.mean(lens)), 2),
              "median_shot_s": round(float(np.median(lens)), 2), "longest_shot_s": round(max(lens), 2),
              "cuts_per_10s": round(len(cuts) / win * 10, 2), "cuts_in_first_3s": sum(c < 3 for c in cuts),
              "first_cut_s": cuts[0] if cuts else None}

    # ---- frames: 4 per second for the sheets, 2 per second at full width for on-screen text
    run(["ffmpeg", "-v", "error", "-t", str(win), "-i", path, "-vf",
         f"fps=4,scale={CW}:{CH}:force_original_aspect_ratio=increase,crop={CW}:{CH}", os.path.join(tmp, "s%05d.jpg")])
    small = sorted(glob.glob(os.path.join(tmp, "s*.jpg")))

    def at(t):
        return small[min(len(small) - 1, max(0, int(round(t * 4))))]

    hook_cells = [(Image.open(at(t)).copy(), f"{t:.2f}s") for t in np.arange(0, min(3.0, win), 0.25)]
    sheet(hook_cells, os.path.join(folder, "hook.jpg"), cols)
    samples = []                                               # (shot number, time)
    for k, (a, b) in enumerate(shots, 1):
        if b - a <= 3:
            samples.append((k, (a + b) / 2))
        else:
            samples += [(k, t) for t in np.arange(a + 0.75, b - 0.4, 1.5)]
    if len(samples) > 48:
        samples = [samples[int(i)] for i in np.linspace(0, len(samples) - 1, 48)]
    for old in glob.glob(os.path.join(folder, "shots-*.jpg")):
        os.remove(old)
    sheets = ["hook.jpg"]
    for s in range(0, len(samples), 24):
        name = f"shots-{s // 24 + 1:02d}.jpg"
        sheet([(Image.open(at(t)).copy(), f"S{k} {t:.1f}s") for k, t in samples[s:s + 24]], os.path.join(folder, name), cols)
        sheets.append(name)

    # ---- framing: the speaker's size and head height per sample (Apple Vision person masks)
    framing = None
    mask_dir = os.path.join(tmp, "masks")
    shot_frames = [at(t) for _, t in samples]
    if shot_frames and seg.vision_masks(shot_frames, mask_dir):
        per = []
        for (k, t), f in zip(samples, shot_frames):
            m = np.asarray(Image.open(os.path.join(mask_dir, os.path.splitext(os.path.basename(f))[0] + ".png"))) > 127
            rows = np.where(m.mean(1) > 0.02)[0]
            per.append((k, t, float(m.mean()), int(rows[0] * RH / m.shape[0]) if len(rows) else None))
        seen = [p for p in per if p[2] > 0.03]
        by_shot = {}
        for k, t, frac, top in seen:
            by_shot.setdefault(k, []).append(frac)
        sizes = [float(np.mean(v)) for _, v in sorted(by_shot.items())]
        changes = sum(1 for a, b in zip(sizes, sizes[1:]) if b > a * 1.25 or b < a / 1.25)
        framing = {"speaker_on_screen_share": round(len(seen) / len(per), 2),
                   "speaker_size_share_median": round(float(np.median([p[2] for p in seen])), 2) if seen else None,
                   "speaker_size_range": [round(min(sizes), 2), round(max(sizes), 2)] if sizes else None,
                   "head_top_y_median": int(np.median(tops)) if (tops := [p[3] for p in seen if p[3] is not None]) else None,
                   "size_changes_between_shots": changes, "shots_with_speaker": len(by_shot)}
    else:
        notes.append("Framing not measured (Apple Vision person masks unavailable).")

    # ---- look: brightness, saturation, palette
    px = np.concatenate([np.asarray(Image.open(f).convert("RGB")).reshape(-1, 3)[::23] for f in small[::4]])
    C, lab = kmeans(px, 5)
    share = np.bincount(lab, minlength=5) / len(lab)
    hsv = np.asarray(Image.fromarray(px.reshape(-1, 1, 3).astype(np.uint8)).convert("HSV")).reshape(-1, 3)
    look = {"brightness_0_255": int(px.mean()), "saturation_0_255": int(hsv[:, 1].mean()),
            "palette": [[hexc(C[i]), round(float(share[i]), 2)] for i in np.argsort(-share)]}

    # ---- on-screen text (Apple Vision text recognition)
    captions, other, small_text, flashes = None, [], None, None
    exe = text_bin()
    if exe:
        run(["ffmpeg", "-v", "error", "-t", str(win), "-i", path, "-vf", f"fps=2,scale={RW}:-2", os.path.join(tmp, "o%05d.jpg")])
        big = sorted(glob.glob(os.path.join(tmp, "o*.jpg")))
        open(os.path.join(tmp, "o.txt"), "w").write("\n".join(big))
        r = run([exe, "@" + os.path.join(tmp, "o.txt")])
        frames = [json.loads(ln) for ln in r.stdout.splitlines() if ln.startswith("{")]
        handle = workspace.slug(src.get("creator", "")) if src.get("fetched") == "download" else ""
        handle = handle if len(handle) >= 4 else ""
        cap_items, cap_frames, chunks, oth = [], 0, [], {}
        prev = None
        for fr in frames:
            t = (int(re.search(r"o(\d+)\.jpg$", fr["f"]).group(1)) - 1) / 2
            near = {tok for w in words if t - 2.5 <= w["s"] <= t + 2.0 for tok in tokens(w["w"])}
            img, spoken_here = None, []
            for text, conf, x, y, w, h in fr["t"]:
                tk = tokens(text)
                if not tk or conf < 0.3:
                    continue
                low = text.lower()
                if "tiktok" in low or (handle and handle.replace("-", "") in re.sub(r"[^a-z0-9]", "", low)):
                    continue                                      # platform watermark / the creator's handle
                if img is None:
                    img = Image.open(fr["f"])
                item = {"t": t, "text": text, "x": x + w / 2, "y": y + h / 2, "h": h, "words": len(tk),
                        "upper": text.upper() == text and any(c.isalpha() for c in text)}
                item["colour"], item["bg"] = text_colour(img, (x, y, w, h))
                if near and sum(heard(tok, near) for tok in tk) / len(tk) >= 0.6:
                    cap_items.append(item)
                    spoken_here.append(text)
                else:
                    o = oth.setdefault(" ".join(tk), {"text": text, "first_s": t, "last_s": t, "runs": [], "x": [], "y": [],
                                                      "h": [], "colour": item["colour"], "conf": 0})
                    o["conf"] = max(o["conf"], conf)
                    o["last_s"] = t
                    add_time(o["runs"], t)
                    o["x"].append(item["x"])
                    o["y"].append(item["y"])
                    o["h"].append(h)
            if spoken_here:
                cap_frames += 1
                key = " ".join(sorted(spoken_here))
                if key != prev:
                    chunks.append([t, t])
                else:
                    chunks[-1][1] = t
                prev = key
            else:
                prev = None
        big_spoken = []
        if cap_items:
            h_med = float(np.median([it["h"] for it in cap_items]))
            big_spoken = [it for it in cap_items if it["h"] > 1.6 * h_med]
            cap_items = [it for it in cap_items if it["h"] <= 1.6 * h_med]
        if cap_items:
            per_frame = {}
            for it in cap_items:
                per_frame.setdefault(it["t"], []).append(it)
            on_dark = [it["colour"] for it in cap_items if it["colour"] and not light(it["bg"])]
            on_light = [it["colour"] for it in cap_items if it["colour"] and light(it["bg"])]
            captions = {"on_screen_share": round(cap_frames / max(1, len(frames)), 2),
                        "line_height_px": int(np.median([it["h"] for it in cap_items])),
                        "centre_y": int(np.median([it["y"] for it in cap_items])),
                        "centre_x": int(np.median([it["x"] for it in cap_items])),
                        "words_per_line": int(np.median([it["words"] for it in cap_items])),
                        "words_per_line_max": max(it["words"] for it in cap_items),
                        "lines_at_once": int(np.median([len(v) for v in per_frame.values()])),
                        "all_caps_share": round(float(np.mean([it["upper"] for it in cap_items])), 2),
                        "colour_on_dark": median_colour(on_dark), "colour_on_light": median_colour(on_light),
                        "share_on_light": round(len(on_light) / max(1, len(on_dark) + len(on_light)), 2),
                        "chunk_hold_s_median": round(float(np.median([b - a + 0.5 for a, b in chunks])), 2) if chunks else None,
                        "examples": [it["text"] for it in cap_items[:: max(1, len(cap_items) // 8)]][:8]}
        def where(yy):
            return "top" if yy < RH / 3 else "bottom" if yy > RH * 2 / 3 else "middle"

        def entry(o, **extra):
            yy, runs = float(np.median(o["y"])), o["runs"]
            e = {"text": o["text"], "from_s": runs[0][0], "to_s": runs[0][1] + 0.5, "centre_y": int(yy),
                 "line_height_px": int(np.median(o["h"])), "colour": o["colour"], "where": where(yy), **extra}
            if len(runs) > 1:                                     # it comes back later: say how often, not one long span
                e.update(times=len(runs), last_to_s=runs[-1][1] + 0.5)
            return e

        def on_time(o):
            return sum(b - a + 0.5 for a, b in o["runs"])

        bigs = {}                                                 # big words that repeat the speech: one entry each
        for it in big_spoken:
            b = bigs.setdefault(" ".join(tokens(it["text"])), {"text": it["text"], "runs": [], "y": [], "h": [],
                                                                "colour": it["colour"]})
            add_time(b["runs"], it["t"])
            b["y"].append(it["y"])
            b["h"].append(it["h"])
        other += [entry(b, spoken=True) for b in sorted(bigs.values(), key=lambda b: b["runs"][0][0])][:12]
        if captions:                     # a caption word the transcript heard differently ("gonna" vs "going"): drop it
            ch_, cy_ = captions["line_height_px"], captions["centre_y"]
            for k in [k for k, o in oth.items() if len(o["y"]) <= 2 and abs(np.median(o["y"]) - cy_) <= ch_
                      and 0.6 <= np.median(o["h"]) / ch_ <= 1.5]:
                del oth[k]
        groups = []                      # one spot, read slightly differently each time, for seconds: filmed text
        for k, o in oth.items():
            x, y, h = float(np.median(o["x"])), float(np.median(o["y"])), float(np.median(o["h"]))
            g = next((g for g in groups if abs(g["y"] - y) <= max(g["h"], h) and abs(g["x"] - x) <= RW * 0.08
                      and difflib.SequenceMatcher(None, g["text"], k).ratio() >= 0.5), None)
            if g:
                g["keys"].append(k)
            else:
                groups.append({"x": x, "y": y, "h": h, "text": k, "keys": [k]})
        for g in groups:
            group = sorted((oth[k] for k in g["keys"]), key=on_time, reverse=True)
            if len(group) >= 3 and sum(o["last_s"] - o["first_s"] >= 3 for o in group) >= 2:
                for k in g["keys"]:
                    del oth[k]
                runs = []
                for t in sorted(t for o in group for a, b in o["runs"] for t in (a, b)):
                    add_time(runs, t, gap=3.0)
                oth["logo " + g["text"]] = {"text": " / ".join(o["text"] for o in group[:4]), "logo": True, "runs": runs,
                                            "first_s": runs[0][0], "last_s": runs[-1][1], "x": [g["x"]], "y": [g["y"]],
                                            "h": [g["h"]], "colour": group[0]["colour"], "conf": 1}
        tiny = [o for o in oth.values() if np.median(o["h"]) < 24]     # small UI text on screens and cards
        if tiny:
            small_text = {"bits": len(tiny), "from_s": min(o["first_s"] for o in tiny),
                          "to_s": max(o["last_s"] for o in tiny) + 0.5,
                          "examples": [o["text"] for o in sorted(tiny, key=lambda o: (-o["conf"], -len(o["text"])))[:4]]}
        big_oth = [o for o in oth.values() if np.median(o["h"]) >= 24]
        steady = [o for o in big_oth if len(o["y"]) >= 2 or o["conf"] >= 0.99]
        flash = [o for o in big_oth if len(o["y"]) < 2 and o["conf"] < 0.99]
        if flash:                        # seen in one frame only, read unsurely: usually a texture or a moving object
            flashes = {"count": len(flash), "examples": [o["text"] for o in sorted(flash, key=lambda o: -o["conf"])[:5]]}
        other += [entry(o, **({"logo": True} if o.get("logo") else {}))
                  for o in sorted(steady, key=on_time, reverse=True)[:12]]
    else:
        notes.append("On-screen text not measured (Apple Vision text recognition unavailable: needs a Mac with the "
                     "Xcode command line tools). Read it off the contact sheets instead.")

    # ---- sound: loudness, a music bed under the voice, likely sound-effect hits
    audio = None
    if meta["audio"]:
        er = run(["ffmpeg", "-v", "info", "-t", str(win), "-i", path, "-af", "ebur128", "-f", "null", "-"]).stderr
        lufs = re.findall(r"I:\s+(-?[\d.]+) LUFS", er)
        db, step = wav_db(os.path.join(folder, "src", "audio16k.wav"))
        tt = np.arange(len(db)) * step
        in_word = np.zeros(len(db), bool)
        for w in words:
            in_word |= (tt >= w["s"] - 0.1) & (tt <= w["e"] + 0.1)
        gap = ~in_word
        run_len = np.zeros(len(db))
        for i in range(len(db)):                                # keep only gaps of 0.3 s or more
            run_len[i] = run_len[i - 1] + 1 if i and gap[i] and gap[i - 1] else (1 if gap[i] else 0)
        long_gap = np.zeros(len(db), bool)
        for i in np.where(run_len >= 6)[0]:
            long_gap[i - 5:i + 1] = True
        speech_db = float(np.median(db[in_word])) if in_word.any() else None
        tone = tonality(os.path.join(folder, "src", "audio16k.wav"), words)
        bed_db = float(np.median(db[long_gap])) if long_gap.any() else (float(np.median(db)) if not words else None)
        if bed_db is None:
            bed = "no pauses long enough to tell"
        elif not words:
            bed = "music only (no speech)" if bed_db > -40 else "mostly quiet, no speech"
        elif bed_db > -42 and tone is not None and tone >= 18:
            bed = f"likely music under the voice (tonal peaks {tone:.0f} dB), about {speech_db - bed_db:.0f} dB below it"
        elif bed_db > -42 and tone is not None and tone < 14:
            bed = (f"steady noise between words (room, road or wind; tonal peaks only {tone:.0f} dB), about "
                   f"{speech_db - bed_db:.0f} dB under the voice: probably no music bed")
        elif bed_db > -42:
            bed = (f"something under the voice, about {speech_db - bed_db:.0f} dB below it: can't tell music from noise "
                   f"(tonal peaks {tone:.0f} dB)" if tone is not None else
                   f"something under the voice, about {speech_db - bed_db:.0f} dB below it (pauses too short to tell what)")
        elif bed_db > -55:
            bed = "faint: room tone or a very quiet bed"
        else:
            bed = "silence between words: no music bed"
        starts = np.array([w["s"] for w in words])
        hits = []
        for i in range(8, len(db)):
            base = float(np.median(db[i - 8:i]))
            t = i * step
            if db[i] - base >= 12 and db[i] > -35 and gap[i] and not (len(starts) and np.min(np.abs(starts - t)) < 0.15) \
                    and (not hits or t - hits[-1] > 0.3):
                hits.append(round(t, 2))
        audio = {"lufs": float(lufs[-1]) if lufs else None, "speech_db": round(speech_db, 1) if speech_db else None,
                 "between_words_db": round(bed_db, 1) if bed_db is not None else None, "music_bed": bed,
                 "pause_tonal_peaks_db": round(tone, 1) if tone is not None else None,
                 "likely_sfx_s": hits[:20]}

    analysis = {"file": meta, "measured_s": win, "pacing": pacing, "speech": speech, "framing": framing, "look": look,
                "captions": captions, "other_text": other, "small_text": small_text, "text_flashes": flashes, "audio": audio,
                "sheets": sheets, "notes": notes}
    json.dump(analysis, open(os.path.join(folder, "analysis.json"), "w"), indent=1)
    open(os.path.join(folder, "analysis.md"), "w").write(report(src, analysis, words))
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"-> {os.path.join(folder, 'analysis.md')}  (+ analysis.json, {', '.join(sheets)})")
    for n in notes:
        print("NOTE: " + n)


def report(src, a, words):
    f, p, s, fr, lk, c, au = a["file"], a["pacing"], a["speech"], a["framing"], a["look"], a["captions"], a["audio"]
    L = [f"# Measurements: {src.get('creator', 'reference')}", "",
         f"{f['duration_s']} s, {f['width']}x{f['height']}, {f['fps']} fps. Estimates from the file; check them on the "
         f"sheets ({', '.join(a['sheets'])}).", ""]
    if src.get("why") or src.get("only"):
        L += [f"**Creator's why:** {src.get('why') or '-'}  ", f"**Take only:** {', '.join(src.get('only') or []) or 'everything'}", ""]
    L += ["## Pacing and cuts",
          f"- {p['shots']} shots, {len(p['cuts'])} cuts: {p['cuts_per_10s']} cuts per 10 s; shots last {p['median_shot_s']} s "
          f"(median), longest {p['longest_shot_s']} s.",
          f"- First cut at {p['first_cut_s']} s; {p['cuts_in_first_3s']} cut(s) in the first 3 s." if p["cuts"] else
          "- No cuts detected: one continuous shot.", ""]
    L += ["## Speech"]
    L += [f"- {s['words']} words, {s['words_per_min']} words a minute; first word at {s['first_word_s']} s; "
          f"{s['pauses_over_0_6s']} pause(s) over 0.6 s (longest {s['longest_pause_s']} s)."] if s else ["- No speech measured."]
    L += ["", "## Framing"]
    if fr:
        L += [f"- Speaker on screen in {fr['speaker_on_screen_share']:.0%} of sampled moments (the rest: B-roll, screens or "
              "full-screen graphics).",
              f"- Speaker fills about {fr['speaker_size_share_median']:.0%} of the frame (per-shot range "
              f"{fr['speaker_size_range'][0]:.0%}-{fr['speaker_size_range'][1]:.0%}); head top near y {fr['head_top_y_median']}."
              if fr["speaker_size_share_median"] is not None else "- No speaker found.",
              f"- Speaker size changes between shots {fr['size_changes_between_shots']} time(s) across "
              f"{fr['shots_with_speaker']} shots (punch-ins / close-wide alternation)."]
    else:
        L += ["- Not measured."]
    L += ["", "## Captions (on-screen text that matches the spoken words)"]
    if c:
        L += [f"- On screen {c['on_screen_share']:.0%} of the time; {c['words_per_line']} word(s) per line (max "
              f"{c['words_per_line_max']}), {c['lines_at_once']} line(s) at once; each holds about {c['chunk_hold_s_median']} s.",
              f"- Text line about {c['line_height_px']} px tall, centred at x {c['centre_x']}, y {c['centre_y']} "
              f"({f.get('frame', '1080x1920')} frame).",
              f"- Colour: {c['colour_on_dark'] or '-'} over dark backgrounds, {c['colour_on_light'] or '-'} over light ones "
              f"({c['share_on_light']:.0%} of lines sit on light); all caps in {c['all_caps_share']:.0%} of lines.",
              f"- Examples: {' | '.join(c['examples'])}"]
    else:
        L += ["- None found (or not measured)."]
    L += ["", "## Other on-screen text (headlines, labels, UI)"]
    L += [f"- {o['from_s']:.1f}-{o['to_s']:.1f} s"
          + (f" (back {o['times'] - 1} more time(s), last until {o['last_to_s']:.1f} s)" if o.get("times") else "")
          + f", {o['where']} (y {o['centre_y']}, {o['line_height_px']} px, {o['colour']}): "
          f"\"{o['text']}\"" + (" (big word that repeats the speech)" if o.get("spoken") else "")
          + (" (read differently each time: text filmed in the scene, like a logo, clothing, a sign or handwriting, not an added graphic)" if o.get("logo") else "")
          for o in a["other_text"]] or ["- None found (or not measured)."]
    if a.get("text_flashes"):
        fl = a["text_flashes"]
        L += [f"- {fl['count']} unsure reading(s) seen in one frame only (usually a texture or a moving object; check the "
              f"sheets), e.g. {' | '.join(fl['examples'])}"]
    if a.get("small_text"):
        st = a["small_text"]
        L += [f"- Small text (app screens, cards, UI) in {st['bits']} bits between {st['from_s']:.1f} and {st['to_s']:.1f} s, "
              f"e.g. {' | '.join(st['examples'])}"]
    L += ["", "## Look",
          f"- Brightness {lk['brightness_0_255']}/255, saturation {lk['saturation_0_255']}/255.",
          "- Palette: " + ", ".join(f"{h} {sh:.0%}" for h, sh in lk["palette"]), "", "## Sound"]
    if au:
        L += [f"- Loudness {au['lufs']} LUFS. Voice {au['speech_db']} dB, between words {au['between_words_db']} dB: "
              f"{au['music_bed']}.",
              f"- Likely sound-effect hits in the pauses (hits under the voice can't be told apart from it): "
              f"{', '.join(f'{t}s' for t in au['likely_sfx_s']) or 'none'}. Check them against the shot sheets."]
    else:
        L += ["- No audio."]
    if a["notes"]:
        L += ["", "## Notes"] + [f"- {n}" for n in a["notes"]]
    if words:
        L += ["", "## Transcript", ""]
        line, start = [], words[0]["s"]
        for i, w in enumerate(words):
            line.append(w["w"].strip())
            nxt = words[i + 1]["s"] if i + 1 < len(words) else None
            if nxt is None or nxt - w["e"] > 0.5 or len(line) >= 14:
                L.append(f"[{start:6.2f}-{w['e']:6.2f}] {' '.join(line)}")
                line, start = [], nxt or 0
    return "\n".join(L) + "\n"


def list_refs():
    root = refs_root()
    found = sorted(d for d in glob.glob(os.path.join(root, "*")) if os.path.isdir(d))
    if not found:
        print("NO REFERENCES yet in " + root)
    for d in found:
        s = json.load(open(os.path.join(d, "source.json"))) if os.path.exists(os.path.join(d, "source.json")) else {}
        state = "broken down" if os.path.exists(os.path.join(d, "breakdown.md")) else \
            "measured" if os.path.exists(os.path.join(d, "analysis.json")) else "not measured"
        print(f"{os.path.basename(d)}  [{state}]  why: {s.get('why') or '-'}  only: {', '.join(s.get('only') or []) or 'everything'}")
    print(f"{len(found)} reference(s)")


def main():
    ap = argparse.ArgumentParser(description="Reference videos for Build my style.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("add")
    p.add_argument("source", help="a link (Instagram, TikTok, YouTube...) or a video file")
    p.add_argument("--why", help="the creator's own words on what they like about it")
    p.add_argument("--only", help="comma list of aspects to take: " + " ".join(ASPECTS))
    p.add_argument("--link", help="for a file: the link it came from")
    p.add_argument("--creator", help="override the creator name used for the folder")
    p = sub.add_parser("measure")
    p.add_argument("folder")
    sub.add_parser("list")
    a = ap.parse_args()
    if a.cmd == "add":
        add(a)
    elif a.cmd == "measure":
        measure(a.folder)
    else:
        list_refs()


if __name__ == "__main__":
    main()
