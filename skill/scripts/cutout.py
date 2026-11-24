"""Cut the speaker out of a few short windows so ANT.impact() words can sit behind their head.

Usage: python cutout.py <project> --auto                        (windows = every ANT.impact() in page/beats.js, +-0.2 s)
       python cutout.py <project> 10.9-12.4 21.3-22.6 ...      (or explicit windows, seconds in the final video)
       add --seg vision|u2net to force a mask backend (default: Apple Vision when available, else u2net; see seg.py)
Already-cut frames are skipped, so re-running after a timing change only processes what's new.
Writes <project>/page/assets/fg/NNNNN.png (RGBA): RGB straight from the project's own frames (exact colour match),
alpha from Apple Vision person segmentation (macOS, on-device, ~0.09 s per frame) or, as the fallback,
`npx hyperframes remove-background` (u2net_human_seg, runs locally, CoreML on Apple Silicon, ~0.13 s per frame).
Only the windows are processed, never the whole clip.
"""
import json
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # seg.py sits next to this script (python -I drops it)
import seg  # noqa: E402

SEG = seg.backend(sys.argv)                 # 'vision' (Apple, default when available) or 'u2net'
proj = os.path.abspath(sys.argv[1])
fps = json.load(open(os.path.join(proj, "project.json")))["fps"]
nframes = len([f for f in os.listdir(os.path.join(proj, "frames")) if f.endswith(".jpg")])
work, out = os.path.join(proj, "cutout"), os.path.join(proj, "page", "assets", "fg")
os.makedirs(work, exist_ok=True)
os.makedirs(out, exist_ok=True)
frames = os.path.join(proj, "frames", "%05d.jpg")

if "--auto" in sys.argv:
    js = os.path.join(os.path.dirname(os.path.abspath(__file__)), "impact_windows.mjs")
    r = subprocess.run(["node", js, proj], capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr.strip() or "impact_windows.mjs failed")
    found = json.loads(r.stdout)
    wins = [(max(0, a - 0.2), b + 0.2) for a, b, *_ in found]
    tones = [w for w in found if len(w) > 4 and w[3] is not None]   # impact words with colour "auto"
    if not wins:
        sys.exit("No ANT.impact() words or KAL canvas segments in page/beats.js: nothing to cut out.")
else:
    wins = [tuple(float(x) for x in w.split("-")) for w in sys.argv[2:]]
    tones = []

runs, todo = [], set()                      # only the frames that are missing, as contiguous runs
for a, b in wins:
    s, e = max(0, int(a * fps)), min(nframes - 1, int(round(b * fps)))
    miss = [i for i in range(s, e + 1) if not os.path.exists(os.path.join(out, f"{i:05d}.png"))]
    if not miss:
        print(f"{a:.2f}-{b:.2f}s: already cut out")
    todo.update(miss)
for i in sorted(todo):                      # windows may overlap / come in any order
    if runs and i == runs[-1][1] + 1:
        runs[-1][1] = i
    else:
        runs.append([i, i])

for s, e in runs:
    a, b = s / fps, e / fps
    n = e - s + 1
    vdir = os.path.join(work, f"vision_{s}")
    if SEG == "vision" and seg.vision_masks([frames % i for i in range(s, e + 1)], vdir):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(fps), "-start_number", str(s), "-i", frames,
                        "-framerate", str(fps), "-start_number", str(s), "-i", os.path.join(vdir, "%05d.png"),
                        "-filter_complex", "[1:v]format=gray[m];[0:v][m]alphamerge,format=rgba",
                        "-frames:v", str(n), "-start_number", str(s), os.path.join(out, "%05d.png")], check=True)
        shutil.rmtree(vdir, ignore_errors=True)
        print(f"{a:.2f}-{b:.2f}s -> frames {s}-{e} ({n} cutouts, Apple Vision)")
        continue
    shutil.rmtree(vdir, ignore_errors=True)
    mp4, mov = os.path.join(work, f"win_{s}.mp4"), os.path.join(work, f"win_{s}.mov")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(fps), "-start_number", str(s), "-i", frames, "-frames:v", str(n),
                    "-c:v", "libx264", "-crf", "8", "-pix_fmt", "yuv420p", mp4], check=True)
    subprocess.run(["npx", "-y", "hyperframes@0.8.177", "remove-background", mp4, "-o", mov], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(fps), "-start_number", str(s), "-i", frames, "-i", mov,
                    "-filter_complex", "[1:v]alphaextract,format=gray[m];[0:v][m]alphamerge,format=rgba",
                    "-frames:v", str(n), "-start_number", str(s), os.path.join(out, "%05d.png")], check=True)
    print(f"{a:.2f}-{b:.2f}s -> frames {s}-{e} ({n} cutouts, u2net)")
print(f"-> {out}")


def background_tone(at, until, text, top, size):
    """'dark' or 'light': the mean brightness of the background (the speaker cut out) where the word sits."""
    import numpy as np
    from PIL import Image
    w = min(1040, 0.6 * size * max(1, len(text)))
    x0, x1, y0, y1 = int(540 - w / 2), int(540 + w / 2), int(top), int(top + size * 0.85)
    vals = []
    for t in (at + 0.15, (at + until) / 2, until - 0.1):
        i = min(nframes - 1, max(0, int(round(t * fps))))
        img = np.asarray(Image.open(frames % i).convert("RGB"), dtype=np.float32)[y0:y1, x0:x1]
        lum = img @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
        fgp = os.path.join(out, f"{i:05d}.png")
        if os.path.exists(fgp):
            alpha = np.asarray(Image.open(fgp).convert("RGBA"), dtype=np.uint8)[y0:y1, x0:x1, 3]
            lum = lum[alpha < 128]
        if lum.size:
            vals.append(float(lum.mean()))
    return ("dark" if np.mean(vals) < 115 else "light", np.mean(vals)) if vals else ("light", None)


if tones:                                   # impact words with colour "auto": white over dark, ink over light
    known = {}
    for at, until, text, top, size in (w[:5] for w in tones):
        tone, lum = background_tone(at, until, text, top, size)
        known[f"{at:.2f}"] = tone
        print(f'impact "{text}" at {at:.2f}s: background {"%.0f/255" % lum if lum is not None else "?"} -> '
              f'{"white" if tone == "dark" else "dark"} word')
    with open(os.path.join(proj, "page", "tones.js"), "w") as f:
        f.write("// written by cutout.py --auto: the background behind each auto-colour impact word\n")
        f.write(f"window.IMPACT_TONES = {json.dumps(known)};\n")

