"""Track where the speaker's head is through the whole video, so graphics can be checked against it.

Usage: python heads.py <project> [--step 0.25]
Samples one frame every --step seconds, cuts the person out locally (Apple Vision when available, else
`npx hyperframes remove-background` u2net_human_seg; force one with --seg vision|u2net, see seg.py), and records for each sample the head top (highest row of the person) and the person's left/right
extent 60 px below it, in 1080x1920 coordinates. Writes data/heads.json and page/heads.js (window.HEADS).
Used by: safezone.mjs (headroom check: no card may sit on the head) and ANT.impact({ top: 'auto' }).
About 0.1 s per sample (~25 s for a 60 s video at the default step).
"""
import json
import os
import shutil
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # seg.py sits next to this script (python -I drops it)
import seg  # noqa: E402

SEG = seg.backend(sys.argv)
proj = os.path.abspath(sys.argv[1])
step = float(sys.argv[sys.argv.index("--step") + 1]) if "--step" in sys.argv else 0.25
meta = json.load(open(os.path.join(proj, "project.json")))
fps, n = meta["fps"], meta["nframes"]
W, H, S = 360, 640, 1920 / 640
work = os.path.join(proj, "cutout")
os.makedirs(work, exist_ok=True)
mp4, mov = os.path.join(work, "heads.mp4"), os.path.join(work, "heads.mov")


def vision_alpha():
    """Apple Vision masks of the sampled frames at WxH, or None (then u2net)"""
    from PIL import Image
    idx = [min(n - 1, round(k * step * fps)) for k in range(int(np.ceil(n / fps / step - 1e-9)))]
    paths = [os.path.join(proj, "frames", f"{i:05d}.jpg") for i in idx]
    vdir = os.path.join(work, "vision_heads")
    try:
        if not seg.vision_masks(paths, vdir):
            return None
        return np.stack([np.array(Image.open(os.path.join(vdir, f"{i:05d}.png")).convert("L").resize((W, H), Image.BILINEAR))
                         for i in idx])
    finally:
        shutil.rmtree(vdir, ignore_errors=True)


alpha = vision_alpha() if SEG == "vision" else None
if alpha is None:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(fps), "-i", os.path.join(proj, "frames", "%05d.jpg"),
                    "-vf", f"fps=1/{step},scale={W}:{H}", "-c:v", "libx264", "-crf", "12", "-pix_fmt", "yuv420p", mp4], check=True)
    subprocess.run(["npx", "-y", "hyperframes@0.8.177", "remove-background", mp4, "-o", mov], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", mov, "-vf", "alphaextract,format=gray", "-f", "rawvideo", "-"],
                         capture_output=True, check=True).stdout
    alpha = np.frombuffer(raw, np.uint8).reshape(-1, H, W)
    SEG = "u2net"

tops, lefts, rights = [], [], []
for a in alpha:
    m = a > 128
    rows = np.where(m[:, W // 5: 4 * W // 5].sum(axis=1) >= 4)[0]          # ignore stray edge pixels / hands at the sides
    if not len(rows):
        tops.append(None); lefts.append(None); rights.append(None)
        continue
    top = int(rows[0])
    band = m[min(H - 1, top + 20)] | m[min(H - 1, top + 45)] | m[min(H - 1, top + 70)]   # widest of skull / eyes / cheeks
    cols = np.where(band)[0]
    tops.append(round(top * S)); lefts.append(round(cols[0] * S) if len(cols) else None); rights.append(round(cols[-1] * S) if len(cols) else None)

data = {"step": step, "top": tops, "left": lefts, "right": rights}
json.dump(data, open(os.path.join(proj, "data", "heads.json"), "w"))
open(os.path.join(proj, "page", "heads.js"), "w").write(f"window.HEADS={json.dumps(data)};")
valid = [t for t in tops if t is not None]
print(f"{len(tops)} samples every {step}s: head top y {min(valid)}-{max(valid)} (median {int(np.median(valid))})"
      if valid else "no person found in any sample")
print(f"-> data/heads.json, page/heads.js  (masks: {'Apple Vision' if SEG == 'vision' else 'u2net'})")
