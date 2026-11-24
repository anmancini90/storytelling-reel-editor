"""Build a chalk sound track that follows an EDT.doodle drawing stroke by stroke (Ant, 2026-11-02: "I want to hear like
chalk being drawn on a board").

Usage: python chalk.py <out.wav> AT:DUR:TYPE [AT:DUR:TYPE ...] [--src sfx/chalk-writing.wav] [--rms-db -25]
  AT/DUR in video seconds (doodle's el.strokes), TYPE text|arrow|circle|underline.
  Text is written as a run of short letter strokes with tiny breaks; lines and circles get one long stroke.
Prints the start time; mix it with  mix_audio.py <P> --sfx <out.wav>@=<start>
"""
import argparse
import os
import subprocess

import numpy as np

SR = 48000
ap = argparse.ArgumentParser()
ap.add_argument("out")
ap.add_argument("strokes", nargs="+")
ap.add_argument("--src", default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sfx", "chalk-writing.wav"))
ap.add_argument("--rms-db", type=float, default=-25.0)   # level while the chalk moves; -25 sits ~12 dB under the voice in the final mix
args = ap.parse_args()

x = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", args.src, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                                 capture_output=True, check=True).stdout, np.float32).copy()
# the recording's strokes: 10 ms blocks more than 12 dB over the noise floor, merged across gaps under 40 ms
blk = 480
lv = np.array([20 * np.log10(np.sqrt(np.mean(x[i:i + blk] ** 2)) + 1e-9) for i in range(0, len(x) - blk, blk)])
on = lv > np.percentile(lv, 10) + 12
segs, s, gap = [], None, 0
for i, v in enumerate(on):
    if v:
        if s is None:
            s = i
        gap = 0
    elif s is not None:
        gap += 1
        if gap > 4:
            segs.append((s, i - gap + 1)); s = None
if s is not None:
    segs.append((s, len(on)))
segs = [(a * blk, b * blk) for a, b in segs if (b - a) * blk >= 0.06 * SR]
if not segs:
    raise SystemExit("no strokes found in " + args.src)
longest = max(segs, key=lambda ab: ab[1] - ab[0])
short = sorted([sg for sg in segs if sg != longest], key=lambda ab: ab[0]) or [longest]


def faded(seg, n=None):
    a, b = seg
    y = x[a:b].copy() if n is None else x[a:a + n].copy()
    f = min(len(y) // 4, int(0.012 * SR))
    if f:
        y[:f] *= np.linspace(0, 1, f); y[-f:] *= np.linspace(1, 0, f)
    return y


strokes = [(float(a), float(d), t) for a, d, t in (s.split(":") for s in args.strokes)]
t0 = min(a for a, _, _ in strokes)
end = max(a + d for a, d, _ in strokes) + 0.3
out = np.zeros(int((end - t0) * SR) + SR, np.float32)
k = 0
for at, dur, typ in strokes:
    pos, stop = int((at - t0) * SR), int((at - t0 + dur) * SR)
    if typ == "text":          # letters: short strokes with 30-50 ms lifts of the chalk
        while pos < stop:
            seg = short[k % len(short)]; k += 1
            y = faded(seg, min(seg[1] - seg[0], stop - pos))
            out[pos:pos + len(y)] += y
            pos += len(y) + int((0.03 + 0.02 * (k % 2)) * SR)
    else:                      # one drawn line: the long stroke, looped with a crossfade if the line takes longer
        n = stop - pos
        y = faded(longest, min(n, longest[1] - longest[0]))
        out[pos:pos + len(y)] += y
        if n > len(y):
            y2 = faded(short[k % len(short)], n - len(y)); k += 1
            p2 = pos + len(y) - int(0.01 * SR)
            out[p2:p2 + len(y2)] += y2
# chalk is mostly quiet scratch with loud taps (crest ~29 dB): set the level by the scratch, then a limiter tames the taps
b10 = int(0.1 * SR)


def active_rms(y):
    r = np.array([np.sqrt(np.mean(y[i:i + b10] ** 2)) for i in range(0, len(y) - b10, b10)])
    return 20 * np.log10(np.sqrt(np.mean(r[r > r.max() * 0.1] ** 2)) + 1e-12)


def limit(y):
    return np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-",
                                         "-af", "alimiter=limit=0.35:attack=1:release=40:level=0", "-f", "f32le", "-"],
                                        input=y.astype(np.float32).tobytes(), capture_output=True, check=True).stdout, np.float32)


gain = args.rms_db - active_rms(out)
for _ in range(6):                 # the limiter eats some level, so nudge the gain until the limited scratch hits the target
    lim = limit(out * 10 ** (gain / 20))
    miss = args.rms_db - active_rms(lim)
    if abs(miss) < 0.3:
        break
    gain += miss
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", args.out], input=lim.tobytes(), check=True)
print(f"{len(strokes)} strokes from {len(segs)} recorded ones -> {args.out}, starts at {t0:.3f}s (scratch at {active_rms(lim):+.1f} dBFS RMS, taps limited to -9 dBFS)")
print(f"mix with: --sfx {args.out}@={t0:.3f}")
