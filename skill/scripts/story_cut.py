"""A-roll story cut from raw footage: keep the blocks you chose from the transcript, drop retakes, false starts and dead
air, and write the cut list (guide: reference/story-cut.md):
  --render builds <cut>/out/acut.mov with ffmpeg, then new_project.py runs on that file
  --cue-asset writes the same cut list as clips for the Cue editor app (optional)

Usage: python story_cut.py <cut_dir> [--check [--prompt "names"]] [--render] [--gap 0.30]
Pauses: every quiet stretch of 0.15 s or more inside the kept lines is cut, measured in the audio itself (not from
Whisper's word times, which drift). Each piece starts 20 ms before its first sound and ends 40 ms after its last word
fades; an edge that lands mid-word moves out to the nearest pause, so joins are tight without clipping a word.
  <cut_dir> holds src/audio16k.wav, data/words.json (transcribe.py) and keep.json, which you write after reading the
  transcript: [{"label": "Hook: ...", "from": 1.06, "to": 4.90}, ...] in story order. from/to are the START times of
  the block's first and last kept word (from data/words.json). Optional "start"/"end" force exact source edges.
Writes data/cutlist.json ([{"label", "in", "out"}] in source seconds; cuts.py --cutlist reads it too) and prints
every piece with its timeline position.
"""
import argparse
import json
import os
import subprocess

import numpy as np

import sys as _sys
_sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from av_joins import join_audio, picture_slots  # noqa: E402  (room tone crossfades at every join)

ap = argparse.ArgumentParser()
ap.add_argument("cut_dir")
ap.add_argument("--render", action="store_true", help="also build out/acut.mov with ffmpeg (background path)")
ap.add_argument("--source", help="raw clip (default: the path in keep.json's sibling source.txt or src/source.*)")
ap.add_argument("--gap", type=float, default=0.30, help="Whisper word gaps longer than this become cuts (a dropped um)")
ap.add_argument("--check", action="store_true", help="hear the cut: transcribe its audio, list any kept word missing and any pause left")
ap.add_argument("--prompt", default="", help="names/brands for the --check transcription")
ap.add_argument("--cue-asset", help="Cue path: the clip's Cue media id; writes data/cue_clips.json for add_clips")
ap.add_argument("--cue-track", default="V1")
ap.add_argument("--fps", type=float, default=24, help="source frame rate, for frame-snapped Cue edges")
args = ap.parse_args()
D = os.path.abspath(args.cut_dir)
PAUSE_MIN = 0.15                # a quiet stretch this long between kept words is cut out
ONSET_PAD, TAIL_PAD = 0.02, 0.04   # room left before a piece's first sound / after its last one fades
SOFT_BACK, SOFT_FWD = 0.12, 0.15   # how far a soft start ("h", "s") / a word's fade may reach past the loud part

words = json.load(open(os.path.join(D, "data", "words.json")))
keep = json.load(open(os.path.join(D, "keep.json")))

# loudness envelope (10 ms hops) of the raw audio: every piece edge is set from what is actually heard, not from
# Whisper's word times, which often run into the silence after a word (that left 0.3-0.7 s of dead air at joins)
pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(D, "src", "audio16k.wav"), "-ac", "1", "-ar", "16000",
                      "-f", "s16le", "-"], capture_output=True, check=True).stdout
x = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
HOP = 160
db = 20 * np.log10(np.sqrt(np.convolve(x ** 2, np.ones(HOP) / HOP, "same")[::HOP]) + 1e-6)
FLOOR, PEAK = np.percentile(db, 10), np.percentile(db, 95)    # the room, and the voice at its strongest
LOUD = max(PEAK - 25, FLOOR + 10)       # speech (measured against the voice: a very quiet room must not make breaths count)
SOFT = max(PEAK - 35, FLOOR + 6)        # a word's soft start or fading end
N = len(db)
fr = lambda t: min(N - 1, max(0, int(round(t * 100))))


DBS = np.median(np.lib.stride_tricks.sliding_window_view(np.pad(db, 2, mode="edge"), 5), axis=1)
QUIET = DBS < LOUD                          # smoothed over 50 ms, so a click or a lip smack doesn't break a pause
RUNS, k = [], 0                             # every quiet stretch long enough to count as a pause: (start, end) seconds
while k < N:
    if QUIET[k]:
        j = k
        while j < N and QUIET[j]:
            j += 1
        if (j - k) / 100 >= PAUSE_MIN:
            RUNS.append((k / 100, j / 100))
        k = j
    else:
        k += 1


def soft_start(k, k_min):
    """From the first sound after a pause, step back over a soft start ("h", "s"), then leave ONSET_PAD of room."""
    j = k
    while j > k_min and db[j - 1] >= SOFT and (k - j) < SOFT_BACK * 100:
        j -= 1
    return j / 100 - ONSET_PAD


def soft_end(k, k_max):
    """From the first quiet frame after a word, keep its fading end, then leave TAIL_PAD of room."""
    j = k
    while j < k_max and db[j] >= SOFT and (j - k) < SOFT_FWD * 100:
        j += 1
    return j / 100 + TAIL_PAD


def ranges(b):
    """The block's words, generously: Whisper's times plus a margin (they are only a guide: a word often starts inside
    the silence before it or stretches over the pause after it). Whisper gaps over --gap (a dropped "um") split it."""
    ws = [w for w in words if b["from"] - 0.01 <= w["s"] <= b["to"] + 0.01]
    if not ws:
        raise SystemExit(f"no words between {b['from']} and {b['to']} ({b['label']})")
    out, cur = [], [b.get("start", ws[0]["s"] - 0.05), None]
    for w, nxt in zip(ws, ws[1:] + [None]):
        if nxt is None:
            cur[1] = b.get("end", w["e"] + 0.14)
        elif nxt["s"] - w["e"] > args.gap:
            cur[1] = w["e"] + 0.10
            out.append(cur)
            cur = [nxt["s"] - 0.06, None]
    out.append(cur)
    return out, "start" in b, "end" in b


def snap(a, z, keep_a, keep_z):
    """Move a piece's edges onto the audio: an edge in a pause moves to where the speech is; an edge in the middle of
    speech moves out to the nearest pause (up to 0.25 s) so the word there finishes instead of being clipped."""
    if not keep_a:
        inside = [r for r in RUNS if r[0] <= a < r[1]]
        near = [r for r in RUNS if a - 0.25 <= r[1] <= a]
        if inside:
            a = soft_start(fr(inside[0][1]), fr(inside[0][0]))
        elif near:
            q0, q1 = max(near, key=lambda r: r[1])
            a = soft_start(fr(q1), fr(q0))
    if not keep_z:
        inside = [r for r in RUNS if r[0] <= z < r[1]]
        near = [r for r in RUNS if z <= r[0] <= z + 0.25]
        if inside:
            z = soft_end(fr(inside[0][0]), fr(inside[0][1]))
        elif near:
            q0, q1 = min(near, key=lambda r: r[0])
            z = soft_end(fr(q0), fr(q1))
    return a, z


def drop_pauses(a, z):
    """Cut every pause inside a piece, keeping each word's fading end and soft start."""
    out, cur = [], a
    for q0, q1 in RUNS:
        if q0 > cur + 0.05 and q1 < z - 0.05:
            out.append([cur, soft_end(fr(q0), fr(q1))])
            cur = soft_start(fr(q1), fr(q0))
    out.append([cur, z])
    return out


pieces, t = [], 0.0
for b in keep:
    rs, keep_a, keep_z = ranges(b)
    mine = []
    for i, (a, z) in enumerate(rs):
        a, z = snap(a, z, keep_a and i == 0, keep_z and i == len(rs) - 1)
        for p, q in drop_pauses(a, z):
            if mine and p <= mine[-1][1] + 0.03:   # touching pieces: one piece
                mine[-1][1] = max(mine[-1][1], q)
            else:
                mine.append([p, q])
    for a, z in mine:
        a, z = round(max(0.0, a), 3), round(z, 3)
        if z - a < 0.08:
            continue
        pieces.append({"label": b["label"], "in": a, "out": z})
        print(f"{t:7.2f}s  src {a:7.2f}-{z:7.2f}  ({z - a:5.2f}s)  {b['label']}")
        t += z - a
json.dump(pieces, open(os.path.join(D, "data", "cutlist.json"), "w"), indent=1)
print(f"\n{len(pieces)} pieces, {t:.2f}s -> {os.path.join(D, 'data', 'cutlist.json')}")

if args.check:
    # Build the cut's audio only (seconds), transcribe it, and compare with the kept lines: a word missing here was
    # clipped (widen that block with "start"/"end" in keep.json); extra words are fillers that came back in.
    import difflib
    import re
    import sys
    ck = os.path.join(D, "check")
    os.makedirs(os.path.join(ck, "src"), exist_ok=True)
    os.makedirs(os.path.join(ck, "data"), exist_ok=True)
    fa = join_audio(pieces, sr=16000)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(D, "src", "audio16k.wav"), "-filter_complex", fa,
                    "-map", "[a]", os.path.join(ck, "src", "audio16k.wav")], check=True)
    r = subprocess.run([sys.executable, "-I", os.path.join(os.path.dirname(os.path.abspath(__file__)), "transcribe.py"), ck,
                        "--prompt", args.prompt], capture_output=True, text=True)
    if r.returncode:
        raise SystemExit("check: transcription failed: " + r.stderr[-500:])
    got = json.load(open(os.path.join(ck, "data", "words.json")))
    exp = [w for b in keep for w in words if b["from"] - 0.01 <= w["s"] <= b["to"] + 0.01]
    norm = lambda w: re.sub(r"[^a-z0-9]", "", w.lower())
    sm = difflib.SequenceMatcher(None, [norm(w["w"]) for w in exp], [norm(w["w"]) for w in got], autojunk=False)
    print(f"\ncheck: {len(exp)} kept words, {len(got)} heard in the cut")
    clean = True
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            continue
        clean = False
        said = " ".join(w["w"] for w in exp[i1:i2]) or "-"
        heard = " ".join(w["w"] for w in got[j1:j2]) or "-"
        at = f"{got[j1]['s']:.2f}s in the cut" if j1 < len(got) else "at the end"
        kind = {"delete": "MISSING", "insert": "EXTRA", "replace": "DIFFERENT"}[op]
        near = ""
        if i2 > i1:                           # was anything cut near these words, or did the transcriber just miss them?
            lo, hi = exp[i1]["s"] - 0.15, exp[i2 - 1]["e"] + 0.15
            if not any(lo <= e <= hi for p in pieces for e in (p["in"], p["out"])):
                near = "; no cut near it, so probably just not transcribed"
        print(f"  {kind:9} kept: {said[:60]!r}  heard: {heard[:60]!r}  ({at}; source "
              f"{exp[i1]['s'] if i1 < len(exp) else exp[-1]['s']:.2f}s{near})")
    cx = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(ck, "src", "audio16k.wav"), "-f", "s16le",
                                       "-"], capture_output=True, check=True).stdout, np.int16).astype(np.float32) / 32768
    cdb = 20 * np.log10(np.sqrt(np.convolve(cx ** 2, np.ones(HOP) / HOP, "same")[::HOP]) + 1e-6)
    cq = np.median(np.lib.stride_tricks.sliding_window_view(np.pad(cdb, 2, mode="edge"), 5), axis=1) < LOUD
    longest, run, at = 0, 0, 0
    for i, q in enumerate(cq):
        run = run + 1 if q else 0
        if run > longest and i + 1 < len(cq):
            longest, at = run, (i + 1 - run) / 100
    print(f"  longest pause left: {longest / 100:.2f}s at {at:.2f}s" + ("  (over 0.2 s: look at that join)" if longest > 20 else ""))
    print("check: every kept word heard" if clean else "check: compare the lines above (a DIFFERENT pair is often just "
          "spelling; a MISSING word was clipped: widen that block's start/end in keep.json)")

if args.cue_asset:
    # Cue path: add_clips payload. Edges snap to source frames; startMs/durationMs are whole ms and each clip starts
    # exactly where the last one ends (fractional ms at 24 fps left 1 ms black gaps in the first test).
    F, f, clips = args.fps, 0, []
    for p in pieces:
        i, o = round(p["in"] * F), round(p["out"] * F)
        s0, s1 = round(f * 1000 / F), round((f + o - i) * 1000 / F)
        clips.append({"type": "media", "trackId": args.cue_track, "assetId": args.cue_asset, "startMs": s0,
                      "inMs": round(i * 1000 / F), "durationMs": s1 - s0, "name": p["label"][:60]})
        f += o - i
    json.dump(clips, open(os.path.join(D, "data", "cue_clips.json"), "w"), separators=(",", ":"))
    print(f"Cue clips ({F} fps) -> {os.path.join(D, 'data', 'cue_clips.json')}")

if args.render:
    src = args.source
    if not src:
        st = os.path.join(D, "source.txt")
        src = open(st).read().strip() if os.path.exists(st) else None
    if not src:
        raise SystemExit("--render needs --source <raw clip> (or a source.txt in the cut folder)")
    parts, labels = [], []
    for i, s in enumerate(pieces):
        d = s["out"] - s["in"]
        parts.append(f"[0:v]trim={s['in']}:{s['out']},setpts=PTS-STARTPTS[v{i}];"
                     f"[0:a]atrim={s['in']}:{s['out']},asetpts=PTS-STARTPTS,afade=t=in:d=0.03,"
                     f"afade=t=out:st={max(0, d - 0.03):.3f}:d=0.03[a{i}];")
        labels.append(f"[v{i}][a{i}]")
    fc = "".join(parts) + "".join(labels) + f"concat=n={len(pieces)}:v=1:a=1[v][a]"
    os.makedirs(os.path.join(D, "out"), exist_ok=True)
    out = os.path.join(D, "out", "acut.mov")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
                    "-c:v", "libx264", "-crf", "12", "-preset", "fast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k",
                    out], check=True)
    # the sound: swap in clean joins (room tone crossfaded 10 ms either side of every cut, av_joins.py), each piece's sound
    # filling exactly the slot its picture sits in, so the timeline and lip sync stay as rendered above
    slots = picture_slots(src, out, pieces)
    if slots:
        tmp = out[:-4] + ".joins.mov"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-i", out, "-filter_complex", join_audio(pieces, slots=slots),
                        "-map", "1:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", tmp], check=True)
        os.replace(tmp, out)
        print(f"rendered {out} (clean joins: room tone crossfaded at {len(pieces) - 1} cuts)")
    else:
        print(f"rendered {out} (joins: couldn't match the picture frame by frame, kept the plain joins)")
