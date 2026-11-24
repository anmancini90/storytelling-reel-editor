"""Find the cuts in the project's clip (the creator's first cut: jump cuts where dead air was removed) and write
page/cuts.js (window.CUTS = [seconds, ...]) for KAL.framing (close/wide on cuts).

Usage: python cuts.py <project> [--cutlist FILE] [--threshold 3]
  --cutlist FILE   a cut list from our own story cut ([{"in": s, "out": s}, ...]): its piece boundaries are exact cuts,
                   added to the detected ones (the creator's own jump cuts inside each piece). --no-detect: list only.
  default          detect: a jump cut is a one-frame spike in frame-to-frame change, 3x+ the change around it (a gesture
                   rises over several frames). Check the printed list against the video and tune --threshold.
"""
import argparse
import glob
import json
import os
import subprocess

import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("project")
ap.add_argument("--cutlist")
ap.add_argument("--threshold", type=float, default=3.0)
ap.add_argument("--no-detect", action="store_true")
args = ap.parse_args()
P = os.path.abspath(args.project)

listed = []
if args.cutlist:
    t = 0.0
    for p in json.load(open(args.cutlist))[:-1]:
        t += p["out"] - p["in"]
        listed.append(round(t, 3))
cuts = []
if not args.no_detect:
    src = (glob.glob(os.path.join(P, "src", "source.*")) or [None])[0]
    if not src:
        raise SystemExit("no src/source.* in the project (run new_project.py first)")
    rate = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=avg_frame_rate",
                           "-of", "csv=p=0", src], capture_output=True, text=True).stdout.strip()
    num, _, den = rate.partition("/")
    fps = float(num) / float(den or 1)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-vf", "scale=90:160,format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
    n = len(raw) // (90 * 160)
    X = np.frombuffer(raw[:n * 14400], np.uint8).reshape(n, 160, 90).astype(np.float32)
    d = np.abs(np.diff(X, axis=0)).mean(axis=(1, 2))          # frame-to-frame change
    for i in range(len(d)):
        near = np.r_[d[max(0, i - 12):i], d[i + 1:i + 13]]
        r = d[i] / (np.median(near) + 0.3)
        lone = (i == 0 or d[i - 1] < d[i] / 2) and (i + 1 >= len(d) or d[i + 1] < d[i] / 2)   # one-frame spike = a cut, not a gesture
        t = (i + 1) / fps
        if r > args.threshold and d[i] > 2.5 and lone and t > 0.3:
            cuts.append(round(t, 3))
            print(f"  cut at {t:7.2f}s  change {d[i]:5.1f}  x{r:4.1f} vs nearby")

for c in listed:                                  # merge, one cut per 0.3 s
    if all(abs(c - x) > 0.3 for x in cuts):
        cuts.append(c)
        print(f"  cut at {c:7.2f}s  (cut list)")
cuts.sort()
open(os.path.join(P, "page", "cuts.js"), "w").write("window.CUTS=" + json.dumps(cuts) + ";")
os.makedirs(os.path.join(P, "data"), exist_ok=True)
json.dump(cuts, open(os.path.join(P, "data", "cuts.json"), "w"))
print(f"{len(cuts)} cuts -> page/cuts.js")
